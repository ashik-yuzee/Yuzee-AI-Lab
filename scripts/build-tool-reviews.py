"""Build individually reviewed runtime snippets and a browsable review; no provider calls."""
import json, pathlib, html, re
root=pathlib.Path(__file__).resolve().parents[1]
def read(path): return json.loads((root/path).read_text())
def write(path,data): (root/path).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
registry=read('src/routing/microtools.json')
plan=read('docs/plans/microtool-trigger-plan.json')
source={t['id']:t for t in plan['tools']}
contracts=read('src/routing/learningContracts.json')
profiles={t['id']:t['profile'] for t in contracts}
previous_path=root/'docs/plans/microtool-individual-review.json'
previous={t['id']:t for t in json.loads(previous_path.read_text())['tools']} if previous_path.exists() else {}
reviews=[]
for line in (root/'docs/plans/microtool-individual-reviews.txt').read_text().splitlines():
    id,issue,logic,missing,example,boundary,output=line.split('|')
    t=source[id]
    current=next(t for t in registry if t['id']==id)
    original=previous.get(id,{}).get('previous_runtime_prompt',current['mini_prompt'])
    sections=output.split('; ')
    snippet='\n'.join([
        f'INDIVIDUAL TASK LOGIC v4 — {id}: {t["name"]}.',
        f'Purpose: {t["purpose"]}',
        f'Decision method: {logic}',
        f'When evidence or context is missing: {missing}',
        f'Scope boundary: {boundary}',
        f'Output emphasis: {output}. These are content priorities, not additional JSON fields. Select and combine relevant learning-depth ingredients; avoid duplicate headings and do not make a long lesson for a small factual question.',
        f'Illustrative teaching situation, not evidence or an instruction to reuse this example: {example}',
        'Use a flexible counselling sequence: direct answer, plain meaning, why it matters, how it works, useful examples, application, relevant unknowns and next action or practice. Select and combine only what helps; never require every section. Simple checks need less space than learning a new skill. Explain choices through worked examples, not audit language.',
        'In display text use Explicitly stated, Reasonably derived and Not enough information where helpful; these are source-relationship descriptions, not verified status or new JSON enum values. Use ordinary words and define specialist terms. For costs and pay calculate only supplied figures or show a formula with unknowns, never invented percentages, fees or working hours.',
        'Adapt to the actual person and known goal without assuming age, literacy, family situation or starting skill. Define unfamiliar terms before using them. Explain the reason behind advice and show a useful example when it aids understanding.',
        'Use existing context before asking. If missing information changes the decision, ask only the most useful question and explain why; otherwise give useful conditional guidance first. Honour short-answer, correction, stop and no-follow-up requests.',
        'Treat user reports, independently supported facts, derived interpretations and hypothetical examples distinctly. Preserve provenance, dates and relevant scope. Never imply a lookup, external action, source verification or service availability that has not actually occurred.',
        'Where sources conflict, show the conflict and its consequence rather than silently choosing. If space is limited, prioritise the direct answer, decision-critical reasoning and caveats; explicitly identify unfinished requested scope and offer continuation. Do not claim an incomplete or cut-off response is complete.',
        'Use only the canonical response schema and supported display blocks. A next-tool reference describes a scope boundary, not permission to execute a chain of tools. The master counselling prompt remains authoritative.'
    ])
    current['mini_prompt']=snippet
    reviews.append(dict(id=id,name=t['name'],family=id.split('_')[0],profile=profiles[id],
        issue=issue,decision_logic=logic,missing_data_logic=missing,scope_boundary=boundary,
        output_emphasis=sections,teaching_example=example,required_inputs=t['required_inputs'],
        optional_inputs=t['optional_inputs'],information=t['output_fields'],evidence_rule=t['evidence_rule'],
        data_dependencies=t['api_data_needs'],previous_runtime_prompt=original,
        implementation_status='Individual snippet integrated; data retrieval and semantic routing are not certified by this review.',
        validation_status='Static inventory and assembly checks only until separately recorded live evaluation.',
        reviewed_prompt=snippet))
expected={t['id'] for t in registry}-{'CORE_001','CORE_002'}
assert len(reviews)==103 and {t['id'] for t in reviews}==expected
assert len(set(t['decision_logic'] for t in reviews))==103
# Curriculum evidence needs a skill-map explanation, not the general course profile.
for c in contracts:
    if c['id']=='INST_004': c['profile']='skill_map'
for t in reviews:
    if t['id']=='INST_004': t['profile']='skill_map'
