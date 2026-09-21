"""Package the diagnostic UX audit. No production files or personal transcripts are exported."""
from pathlib import Path
import json, re, html, statistics, hashlib, shutil, zipfile, math

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / 'output/ux-audit'
HTML = REPO / 'output/html'
HTML.mkdir(parents=True, exist_ok=True)
cases = [json.loads(p.read_text()) for p in sorted((ROOT/'live').glob('*.json'))]
routes = json.loads((ROOT/'routing.json').read_text())['results'] + json.loads((ROOT/'routing-auto.json').read_text())['results']
workspaces = json.loads((ROOT/'workspace-execution.json').read_text())['results']

score_rows = [
 ('Understanding and shared context',15,3.5),('Communication and cognitive effort',15,3),
 ('Decision support and visible value',15,3),('Appropriate automatic assistance',15,2.5),
 ('Navigation and user control',10,3),('Trust and evidence',15,2),
 ('Responsiveness and recovery',10,2.5),('Connection to real action',5,1)]
journey_rows = [('Purpose clarity',8,3),('Situation understanding',12,3.5),('Question quality',10,2.5),
 ('Value while asking',10,3.5),('Language fit',10,2.5),('Personalisation',10,3.5),('Explanation / why',8,3),
 ('Decision support',10,3),('Actionability',10,2.5),('Correct flow/routing',5,3),('Conversation progress',4,3),('Trust/realism',3,1.5)]
def card(rows):
 return {'dimensions':[{'dimension':n,'weight':w,'score_out_of_5':s,'weighted_points':w*s/5} for n,w,s in rows],
         'weighted_total':round(sum(w*s/5 for _,w,s in rows),1)}
scorecard={'date':'2026-09-19','type':'Provisional evaluator judgment; not customer satisfaction or routing probability',
 'anchors':{'0':'absent','1':'seriously weak','2':'inconsistent','3':'adequate','4':'strong','5':'consistently demonstrated'},
 'product_readiness':card(score_rows),'school_journey':card(journey_rows),
 'critical_gate':'Unsupported universal eligibility claims prevent a passing judgment regardless of average.',
 'not_measured':['Real-user CSAT','NPS','Referral rate','Retention','Population-level helpfulness']}
(ROOT/'scorecard.json').write_text(json.dumps(scorecard,indent=2)+'\n')

