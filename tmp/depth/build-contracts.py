import json
from pathlib import Path
source=json.loads(Path('docs/plans/microtool-trigger-plan.json').read_text())['tools']
def profile(t):
 id=t['id'];n=t['name'].lower();f=id.split('_')[0]
 overrides={'INST_004':'skill_map','COURSE_007':'skill_map','COURSE_008':'role','COURSE_009':'organisation','COMP_006':'market','COMP_008':'comparison','COMP_014':'plan','INST_005':'skill_map','INST_006':'skill_map'}
 if id in overrides:return overrides[id]
 if id in ('CORE_001','CORE_002'):return 'internal'
 if id in ('SKILL_001','SKILL_002','SKILL_009','TECH_001'):return 'skill'
 if 'compare' in n or id in ('COMP_010','COURSE_015'):return 'comparison'
 if id in ('CORE_010','RPL_001','PROVE_001'):return 'evidence'
 if id=='COURSE_011':return 'cost'
 if id in ('COURSE_010','JOB_002'):return 'requirements'
 if f=='TREND' or any(x in n for x in ('trend','outlook','demand','shortage','freshness','hiring signals','automation','ai impact','technology change')):return 'market'
 if any(x in n for x in ('gap','plan','progression','change map','upskill','mobility','readiness','next skills')):return 'plan'
 if f in ('EXPERIENCE','APP') or 'match' in n:return 'opportunity'
 if f=='COURSE' or id in ('MICRO_001','INST_004','INST_005','INST_006','INST_007'):return 'course'
 if f in ('SKILL','CAND') or 'skill' in n:return 'skill_map'
 if f in ('JOB','CAREER'):return 'role'
 if f in ('COMP','IND','INST'):return 'organisation'
 return 'navigation'
out=[dict(id=t['id'],profile=profile(t),required_inputs=t['required_inputs'],information=t['output_fields'],evidence=t['evidence_rule']) for t in source]
Path('src/routing/learningContracts.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print({p:sum(t['profile']==p for t in out) for p in sorted(set(t['profile'] for t in out))})
