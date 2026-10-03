"""Versioned JSA IVI refresh, preserving revisions and immutable warehouse lineage.

Only the official skill-level/state Seasonally Adjusted count worksheet is accepted.
A refresh never changes the original SQLite or immutable RDS landing release.
"""
import argparse
import calendar
import hashlib
import json
import math
import re
import shutil
import urllib.parse
import urllib.request
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from zipfile import ZipFile
from common import content_digest, digest, now, read_bundle, records, write_json

PAGE = 'https://www.jobsandskills.gov.au/data/internet-vacancy-index'
HOST = 'www.jobsandskills.gov.au'
PREFIX = '/sites/default/files/'
NAME = r'internet_vacancies_anzsco_skill_level_states_and_territories_-_([a-z]+)_(20\d{2})\.xlsx'
STATES = frozenset(('AUST','NSW','VIC','QLD','SA','WA','TAS','NT','ACT'))
SERIES = frozenset(f'IVI__{state}__SL{skill}__SA__MONTHLY' for state in STATES for skill in range(1,6))
FORMAT = 'yuzee-jsa-ivi-release-v1'
LIMIT = 8 * 1024**2


def workbook_period(url):
    u=urllib.parse.urlsplit(url)
    if u.scheme!='https' or u.netloc!=HOST or u.query or u.fragment or not u.path.startswith(PREFIX):
        raise ValueError('Official JSA HTTPS workbook URL required')
    m=re.fullmatch(NAME,Path(u.path).name)
    if not m:raise ValueError('Unsupported IVI workbook family')
    months={name.lower():i for i,name in enumerate(calendar.month_name) if name}
    if m[1] not in months:raise ValueError('Invalid release month')
    return f'{m[2]}-{months[m[1]]:02}'


class Links(HTMLParser):
    def __init__(self):super().__init__();self.urls=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            url=urllib.parse.urljoin(PAGE,dict(attrs).get('href',''))
            try:workbook_period(url)
            except ValueError:return
            self.urls.append(url)


def discover(html):
    parser=Links();parser.feed(html)
    candidates=set(parser.urls)
    if not candidates:raise ValueError('Official IVI workbook link missing')
    latest=max(workbook_period(url) for url in candidates)
    selected=[url for url in candidates if workbook_period(url)==latest]
    if len(selected)!=1:raise ValueError('Ambiguous latest IVI workbook')
    return selected[0]


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        url=urllib.parse.urlsplit(newurl)
        if url.scheme!='https' or url.netloc!=HOST:raise ValueError('Unexpected source redirect')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch(url):
    u=urllib.parse.urlsplit(url)
    if u.scheme!='https' or u.netloc!=HOST:raise ValueError('Unexpected source host')
    opener=urllib.request.build_opener(OfficialRedirect())
    request=urllib.request.Request(url,headers={'User-Agent':'Yuzee-Warehouse-IVI/1.0'})
    with opener.open(request,timeout=30) as response:
        body=response.read(LIMIT+1)
    if len(body)>LIMIT:raise ValueError('IVI download exceeds bound')
    return body


def parse_workbook(path,expected_period,as_of=None):
    from openpyxl import load_workbook
    as_of=as_of or date.today()
    with ZipFile(path) as archive:
        if len(archive.infolist())>200 or sum(f.file_size for f in archive.infolist())>64*1024**2:
            raise ValueError('Workbook expanded size exceeds bound')
    wb=load_workbook(path,read_only=True,data_only=True)
    try:
        if 'Seasonally Adjusted' not in wb.sheetnames:raise ValueError('Count worksheet missing')
        sheet=wb['Seasonally Adjusted']
        if sheet.max_row>100 or sheet.max_column>1000:raise ValueError('Unexpected workbook dimensions')
        rows=iter(sheet.iter_rows(values_only=True));headers=next(rows)
        if list(headers[:4])!=['Level','Title','State','Skill_level']:raise ValueError('Workbook schema changed')
        dates=headers[4:]
        if not dates or any(not isinstance(d,(date,datetime)) or d.day!=1 for d in dates):
            raise ValueError('Invalid month headers')
        periods=[d.strftime('%Y-%m') for d in dates]
        months=[d.year*12+d.month for d in dates]
        if any(b!=a+1 for a,b in zip(months,months[1:])):raise ValueError('Non-contiguous or duplicate periods')
        if periods[-1]!=expected_period:raise ValueError('Workbook period differs from source release')
        lag=as_of.year*12+as_of.month-months[-1]
        if lag<0:raise ValueError('Future observation')
        if lag>2:raise ValueError('Stale IVI workbook; current refresh refused')
        if len(periods)<50:raise ValueError('Insufficient evaluation history')
        found={};seen=set()
        for row in rows:
            if all(v is None for v in row):continue
            level,title,state,skill=row[:4]
            if state not in STATES or type(skill) is not int or skill not in range(6):
                raise ValueError('Unexpected geography or skill level')
            if (state,skill) in seen:raise ValueError('Duplicate state/skill series')
            seen.add((state,skill))
            values=row[4:]
            if len(values)!=len(periods) or any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in values):
                raise ValueError('Missing or invalid count; no gap filling')
            if skill==0:continue
            if level!=2 or not isinstance(title,str) or not title.strip():raise ValueError('Skill-level identity changed')
            sid=f'IVI__{state}__SL{skill}__SA__MONTHLY'
            found[sid]=[{'series_id':sid,'period':period,'value':float(value),
                         'source_table':'stg_abs_time_series','quality_score':None}
                        for period,value in zip(periods,values)]
        if set(found)!=SERIES or len(seen)!=54:raise ValueError('Incomplete state/skill coverage')
        return [row for sid in sorted(found) for row in found[sid]]
    finally:wb.close()