issue_data=[
 ('UX01','P0','Conflicting service identifiers','Prompt and schema','UE-05-A; main prompt routing guide lines 413–423','Generate routing names from the canonical contract.','All examples validate; no CAREER_PATHWAY_RMO output after repeated unclear-work prompts.'),
 ('UX02','P0','Unsupported claims pass review','Evidence and validation','Saved school option; UE-02-A3; EM-04-A2; EX-AUTO-A workspace','Review all visible fields and require provenance for user-specific claims.','No invented eligibility, availability, capabilities or remote-working conditions in the cited regressions.'),
 ('UX03','P1','Conversation denies available workspace','Capability contract','EX-AUTO-B main response versus actual AUTO_OPEN','Share runtime capabilities with main conversation and review.','Explicit workspace requests describe the available feature accurately.'),
 ('UX04','P1','Earlier context omitted from new activity','State and context','objectiveContext in src/objectives/service.ts','Use a versioned relevant fact record and question-answer pairs.','Turn-one year/location/constraint survives turn ten; fragments resolve correctly.'),
 ('UX05','P1','Competing questions on left and right','Conversation orchestration','Current desktop school conversation and completed workspace','Assign one owner to each pending question.','Opening an activity retires the overlapping chat question; no duplicate answer collection.'),
 ('UX06','P1','Hidden unfinished activity blocks later help','Activity lifecycle','service.select active-session guard; drawer close only hides','Distinguish paused, active and complete; evaluate new goal separately.','An unrelated paused activity does not silently suppress a useful new activity.'),
 ('UX07','P1','New scope cannot reuse completed objective automatically','Activity lifecycle','service.select done.some objective ID filter','Scope deduplication by goal and entities, not just objective ID.','A second pair of job offers can open a new comparison while preserving the first.'),
 ('UX08','P1','Details editor disappears on some complete results','Correction and UI','ContextDetails.tsx lines 5–8; inspected subject result','Render details from persisted context, not only current plan notes.','Completed plans without USER_CONFIRMED UI notes still allow fact correction.'),
 ('UX09','P1','Multiple serial generation steps delay value','Latency and architecture','51 main timings; 14 selections; two workspace starts','Parallelise safe retrieval, avoid redundant decision calls, instrument each stage.','Measure cold/warm median and p95 first-value times; stale requests cancel correctly.'),
 ('UX10','P1','Uncertainty leads to abstract menus','Conversation design','HS-01-A2/A3 and AX-08-A4','Offer one small concrete example after repeated uncertainty.','User can react without choosing a career category; response leads to a changed next step.'),
 ('UX11','P1','Readiness and completion can overstate certainty','Product semantics','Workspace readiness 85/80 with unresolved evidence','Define inspectable readiness criteria and separate generated result from verified decision.','No completion label implies verified eligibility or completed external action.'),
 ('UX12','P1','Advice-to-service gap','Capabilities and service design','Capability registry marks four services not connected; workspaceInstructions','State draft/lookup/application capabilities accurately; integrate prioritised real services.','Every proposed action either works or clearly explains the next achievable step.'),
 ('UX13','P2','Duplicate and compound questions','Prompt and communication','EM-01-A, UE-05-A, AX-04-A','One plain question with an explicit decision purpose.','Same question is not repeated in prose and interaction; no unnecessary multi-part request.'),
 ('UX14','P2','Testing controls and internal interpretation distract','Production presentation','ObjectiveWorkspace and desktop header','Gate diagnostics; retain only relevant explanation of uncertainty.','Ordinary users see no model/tokens/testing catalogue or raw internal basis fields.'),
 ('UX15','P2','Automatic focus and mobile flow need validation','Accessibility and navigation','ObjectiveWorkspace opening focus; resize code','Preserve typing/read position and provide one mobile active surface.','Keyboard/screen-reader/zoom/touch journeys pass with no surprise focus loss.'),
 ('UX16','P2','Outcome and satisfaction evidence missing','Measurement','No recruited study or measured CSAT in this evaluation','Instrument useful outcomes and run independent participant research.','Report satisfaction response rate, next-step clarity and real referral behaviour separately.'),
 ('UX17','P2','Suggested activity may repeat a completed answer','Routing usefulness','EX-COMPARE-A SUGGEST after a completed explanation','Require an identifiable incremental benefit.','Explanation-only comparison finishes without redundant activity unless refinement adds value.'),
 ('UX18','P2','General school guidance sounds locally authoritative','Evidence and copy','EX-AUTO-B workspace workload/topic rows','Label general scope and use current curriculum evidence for specific requirements.','Unknown school/curriculum does not produce definite workload or entry promises.')]
issues=[dict(zip(['id','priority','finding','owner_area','evidence','proposed_change','acceptance_test'],row),status='Open; baseline only') for row in issue_data]
(ROOT/'issues.json').write_text(json.dumps(issues,indent=2)+'\n')

def visible(v):
 if isinstance(v,str): return v
 if isinstance(v,list): return ' '.join(visible(x) for x in v)
 if isinstance(v,dict): return ' '.join(visible(x) for k,x in v.items() if k in ['title','text','value','label','items','rows','cells','steps'])
 return ''