write('src/routing/microtools.json',registry)
write('src/routing/learningContracts.json',contracts)
write('docs/plans/microtool-individual-review.json',dict(version=4,reviewed_at='2026-09-16',user_facing_count=103,internal_excluded=['CORE_001','CORE_002'],tools=reviews))
# Keep the older plan honest about the current local implementation.
for t in plan['tools']:
    review=next((r for r in reviews if r['id']==t['id']),None)
    if review:
        t.setdefault('source_mini_prompt',t['mini_prompt'])
        t['mini_prompt']=review['reviewed_prompt']
        t['individual_review_version']=4
        t['individual_review_issue']=review['issue']
        t['individual_review_logic']=review['decision_logic']
        t['implementation_status']=review['implementation_status']
        t['learning_profile']=review['profile']
plan['status']='LOCAL_SNIPPETS_REVIEWED_RETRIEVAL_AND_ROUTING_NOT_CERTIFIED'
write('docs/plans/microtool-trigger-plan.json',plan)

e=html.escape
cards=[]
for t in reviews:
    cards.append(f'''<article id="{t['id']}" data-family="{t['family']}" data-search="{e(' '.join([t['id'],t['name'],t['issue'],t['decision_logic']]).lower(),quote=True)}">
    <div class="eyebrow">{t['id']} · {e(t['profile'].replace('_',' '))}</div><h2>{e(t['name'])}</h2>
    <p class="issue"><strong>What needed improving</strong><br>{e(t['issue'])}</p>
    <h3>How it should reason</h3><p>{e(t['decision_logic'])}</p>
    <h3>When information is missing</h3><p>{e(t['missing_data_logic'])}</p>
    <h3>What the user should see</h3><ol>{''.join('<li>'+e(s)+'</li>' for s in t['output_emphasis'])}</ol>
    <div class="example"><strong>Illustrative teaching situation</strong><p>{e(t['teaching_example'])}</p><small>This describes expected behaviour. It is not a recorded AI answer or verified real-world claim.</small></div>
    <h3>Keep the scope clear</h3><p>{e(t['scope_boundary'])}</p>
    <details><summary>Inputs, data dependencies and before/after prompt</summary><p><strong>Resolve from context:</strong> {e(t['required_inputs'])}</p><p><strong>Optional context:</strong> {e(t['optional_inputs'])}</p><p><strong>Data needed:</strong> {e(t['data_dependencies'])}</p><p><strong>Information to cover where relevant:</strong> {e(t['information'])}</p><h4>Previous snippet</h4><pre>{e(t['previous_runtime_prompt'])}</pre><h4>Updated snippet</h4><pre>{e(t['reviewed_prompt'])}</pre></details></article>''')