def release(workbook,url,output,as_of=None):
    period=workbook_period(url)
    rows=parse_workbook(workbook,period,as_of)
    out=Path(output);out.mkdir(parents=True,exist_ok=False)
    shutil.copyfile(workbook,out/'source.xlsx')
    with (out/'observations.jsonl').open('x') as f:
        for row in rows:f.write(json.dumps(row,sort_keys=True,allow_nan=False)+'\n')
    m={'format':FORMAT,'status':'COMPLETE','source_url':url,'reference_period':period,
       'download_sha256':digest(out/'source.xlsx'),'observations_sha256':digest(out/'observations.jsonl'),
       'rows':len(rows),'series':45,'metric':'online_job_advertisement_count',
       'adjustment':'seasonally_adjusted','scope':'national_and_state_skill_level',
       'first_period':rows[0]['period'],'parser_version':1}
    m['release_id']=content_digest(m)
    write_json(out/'manifest.json',m)
    write_json(out/'fetch-receipt.json',{'recorded_at':now(),'release_id':m['release_id'],
                                      'rds_publication':'NOT_ATTEMPTED'})
    return m


def verify(path,as_of=None):
    path=Path(path);m=json.loads((path/'manifest.json').read_text());identity=m.pop('release_id')
    if content_digest(m)!=identity or m['format']!=FORMAT or m['status']!='COMPLETE':raise ValueError('Invalid IVI manifest')
    m['release_id']=identity
    if digest(path/'source.xlsx')!=m['download_sha256'] or digest(path/'observations.jsonl')!=m['observations_sha256']:
        raise ValueError('IVI fingerprint mismatch')
    if workbook_period(m['source_url'])!=m['reference_period']:raise ValueError('IVI provenance mismatch')
    parsed=parse_workbook(path/'source.xlsx',m['reference_period'],as_of)
    actual=[json.loads(line) for line in (path/'observations.jsonl').read_text().splitlines()]
    if actual!=parsed or len(parsed)!=m['rows']:raise ValueError('IVI observations differ from source workbook')
    return m,actual


def overlay(bundle,ivi_release,output,as_of=None):
    base=read_bundle(bundle);m,new_rows=verify(ivi_release,as_of)
    old=[r for r in records(bundle,'timesfm_series_observation') if r['series_id'] in SERIES]
    # A refreshed complete history may revise old values, but not remove periods.
    new_keys={(r['series_id'],r['period']) for r in new_rows}
    if any((r['series_id'],r['period']) not in new_keys for r in old):raise ValueError('Refresh would discard historical periods')
    out=Path(output);out.mkdir(parents=True,exist_ok=False)
    for name in base['tables']:
        if name!='timesfm_series_observation':shutil.copyfile(Path(bundle)/(name+'.jsonl'),out/(name+'.jsonl'))
    kept=[r for r in records(bundle,'timesfm_series_observation') if r['series_id'] not in SERIES]
    rows=sorted(kept+new_rows,key=lambda r:(r['series_id'],r['period']))
    file=out/'timesfm_series_observation.jsonl'
    with file.open('x') as f:
        for ordinal,row in enumerate(rows,1):
            f.write(json.dumps(row|{'source_ordinal':ordinal},allow_nan=False)+'\n')
    manifest=json.loads(json.dumps(base))
    lineage={'format':'yuzee-ivi-overlay-v1','base_source_release':base['source_release'],
             'ivi_release':m['release_id'],'source_url':m['source_url'],'reference_period':m['reference_period'],
             'source_workbook_sha256':m['download_sha256']}
    manifest.update(source_release=content_digest(lineage),created_at=now(),ivi_refresh=lineage,
                    source_schema=base['source_schema']+' + versioned JSA IVI release')
    manifest['tables']['timesfm_series_observation'].update(rows=len(rows),sha256=digest(file))
    write_json(out/'manifest.json',manifest)
    read_bundle(out)
    return manifest


def main():
    p=argparse.ArgumentParser();p.add_argument('--output',required=True)
    p.add_argument('--workbook',help='Already downloaded official workbook; requires --source-url')
    p.add_argument('--source-url');p.add_argument('--bundle');p.add_argument('--bundle-output')
    a=p.parse_args()
    if bool(a.bundle)!=bool(a.bundle_output):p.error('--bundle and --bundle-output must be paired')
    if a.workbook and not a.source_url:p.error('--source-url is required with --workbook')
    out=Path(a.output)
    if a.workbook:
        m=release(a.workbook,a.source_url,out)
    else:
        import tempfile
        url=a.source_url or discover(fetch(PAGE).decode('utf-8'))
        workbook_period(url)
        body=fetch(url)
        with tempfile.TemporaryDirectory() as temp:
            file=Path(temp)/'source.xlsx';file.write_bytes(body);m=release(file,url,out)
    if a.bundle:overlay(a.bundle,out,a.bundle_output)
    print(json.dumps({'status':'VALIDATED_SOURCE_ARTIFACT','release_id':m['release_id'],
                      'period':m['reference_period'],'series':m['series'],'rows':m['rows'],
                      'production_publication':False}))

if __name__=='__main__':main()