test_rows=[]
for c in cases:
 test_rows.append({'id':c['id'],'persona':c.get('persona'),'label':c.get('label'),'user_message':c['message'],
  'history_messages':len(c.get('history',[])),'canonical_accepted':c.get('validation',{}).get('protocolAccepted',False),
  'provider_error':c.get('error'),'total_ms':c['totalMs'],'generation_ms':c.get('generationMs'),'review_ms':c.get('reviewMs'),
  'content_word_count':len(visible(c.get('response',{}).get('content_blocks',[])).split()),
  'question':c.get('response',{}).get('interaction',{}).get('question',''),
  'source':'live/'+c['id']+'.json','judgment_scope':'Technical result; not a completed persona satisfaction score'})
(ROOT/'test-results.json').write_text(json.dumps(test_rows,indent=2)+'\n')
metrics={'main_turns':len(cases),'canonical_accepted':sum(r['canonical_accepted'] for r in test_rows),
 'provider_errors':sum(bool(r['provider_error']) for r in test_rows),'reviewed_turns':sum(bool(c.get('reviewUsage')) for c in cases),
 'median_main_ms':statistics.median(c['totalMs'] for c in cases),'min_main_ms':min(c['totalMs'] for c in cases),'max_main_ms':max(c['totalMs'] for c in cases),
 'routing_decisions':len(routes),'routing_dispositions':{s:sum(r['selection']['disposition']==s for r in routes) for s in ['NONE','SUGGEST','AUTO_OPEN']},
 'workspace_starts':len(workspaces),'workspace_contract_complete':sum(r.get('session',{}).get('state')=='COMPLETE' for r in workspaces),
 'workspace_semantic_issues':['EX-AUTO-A: unsupported three remote days','EX-AUTO-B: general workload/topic scope too definite'],
 'qualification':'Diagnostic sample only. Not a holdout accuracy estimate, real-user study or full release test.'}
(ROOT/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
inventory=json.loads((ROOT/'persona-inventory.json').read_text())
(ROOT/'coverage.json').write_text(json.dumps({'covered':'19 life-stage openings and eight stress patterns; selected 2–4 turn paths and five extra scenarios',
 'completed_full_supplied_test_plan':False,'remaining':['At least two complete runs per persona','Three runs for ambiguous/high-risk personas','20 new randomised personas','Browser end-to-end journey validation','Real participants','Mobile and accessibility sessions','Full prepared objective execution set with approved fixtures'],
 'tests':test_rows,'persona_inventory':inventory},indent=2)+'\n')

def inline(s):
 s=html.escape(s)
 s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s)
 s=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s)
 s=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',r'<a href="\2">\1</a>',s)
 return s
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def md_html(md):
 lines=md.splitlines(); out=[]; i=0
 while i<len(lines):
  s=lines[i].strip()
  if not s: i+=1; continue
  if s.startswith('#'):
   n=len(s)-len(s.lstrip('#')); t=s[n:].strip(); out.append(f'<h{n} id="{slug(t)}">{inline(t)}</h{n}>');i+=1
  elif s.startswith('|'):
   rows=[]
   while i<len(lines) and lines[i].strip().startswith('|'):
    cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
    if not all(re.fullmatch(r':?-+:?',x) for x in cells): rows.append(cells)
    i+=1
   out.append('<div class="table-wrap" tabindex="0"><table><thead><tr>'+''.join('<th scope="col">'+inline(x)+'</th>' for x in rows[0])+'</tr></thead><tbody>')
   for row in rows[1:]:out.append('<tr>'+''.join('<td>'+inline(x)+'</td>' for x in row)+'</tr>')
   out.append('</tbody></table></div>')
  elif re.match(r'^(- |\d+\. )',s):
   tag='ul' if s.startswith('- ') else 'ol';out.append('<'+tag+'>')
   while i<len(lines) and re.match(r'^(- |\d+\. )',lines[i].strip()):
    out.append('<li>'+inline(re.sub(r'^(- |\d+\. )','',lines[i].strip()))+'</li>');i+=1
   out.append('</'+tag+'>')
  elif s.startswith('>'):
   out.append('<blockquote>'+inline(s.lstrip('> '))+'</blockquote>');i+=1
  else:
   paragraph=[s];i+=1
   while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||>|- |\d+\. )',lines[i].strip()):paragraph.append(lines[i].strip());i+=1
   out.append('<p>'+inline(' '.join(paragraph))+'</p>')
 return '\n'.join(out)

