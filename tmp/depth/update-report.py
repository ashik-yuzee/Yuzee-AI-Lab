from pathlib import Path
import json
p=Path('docs/plans/Yuzee-Microtool-Trigger-Plan.md');s=p.read_text()
a=s.index('Status:');b=s.index('\n\n',a)
s=s[:a]+'Status: registry-wide teaching guidance and bounded explanation review implemented locally, 16 September 2026. All 105 registry entries are mapped; 103 user-facing tasks receive a task-specific depth contract and two remain internal. Full evidence retrieval, calibrated routing and production-wide evaluation remain incomplete.'+s[b:]
s=s.replace('The other 103 tool contracts, full-registry evaluations, new data adapters and UI detail-action integration remain implementation work.', 'All 105 tools now have an explicit teaching profile with source information requirements and evidence guidance. This is prompt-level coverage, not a deterministic guarantee of semantic completeness. Full-registry live evaluations, new data adapters and UI detail-action integration remain implementation work.')
s=s.replace('A selected micro-prompt is passed directly into Gemini’s request;', 'A selected micro-prompt and its teaching contract are passed directly into Gemini’s request;')
s=s.replace('| Valid JSON with shallow or unsupported content | Teaching rules and manual quality review | Per-tool semantic and evidence checks; schema validity alone is insufficient |','| Valid JSON with shallow or unsupported content | Distinct teaching structures and one bounded AI review of substantive explanations | Independent evidence verification, comprehension testing and per-tool semantic checks; JSON validity alone is insufficient |')
a=s.index('## Targeted implementation and verification');b=s.index('## Complete tool inventory',a)
s=s[:a]+'''## Deeper explanations across the registry

The two supplied examples identify the correct problem: a short skill label, one example and a warning do not teach someone how the capability works. The implementation now separates meaning, process, examples, judgement, practice and evidence. It also removes conflicting defaults that previously encouraged only a few short items or a single example.

All 105 registry entries have explicit depth metadata. The 103 user-facing tasks receive the relevant source information fields, required context and evidence rule plus a matching teaching structure. CORE_001 and CORE_002 remain silent internal tasks. Shared teaching guidance applies in ordinary chat and when MiniLM abstains, without requiring the user to type “more detail” or select a longer display mode.

A skill explanation covers all 13 requested dimensions, grouped into eight readable sections:

| Visible section | What it must teach |
|---|---|
| What it means and why it matters | Definition, practical meaning and importance |
| How you actually do it | Process, tools, decisions, reasons and when to pause |
| A simple example | Familiar everyday analogy and its limits |
| A workplace example | Separate realistic situation, problem, decisions, action, plausible result and actual tasks |
| What good work looks like | Observable quality criteria, mistakes and consequences |
| How to practise and improve | Exercise, output, checking, feedback and progression |
| How to check a course teaches it | Learning outcomes, practice, judgement, assessment, feedback and tools |
| What completion does and does not prove | Distinguish attendance, verified assessment, performance scope and workplace capability |

The other response structures are specific to the task: courses, comparisons, requirements, costs, roles, skill connections, plans, market signals, organisations, opportunities, evidence and exploration. A comparison explains criteria and trade-offs; a cost answer shows arithmetic and unknown charges; a market answer distinguishes a signal from a personal outcome. These are not the same generic paragraph with different labels.

Full teaching structures do not apply to explicit one-sentence/list-only requests, greetings, closure, a simple fact, an urgent safety response, a narrow correction or a small requested activity. A follow-up should explain the misunderstood layer, not repeat the entire previous lesson. Age and family role are not evidence of understanding or ability. A missing referent calls for one clarification, not an invented lesson.

## Explanation review and clear presentation

Substantive structured explanations receive one additional AI review before accepted JSON is emitted. It checks the current request and recent conversation against the candidate explanation, focusing on unsupported additions, inferred competence, course-completion claims, misleading comparisons, invented fee conditions and evidence gaps. It edits only content blocks: interaction, service actions and user state remain application-controlled. The reviewed output still passes the canonical schema and interaction validation.

This is an additional model check, not independent factual verification. It does not search, certify course facts or guarantee every statement is correct. Its context is the current request and up to ten recent conversation messages; important older evidence still requires durable references and retrieval. The review uses a bounded 30-second request. A failed, truncated or structurally incomplete review is withheld with a retry message. Safe empty-status normalization repairs the provider schema’s null representation without inventing a semantic status. Token usage includes both generation calls; review time adds to response latency.

The interface shows “Reviewing the explanation” while that check runs, then validates the display format. It never shows private reasoning. Answers with at least five titled sections provide an “In this answer” navigation list. All teaching content stays visible and links move to the relevant section. Text-section titles are semantic headings, and navigation targets are unique across conversation turns. Short answers do not acquire an unnecessary navigation box.

Initial live testing found unsupported inferences despite valid JSON: assumed absence of course feedback, invented payment rules, accepted portfolio formats and inflated transferable-skill claims. These cases informed the review rules and were rerun. A review-generated null status also caused a legitimate schema rejection; canonical empty-status handling was added and tested. The record preserves initial failures instead of treating the first valid JSON as success.

## Verification and remaining limits

Static checks cover all 105 mappings, all 103 selected-task instruction paths, distinct profiles, ordinary-chat teaching guidance, rendered lesson text, navigation targets, multiple-answer anchor uniqueness, concise-answer simplicity, review-only content editing, state protection, malformed/compressed review rejection and provider usage aggregation. Existing routing, token-budget, Oala, interaction, streaming and output-rendering checks have also been run. The production build passes with its existing large-bundle warning.

The final live scenario set exercises skill explanations, a different communication skill, course units, comparisons, entry evidence, cost arithmetic, workplace tasks, skill transfer, career planning, market interpretation, organisation roles, work-based learning, prior-learning evidence, exploration, ordinary chat without Oala, brevity, closure and missing context. These are synthetic scenario tests using Gemini, not a complete live test of every tool or proof of comprehension across every age group. Test selections are supplied through the validated advisory route when applicable; this does not establish MiniLM precision. The actual outputs are available in the accompanying examples gallery.

Remaining work: independently sourced evidence retrieval; all-tool behavioural evaluation; calibrated routing coverage; persistent entity and source references; automated semantic completeness checks; recovery for output/context limits; and testing with real learners. The depth contracts are instructions plus a bounded review, not a guarantee that every conceivable scenario is solved. Review adds latency and model usage, so production release should measure both quality and cost.

'''+s[b:]
p.write_text(s)
jp=Path('docs/plans/microtool-trigger-plan.json');j=json.loads(jp.read_text());contracts={c['id']:c for c in json.loads(Path('src/routing/learningContracts.json').read_text())};profiles=json.loads(Path('src/routing/learningProfiles.json').read_text())
for t in j['tools']:
 c=contracts[t['id']];t['learning_profile']=c['profile'];t['learning_sections']='\n\n'.join(title+': '+body for title,body in profiles[c['profile']]) or 'Internal context/routing operation; no user-facing lesson.'
 t['implementation_status']='Depth contract implemented locally; source required inputs, information fields and evidence rule are included in the selected instruction. Data retrieval and full live per-tool evaluation remain incomplete.' if c['profile']!='internal' else 'Internal only; excluded from the user-facing routing index.'
jp.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
bp=Path('tmp/reports/create-trigger-report.mjs');b=bp.read_text().replace("purpose:'Purpose',", "learning_profile:'Active explanation structure',learning_sections:'Active teaching sections',purpose:'Purpose',")
b=b.replace('Targeted updates · full rollout planned','Teaching contracts implemented · wider rollout remains').replace('Plan + targeted implementation','Plan + teaching implementation')
bp.write_text(b)