families=sorted({t['family'] for t in reviews})
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yuzee — 103 individual tool reviews</title><style>
:root{font-family:Arial,sans-serif;color:#20324b;background:#f3f6fa;line-height:1.65}*{box-sizing:border-box}body{margin:0}main{max-width:1060px;margin:auto;padding:36px 24px 72px}h1{font-size:clamp(30px,5vw,44px);line-height:1.15;letter-spacing:-1px;margin:12px 0 22px}h2{font-size:24px;margin:7px 0 20px}h3{font-size:17px;margin:23px 0 5px}p{margin:8px 0 15px}.eyebrow{font-size:13px;font-weight:700;color:#056589;letter-spacing:1px}.intro,.note,article{background:white;border:1px solid #dbe3ed;border-radius:18px;padding:28px;margin-bottom:24px}.note{border-left:5px solid #6478ad}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.stats div{flex:1;min-width:130px;background:#e8f5f8;border-radius:12px;padding:14px 20px}.stats b{font-size:28px;display:block;color:#075b78}.issue{background:#fff7e7;border-radius:10px;padding:16px}.example{background:#eef7f8;padding:18px;border-radius:12px}small{color:#53617a}.controls{padding:18px;background:#f3f6fa;border:1px solid #dbe3ed;border-radius:12px;margin:24px 0;display:flex;gap:14px;flex-wrap:wrap;align-items:end}.controls label{flex:1;min-width:180px;font-size:14px;font-weight:bold}input,select{font:inherit;border:1px solid #94a8be;border-radius:8px;padding:12px;width:100%;background:white;color:#20324b;display:block;margin-top:5px}button{font:inherit;border:1px solid #94a8be;background:white;color:#075b78;padding:12px;border-radius:8px;cursor:pointer}a{color:#075b78;text-underline-offset:3px}a:focus-visible,input:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #4d83d5;outline-offset:3px}summary{cursor:pointer;color:#075b78;font-weight:bold}details{border-top:1px solid #dbe3ed;padding-top:18px;margin-top:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 Arial;background:#f4f6fa;padding:18px;border-radius:8px}ol{padding-left:24px}li{padding:3px 0}article{scroll-margin-top:20px}article[hidden]{display:none}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;vertical-align:top;border-bottom:1px solid #dbe3ed;padding:10px;min-width:125px}footer{color:#53617a}@media(max-width:600px){main{padding:22px 14px}.intro,.note,article{padding:20px}.controls{padding:14px}.stats div{min-width:95px;padding:12px}.stats b{font-size:25px}}@media print{body{background:white}.controls,.no-print{display:none}main{max-width:none;padding:0}article[hidden]{display:block}article{break-inside:avoid;border-radius:0}h3{break-after:avoid}details{display:none}.intro,.note{break-inside:avoid}a{color:inherit}}
</style></head><body><main><header class="intro"><div class="eyebrow">YUZEE · INDIVIDUAL LOGIC REVIEW · 16 SEPTEMBER 2026</div><h1>Every tool needs a different kind of help.</h1><p>All <strong>103 user-facing snippets now have an individual logic update</strong>. Previously, they shared richer teaching guidance but most still used the original short task instructions. This review strengthens each tool's reasoning, handling of missing information, teaching example and scope.</p><div class="stats"><div><b>103 / 103</b>Individually reviewed</div><div><b>103 / 103</b>Runtime snippets updated</div><div><b>2</b>Internal tools kept separate</div></div><p>Each entry below shows the problem, the intended improvement and its before/after instructions. The original master prompt remains authoritative.</p><p class="no-print"><a href="Yuzee-Learning-Experience-Examples.html">Earlier recorded learning examples</a> · <a href="Yuzee-Microtool-Trigger-Report.html">Wider trigger and rollout report</a> · <a href="Yuzee-Tool-Review-Validation.html">Validation results and limits</a></p></header>
<section class="note"><h2>What is updated — and what is still unproven</h2><p><strong>Implemented locally:</strong> all 103 individual snippets include flexible counselling guidance and are used by the existing server-owned selection path. Short routing descriptions remain separate from the longer teaching instructions. Internal control tools are excluded.</p><p><strong>Not a claim of full release readiness:</strong> these updates do not connect missing provider, employer or market data sources, prove MiniLM can select every tool reliably, or certify every Gemini answer. Examples in each entry are design scenarios. The linked validation page records the checks actually performed.</p><p>The assistant must give useful conditional guidance when data is missing, never pretend it fetched facts, and keep “unknown” separate from “not eligible”, “not taught” or “not available”.</p></section>
<section class="intro"><h2>The counselling approach across all tools</h2><ol><li>Answer the actual question using known context; define unfamiliar terms.</li><li>Explain how the answer was reached and what it means for the person's decision.</li><li>Use worked examples that show facts, choices, reasons and checks. Learning needs more explanation; simple eligibility and cost checks need fewer sections.</li><li>Use plain evidence wording where helpful: Explicitly stated, Reasonably derived and Not enough information. Keep user reports and illustrations distinct; these labels do not mean independently verified.</li><li>Ask only a question that changes the answer; respect short answers, corrections and stopping.</li><li>Use readable sections, comparisons or steps in the existing response boxes. Avoid repetitive cards and unsupported scores.</li><li>If output space is insufficient, preserve the direct answer and important caveats, identify what remains, and offer continuation. A cut-off result is never a complete report.</li></ol></section>
<div class="controls"><label>Find a tool or issue<input id="search" type="search" placeholder="Try COURSE_005, evidence, fees…"></label><label>Tool family<select id="family"><option value="">All families</option>'''+''.join(f'<option>{f}</option>' for f in families)+'''</select></label><button id="reset" type="button">Show all</button></div><p id="count" role="status" aria-live="polite">Showing all 103 tools</p><div id="tools">'''+''.join(cards)+'''</div><p id="empty" hidden>No tools match. Try a tool ID, name or a shorter phrase.</p><footer>Review scope: 105 registry entries; CORE_001 and CORE_002 are internal, leaving 103 user-facing tools. No new routing trigger, data connector, tool chain or external action was added.</footer></main><script>
const search=document.getElementById('search'),family=document.getElementById('family'),cards=[...document.querySelectorAll('article')];function filter(){const q=search.value.trim().toLowerCase();let n=0;for(const c of cards){const show=(!family.value||c.dataset.family===family.value)&&(!q||c.dataset.search.includes(q));c.hidden=!show;if(show)n++}document.getElementById('count').textContent=`Showing ${n} of 103 tools`;document.getElementById('empty').hidden=n!==0}search.addEventListener('input',filter);family.addEventListener('change',filter);document.getElementById('reset').addEventListener('click',()=>{search.value='';family.value='';filter()});function revealHash(){const id=decodeURIComponent(location.hash.slice(1));const c=document.getElementById(id);if(c&&c.tagName==='ARTICLE'){search.value='';family.value='';filter();c.scrollIntoView()}}addEventListener('hashchange',revealHash);revealHash();
</script></body></html>'''
(root/'output/html/Yuzee-103-Tool-Logic-Review.html').write_text(page)
print('Updated 103 runtime snippets, 103 individual review records and the searchable HTML review.')