CSS='''
:root{color-scheme:light;--ink:#243047;--muted:#5c6678;--purple:#6f43bc;--line:#e6e2ed;--soft:#f6f3fb}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:17px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:#6035a9;text-underline-offset:3px}a:focus-visible,summary:focus-visible,button:focus-visible{outline:3px solid #7950cb;outline-offset:4px}header{padding:16px max(24px,calc((100vw - 1120px)/2));border-bottom:1px solid var(--line);display:flex;gap:20px;align-items:center;flex-wrap:wrap;font-size:14px}header strong{margin-right:auto;color:var(--purple)}main{max-width:1120px;margin:auto;padding:34px 28px 90px}h1{font-size:40px;line-height:1.16;letter-spacing:-1.2px;max-width:900px;margin:20px 0}h2{font-size:27px;line-height:1.3;margin:55px 0 18px;padding-top:14px;border-top:1px solid var(--line)}h3{font-size:21px;line-height:1.4;margin:28px 0 12px}p{margin:14px 0;max-width:1000px}li{margin:9px 0}strong{font-weight:650}.table-wrap{overflow:auto;margin:24px 0;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;min-width:650px;font-size:15px;line-height:1.55}th{text-align:left;background:var(--soft);font-weight:650}th,td{padding:13px 16px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}td:first-child{font-weight:550}blockquote{margin:22px 0;padding:10px 22px;border-left:4px solid #9d7bd5;background:#faf8fd;font-size:19px}code{font-size:.86em;overflow-wrap:anywhere;color:#5b378c}nav.contents{display:flex;gap:10px 24px;flex-wrap:wrap;padding:20px 0;border-bottom:1px solid var(--line);font-size:15px}.facts{display:flex;flex-wrap:wrap;gap:30px;margin:28px 0;padding:22px 0;border-bottom:1px solid var(--line)}.fact b{display:block;font-size:32px;color:var(--purple);line-height:1.2}.fact span{font-size:14px;color:var(--muted)}.notice{padding:15px 18px;background:var(--soft);border-left:3px solid var(--purple);font-size:15px;color:#4f4066}details{border-bottom:1px solid var(--line);padding:14px 0}summary{cursor:pointer;font-weight:600;color:#6035a9}details details{margin-left:20px}small,.muted{color:var(--muted)}.role{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--purple);margin-top:26px}.turn{padding:8px 20px;border-left:2px solid var(--line)}.turn.user{background:#faf8fd}.turn p{margin:9px 0}button{font:inherit;color:#6035a9;border:1px solid var(--line);border-radius:6px;padding:6px 12px;background:#fff;cursor:pointer}footer{margin-top:60px;font-size:14px;color:var(--muted)}@media(max-width:650px){body{font-size:16px}main{padding:22px 18px 60px}h1{font-size:31px}h2{font-size:24px}.facts{gap:22px}header{padding:12px 18px}}@media print{header,nav.contents,button{display:none}main{max-width:none;padding:0}h2{break-after:avoid}table{min-width:0;font-size:10px}body{font-size:11px}h1{font-size:28px}.table-wrap{overflow:visible}a{color:inherit}.facts{break-inside:avoid}}
'''
def page(title,body,extras=''):
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(title)+'</title><style>'+CSS+'</style></head><body><header><strong>YU ZEE / EXPERIENCE REVIEW</strong><a href="Yuzee-Conversational-UX-Audit.html">Assessment</a><a href="Yuzee-UX-Synthetic-Transcripts.html">Fictional tests</a><a href="../Yuzee-UX-Audit-2026-09-19.zip">Download evidence ZIP</a><button onclick="window.print()">Print</button></header><main>'+extras+body+'<footer>19 September 2026 · Evaluation only. No production behaviour changed. Scores are evaluator judgments, not measured customer satisfaction.</footer></main></body></html>'

