"""Preserve SOC identities; title links are derived evidence, not identity merges."""
from collections import defaultdict
import re


def title_links(archetypes, occupations):
    codes, titles, named = defaultdict(list), defaultdict(list), defaultdict(list)
    def title(value): return ' '.join((value or '').split()).casefold()
    for row in archetypes:
        codes[row['soc_code']].append(row)
        titles[title(row['title'])].append(row)
    for row in occupations:
        named[title(row['job_title'])].append(row)
    links, rejected = [], []
    for row in archetypes:
        code, label = row['soc_code'], title(row['title'])
        if not isinstance(code, str) or not re.fullmatch(r'\d{2}-\d{4}\.\d{2}', code):
            rejected.append({'soc_code':code,'reason':'INVALID_SOC_CODE'}); continue
        if len(codes[code]) != 1 or not label or len(titles[label]) != 1 or len(named[label]) != 1:
            rejected.append({'soc_code':code,'reason':'NO_UNIQUE_EXACT_TITLE_LINK'}); continue
        links.append({'soc_code':code,'job_id':named[label][0]['job_id'],
                      'source_ordinal':row['source_ordinal'], 'source':row['source'],
                      'method':'unique_exact_ONET_title','identity_equivalence':False})
    return links, rejected
