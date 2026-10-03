import json
import tempfile
import unittest
from datetime import date,datetime
from pathlib import Path
from openpyxl import Workbook,load_workbook
from common import digest,write_json,read_bundle,records
from schema import TABLES
from ivi_refresh import discover,workbook_period,parse_workbook,release,verify,overlay,STATES

URL='https://www.jobsandskills.gov.au/sites/default/files/2026-09/internet_vacancies_anzsco_skill_level_states_and_territories_-_august_2026.xlsx'
ASOF=date(2026,9,29)

def workbook(path):
    w=Workbook();s=w.active;s.title='Seasonally Adjusted'
    dates=[datetime(2022+(6+i)//12,(6+i)%12+1,1) for i in range(50)]
    s.append(['Level','Title','State','Skill_level',*dates])
    for state in sorted(STATES):
        for skill in range(6):s.append([0 if skill==0 else 2,state+' skill '+str(skill),state,skill,*[float(100+skill+i) for i in range(50)]])
    w.save(path)

class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.file=self.root/'source.xlsx';workbook(self.file)
    def tearDown(self):self.temp.cleanup()
    def edit(self,fn):
        w=load_workbook(self.file);fn(w.active);w.save(self.file);w.close()
    def test_latest_discovery_is_family_and_host_scoped(self):
        old=URL.replace('august','april').replace('2026-09','2026-05')
        self.assertEqual(discover(f'<a href="{old}">old</a><a href="{URL}">new</a><a href="{URL.replace("www.jobsandskills.gov.au","evil.example")}">bad</a>'),URL)
        with self.assertRaises(ValueError):workbook_period(URL+'?token=abc')
    def test_valid_counts_have_exact_identity_and_observation_count(self):
        rows=parse_workbook(self.file,'2026-08',ASOF)
        self.assertEqual(len(rows),2250);self.assertEqual(len({r['series_id'] for r in rows}),45)
        self.assertEqual(rows[-1]['period'],'2026-08')
    def test_stale_future_and_mislabeled_source_rejected(self):
        for expected,at in [('2026-07',ASOF),('2026-08',date(2026,7,1)),('2026-08',date(2026,12,1))]:
            with self.assertRaises(ValueError):parse_workbook(self.file,expected,at)
    def test_missing_value_never_becomes_zero(self):
        self.edit(lambda s:setattr(s.cell(3,8),'value',None))
        with self.assertRaises(ValueError):parse_workbook(self.file,'2026-08',ASOF)
    def test_invalid_boolean_counts_rejected(self):
        self.edit(lambda s:setattr(s.cell(3,8),'value',True))
        with self.assertRaises(ValueError):parse_workbook(self.file,'2026-08',ASOF)
    def test_missing_series_and_duplicate_period_rejected(self):
        self.edit(lambda s:s.delete_rows(3))
        with self.assertRaises(ValueError):parse_workbook(self.file,'2026-08',ASOF)
        workbook(self.file);self.edit(lambda s:setattr(s.cell(1,6),'value',s.cell(1,5).value))
        with self.assertRaises(ValueError):parse_workbook(self.file,'2026-08',ASOF)
    def test_artifact_idempotency_and_tamper_rejection(self):
        a=release(self.file,URL,self.root/'a',ASOF);b=release(self.file,URL,self.root/'b',ASOF)
        self.assertEqual(a['release_id'],b['release_id']);verify(self.root/'a',ASOF)
        (self.root/'a'/'observations.jsonl').write_text('{}\n')
        with self.assertRaises(ValueError):verify(self.root/'a',ASOF)
    def base(self):
        path=self.root/'base';path.mkdir()
        m={'format':'yuzee-intelligence-input-v1','status':'COMPLETE','source_release':'a'*64,'source_schema':'test_landing','tables':{}}
        for name,fields in TABLES.items():
            f=path/(name+'.jsonl');f.write_text('')
            if name=='timesfm_series_observation':
                rows=[{'series_id':'IVI__VIC__SL1__SA__MONTHLY','period':'2026-04','value':999,'source_table':'stg_abs_time_series','quality_score':1,'source_ordinal':1},
                      {'series_id':'OTHER','period':'2024','value':2,'source_table':'other','quality_score':None,'source_ordinal':2}]
                f.write_text(''.join(json.dumps(r)+'\n' for r in rows))
            m['tables'][name]={'fields':fields,'rows':2 if name=='timesfm_series_observation' else 0,'sha256':digest(f)}
        write_json(path/'manifest.json',m);return path
    def test_revisions_replace_history_preserve_other_series_and_new_lineage(self):
        source=self.root/'release';m=release(self.file,URL,source,ASOF);base=self.base()
        before=digest(base/'timesfm_series_observation.jsonl')
        new=overlay(base,source,self.root/'new',ASOF)
        rows=list(records(self.root/'new','timesfm_series_observation'))
        self.assertEqual(len(rows),2251);self.assertEqual(rows[-1]['series_id'],'OTHER')
        value=next(r['value'] for r in rows if r['series_id']=='IVI__VIC__SL1__SA__MONTHLY' and r['period']=='2026-04')
        self.assertNotEqual(value,999);self.assertNotEqual(new['source_release'],'a'*64)
        self.assertEqual(new['ivi_refresh']['base_source_release'],'a'*64)
        self.assertEqual(digest(base/'timesfm_series_observation.jsonl'),before)
        self.assertEqual(read_bundle(self.root/'new')['source_release'],new['source_release'])

if __name__=='__main__':unittest.main()