md=(ROOT/'Yuzee-Conversational-UX-Audit.md').read_text()
toc='<nav class="contents" aria-label="Report sections">'+''.join(f'<a href="#{slug(t)}">{html.escape(label)}</a>' for t,label in [('Verdict','Verdict'),('Scoring: useful, but not false precision','Scores'),('The school conversation, turn by turn','Current journey'),('Is BGE the problem?','BGE'),('Prioritised work','Priorities'),('How to measure satisfaction and word of mouth honestly','Measurement'),('Remaining validation before release','Release tests')])+'</nav>'
facts='<div class="facts"><div class="fact"><b>54/100</b><span>Provisional UX readiness</span></div><div class="fact"><b>51</b><span>Fictional conversation turns</span></div><div class="fact"><b>14</b><span>Real routing decisions</span></div><div class="fact"><b>Unmeasured</b><span>Customer satisfaction</span></div></div>'
body=md_html(md)
body=body.replace('<h2 id="verdict">',facts+'<h2 id="verdict">',1)
(HTML/'Yuzee-Conversational-UX-Audit.html').write_text(page('Yuzee conversational UX assessment',body,toc))

def response_html(p):
 if isinstance(p,str):
  try:p=json.loads(p)
  except ValueError:return '<p>'+html.escape(p)+'</p>'
 if not isinstance(p,dict):return '<p>'+html.escape(str(p))+'</p>'
 out=[]
 for b in p.get('content_blocks',[]):
  if b.get('title'):out.append('<h3>'+html.escape(b['title'])+'</h3>')
  if b.get('text'):out.append('<p>'+html.escape(b['text']).replace('\n','<br>')+'</p>')
  if b.get('items'):
   out.append('<ul>')
   for item in b['items']:out.append('<li><strong>'+html.escape(item.get('title',''))+'</strong> '+html.escape(item.get('text','')).replace('\n','<br>')+(' <small>'+html.escape(str(item.get('value')))+'</small>' if item.get('value') else '')+'</li>')
   out.append('</ul>')
  if b.get('rows'):
   out.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+html.escape(c.get('label',''))+'</th>' for c in b.get('columns',[]))+'</tr></thead><tbody>')
   for row in b['rows']:out.append('<tr>'+''.join('<td>'+html.escape(str(c.get('value','')))+'</td>' for c in row.get('cells',[]))+'</tr>')
   out.append('</tbody></table></div>')
 q=p.get('interaction',{})
 if q.get('question'):out.append('<p><strong>Question:</strong> '+html.escape(q['question'])+'</p>')
 if q.get('options'):
  out.append('<ul>')
  for o in q['options']:out.append('<li>'+html.escape(str(o.get('label',o.get('text',''))))+' '+html.escape(str(o.get('description','')))+'</li>')
  out.append('</ul>')
 return '\n'.join(out)

trans=['<h1>Fictional test conversations</h1><p>51 recorded assistant turns. Expand a record to inspect its supplied history, exact user message and returned visible content. Raw JSON includes original and reviewed answers, controls, usage and validation. A technically accepted response may still contain a substantive defect.</p><p class="notice">No saved personal conversations are included. Most records are diagnostic portions of a journey, not completed persona evaluations. A rejected draft shown here would not be an accepted application response.</p>']
for c in cases:
 accepted=c.get('validation',{}).get('protocolAccepted',False)
 trans.append('<details id="'+c['id']+'"><summary>'+c['id']+' · '+html.escape(c.get('label',''))+' · '+('Accepted JSON' if accepted else 'Rejected JSON')+' · '+str(round(c['totalMs']/1000,1))+'s</summary>')
 trans.append('<p><a href="../ux-audit/live/'+c['id']+'.json">Raw response and validation</a></p>')
 if c.get('history'):
  trans.append('<details><summary>Supplied conversation history</summary>')
  for m in c['history']:trans.append('<div class="role">'+html.escape(m['role'])+'</div><div class="turn">'+(response_html(m['content']) if m['role']=='assistant' else '<p>'+html.escape(str(m['content']))+'</p>')+'</div>')
  trans.append('</details>')
 trans.append('<div class="role">User</div><div class="turn user"><p>'+html.escape(c['message'])+'</p></div><div class="role">Assistant '+('draft — rejected' if not accepted else '')+'</div><div class="turn">'+response_html(c.get('response',{}))+'</div></details>')
(HTML/'Yuzee-UX-Synthetic-Transcripts.html').write_text(page('Yuzee fictional UX test evidence','\n'.join(trans)))

readme='''# Yuzee UX audit — 19 September 2026

Open output/html/Yuzee-Conversational-UX-Audit.html for the assessment and output/html/Yuzee-UX-Synthetic-Transcripts.html for the fictional transcripts.

The Markdown report, score definitions, issues, metrics, coverage and raw fictional responses are in output/ux-audit.

This is a diagnostic baseline, not completion of the full supplied release plan. No production prompt or UI fixes were applied. Real-user satisfaction, retention and referral rates were not measured. Personal saved conversations and API credentials are excluded.

Reproduction scripts require the existing Yuzee-AI-Lab repository, configured Gemini access and pinned local BGE assets. Executing them uses API credits. Use only fictional cases. audit-conversation-ux.ts uses the current assembled prompt plus generic review; it does not reproduce every production request stage. Do not change source prompts between baseline and repeat without recording their hash.

All new records were generated against prompt SHA-256 178fc96c6ed1d330d463e97030bd82e85e1f3afb668e3d89cf2ac45cfbcf73ff.

The issue register contains proposed changes and acceptance tests. It does not claim those changes are implemented. The ZIP manifest records the SHA-256 of each packaged file.
'''
(ROOT/'README.md').write_text(readme)
checks=ROOT/'checks';checks.mkdir(exist_ok=True)
for name in ['objective-tests.log','experience-tests.log','prompt-tests.log','bge-tests.log']:
 shutil.copyfile(REPO/'tmp/ux-audit'/name,checks/name)
files=[HTML/'Yuzee-Conversational-UX-Audit.html',HTML/'Yuzee-UX-Synthetic-Transcripts.html']
files += sorted(p for p in ROOT.glob('*') if p.is_file())
files += sorted((ROOT/'live').glob('*.json')) + sorted(checks.glob('*.log'))
files += [REPO/'scripts'/f for f in ['audit-conversation-ux.ts','audit-routing-ux.ts','audit-workspace-ux.ts','build-ux-audit-report.py']]
files=[p for p in files if p.name!='manifest.json']
manifest=[{'path':str(p.relative_to(REPO)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
bundle=REPO/'output/Yuzee-UX-Audit-2026-09-19.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files+[ROOT/'manifest.json']:z.write(p,p.relative_to(REPO))
 z.writestr('README.md',readme)
assert len(cases)==51 and metrics['canonical_accepted']==50 and len(routes)==14
assert scorecard['product_readiness']['weighted_total']==54
assert scorecard['school_journey']['weighted_total']==59.3
assert sum(x[1] for x in score_rows)==100 and sum(x[1] for x in journey_rows)==100
assert all(p['session']['state']=='COMPLETE' for p in workspaces)
with zipfile.ZipFile(bundle) as z:
 assert z.testzip() is None
 assert not any('recent-conversations' in x or '.env' in x or 'data/conversations' in x for x in z.namelist())
print(json.dumps({'metrics':metrics,'zip_bytes':bundle.stat().st_size,'packaged_files':len(files)+2,'readiness_score':54,'school_score':59.3},indent=2))
