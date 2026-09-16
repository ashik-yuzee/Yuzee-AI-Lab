from pathlib import Path
import json
p=Path('docs/plans/Yuzee-Microtool-Trigger-Plan.md');s=p.read_text()
s=s.replace('Status: proposal and complete registry inventory, 16 September 2026. No runtime prompt, router or UI behaviour changed by this planning pass.','Status: complete registry plan plus targeted learning-quality implementation, 16 September 2026. Token-budget safeguards, shared teaching guidance and two specialist snippets have been updated locally. Full-registry rollout remains proposed.')
s=s.replace('otherwise retain the selected UI/default mode.', 'otherwise choose the shortest complete explanation that addresses the learner’s demonstrated understanding and decision needs, using the UI mode as a pacing preference rather than a hard content cap. Do not require the learner to know which follow-up to ask before explaining an unfamiliar concept.')
s=s.replace('When depth was explicitly requested, complete', 'When depth was requested or needed to explain an unfamiliar concept or consequential trade-off, complete')
s=s.replace('- Per-turn depth: overview, focused expansion or full requested scope; do not automatically expand adjacent topics.', '- Per-turn depth: overview, focused expansion or full relevant scope. Respond proactively to unfamiliar terminology, misconceptions and uncertainty, without assuming ability from age or family role. Explain the active topic deeply enough to be useful; do not automatically expand unrelated topics.')
s=s.replace('- “Tell me more about the units” after selecting a course: COURSE_005 with that course/version; summary, relevant units, core/elective status, evidence-supported skills and known prerequisites. Retain the current goal. Missing syllabus means unknown, not invented contents from unit titles.', '- “Explain the units” after selecting a course: COURSE_005 resolves the course/version and explains what the relevant subjects mean, how supported learning activities connect to the person’s goal, what they would practise, and what competent performance looks like. Use one clearly labelled worked example when it helps a beginner. Distinguish a skill being mentioned, taught, practised, assessed and personally demonstrated. Missing syllabus means the actual curriculum is unknown; never fill it with “typical units.” See the worked example below.')
s=s.replace('- No operational code, main prompt, threshold or response mode was changed in this planning pass. Full-registry evaluations, rewritten snippets, new data adapters and UI detail-action integration remain implementation work.', '- Since the planning pass, targeted runtime changes add an explicit MiniLM token check, shared teaching guidance, improved COURSE_005 and SKILL_009 snippets and honest output-limit messaging. The original master prompt and similarity thresholds remain unchanged. The other 103 tool contracts, full-registry evaluations, new data adapters and UI detail-action integration remain implementation work.')
addition='''## Input limits and complete answers

MiniLM chooses a candidate task; Gemini writes the answer. These are different jobs with different limits. A selected micro-prompt is passed directly into Gemini’s request; it is not embedded and compressed into MiniLM’s input budget. The routing index contains short task descriptions, not the complete specialist instructions.

The claim “trained with a 256-token limit” is inaccurate for the model used here. The official all-MiniLM-L6-v2 model card reports 128-token fine-tuning sequences and a default Sentence Transformers cutoff of 256 word pieces. The installed Xenova JavaScript tokenizer specifies 512 as its maximum, and the model configuration has 512 positions. These numbers describe different settings; none specifies how long a Gemini answer can be. Sources: [official model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), [Sentence Transformers configuration](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/blob/main/sentence_bert_config.json), [Xenova tokenizer configuration](https://huggingface.co/Xenova/all-MiniLM-L6-v2/raw/main/tokenizer_config.json), [Xenova model configuration](https://huggingface.co/Xenova/all-MiniLM-L6-v2/blob/main/config.json).

Local audit: the supplied “190 words” passage contains 167 whitespace-separated words and 188 tokenizer tokens, including special tokens. All 103 eligible routing descriptions fit; the longest is 85 tokens. A synthetic long input produced 663 tokens without truncation and 512 with the installed tokenizer’s default truncation enabled. Words are not a safe substitute for tokens, especially for punctuation, unfamiliar words and different languages.

Implemented safeguard: count the complete routing text with the actual tokenizer before embedding. The application now deliberately uses a conservative 256-token routing budget including special tokens. Above that budget, skip the optional MiniLM selection and preserve the full question for Gemini. Reject an oversized catalogue description during index preparation rather than silently embedding a prefix. Existing timeout and ordinary-counsellor fallbacks remain available. The 256 budget is an application choice, not a claim about the model’s training length or an optimum proven for every language.

For future PDF retrieval, use token-aware chunks with document/page/section references and controlled overlap, then retrieve evidence relevant to the actual question. Preserve exceptions and qualifications that span chunks. Do not embed one long PDF and assume its tail was considered, and do not independently route chunks and assume their winners represent the whole request. This document retrieval layer is a separate implementation task.

| Limit or failure | Current behaviour | Further work |
|---|---|---|
| MiniLM input above 256 tokens | Abstain from optional routing; keep the complete question for Gemini | Evaluate multilingual and long-context routing coverage |
| Routing model cold, unavailable or slow | Continue with the main counsellor | Measure real-device coverage and latency |
| Specialist instruction length | Full selected server-owned snippet goes to Gemini, outside the embedding budget | Budget context and retrieved evidence for the selected Gemini model |
| Gemini output reaches MAX_TOKENS | Withhold incomplete structured output and show a retry message | Bounded retry or separately validated continuation, with clear remaining scope |
| Request is larger than a useful single answer | Guidance asks for a complete useful portion and an honest statement of what remains | Durable section completion and continuation tracking |
| Old conversation context is summarised | Existing context compression remains separate from routing | Stable entity/evidence references; full-question retention does not guarantee all historical detail survives |
| Valid JSON with shallow or unsupported content | Teaching rules and manual quality review | Per-tool semantic and evidence checks; schema validity alone is insufficient |

The live output-limit test deliberately requested a 128-token Gemini output budget. It emitted MAX_TOKENS and no accepted structured answer. Changing Standard to Detail does not automatically solve this configured ceiling. Automatic recovery and full input-context budget management are not implemented by this patch.

## Teaching quality and a stronger example

The product’s value should be evidence connected to a person’s real decision, with explanations they can use. Length is an outcome of that work, not the quality target. Someone unfamiliar with a subject may not know that they should ask about assessment, practice or the difference between completing training and demonstrating a skill.

| A weak answer | A useful counselling answer |
|---|---|
| Lists “data analysis” as a skill | Explains the task, a concrete example, how to check the result and its relevance |
| Lists units from a title | Uses a current unit guide; otherwise separates a hypothetical example from unknown course facts |
| Says a course makes the learner job-ready | Separates exposure, practice, assessment and actual evidence of the learner’s performance |
| Adds more headings and cards | Explains the connection or trade-off the learner was missing |
| Claims an option is fastest or most recognised | Supports the comparison with evidence and criteria, or says it cannot yet be established |
| Repeats the full answer after confusion | Explains the misunderstood layer with a different concrete example |
| Asks another broad intake question | Reuses known context and asks only for the missing input that changes the answer |

**Illustrative response — not a real course assessment.** Assume the user wants to return to office work, can type lists in a spreadsheet, and has supplied a fictional excerpt describing a compulsory data-cleaning unit and an elective reporting unit.

> These units develop two different abilities: making information reliable, then explaining what it means. For your office-work goal, the first is especially useful when handling customer records.
>
> **Data accuracy:** imagine the same customer appears twice, once as “M. Lee” and once as “Morgan Lee.” Deleting one row just because the names look similar could remove a different person. A careful approach is to compare identifiers, flag uncertain matches and keep a record of changes. A good result is a clean list whose changes you can explain—not simply fewer rows. This is an illustrative task, not a confirmed assessment from a real course.
>
> **Reporting:** a pivot table groups entries and calculates a summary—for example, enquiries by category. But a correct total can still mislead if some enquiries were never recorded. Good reporting explains both the pattern and the data’s limits.
>
> Your supplied excerpt includes a cleaned dataset and an explanation of checks, which gives you something concrete to practise and demonstrate within that exercise. Before choosing an actual course, check whether you receive feedback on this work. The excerpt does not establish workload or prerequisites. Completing either unit would not, by itself, prove that you can handle every office task.

This response adds teaching, judgement and a decision criterion. It does not promise exclusive knowledge or pretend an ordinary example is a proprietary insight. With a simple factual question or an explicit one-sentence request, the correct answer may still be one sentence.

Presentation: put the useful conclusion first, followed by the example or comparison that earns its space. Keep evidence gaps next to affected claims. Use existing text, list or comparison blocks; do not create a separate large box for every skill. Optional practice and expansion can follow, but essential explanations must not be hidden behind repeated “learn more” clicks. Avoid mandatory quizzes and automatic follow-up forms when the person only asked for an explanation.

## Targeted implementation and verification

Implemented locally: actual-token preflight before MiniLM embedding; a token-budget abstention that does not disable later routing; retention of the full current question for Gemini; shared guidance for appropriate teaching depth; revised COURSE_005 and SKILL_009 specialist instructions; evidence-specific course examples; and corrected output-limit recovery wording. No change to the original master prompt file, routing thresholds or separate concept app.

Verification completed: 26 routing integration checks; actual cached-tokenizer checks for the 256/257 boundary, dense text below the character cutoff, default 512 truncation, all 103 indexed descriptions and invalid token counts; 10 Oala checks; 35 experience checks plus persistence tests; 85 output-review checks; and production build. The build retains its existing large-bundle warning.

Live review initially found two substantive failures despite valid JSON: the missing-syllabus answer listed assumed “typical units,” and the supplied-excerpt answer lacked a worked example. Instructions were tightened and the two specialist snippets updated. The output-limit case correctly withheld incomplete JSON. Final course, skill and brevity results are recorded in the accompanying local test evidence; these are targeted synthetic checks, not a full-registry or population-wide evaluation.

Release standard proposed for every specialist: answer the real question, teach unfamiliar concepts, preserve user constraints, ground factual claims, distinguish examples from facts, explain consequential trade-offs and give a feasible decision or next step. Score each of those seven dimensions 0 (missing or wrong), 1 (partial) or 2 (clear and sufficient). Target at least 12/14 with no zero, no invented evidence or unavailable-action claims, and no violation of explicit brevity or stop instructions. This rubric is proposed; automated scoring and acceptance gates for all tools are still to be built. Test both novice and experienced phrasing and ask real users what they understood and would do next.

'''
s=s.replace('## Complete tool inventory and proposed rollout',addition+'## Complete tool inventory and proposed rollout')
p.write_text(s)
jp=Path('docs/plans/microtool-trigger-plan.json');j=json.loads(jp.read_text());runtime={t['id']:t for t in json.loads(Path('src/routing/microtools.json').read_text())}
for t in j['tools']:
 if t['id'] in ('COURSE_005','SKILL_009'):
  t['source_mini_prompt']=t.get('source_mini_prompt',t['mini_prompt'])
  t['mini_prompt']=runtime[t['id']]['mini_prompt']
  t['implementation_status']='Specialist instructions updated locally on 16 September 2026; targeted live checks performed. Full contract metadata, evidence adapters and complete rollout remain planned.'
jp.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
bp=Path('tmp/reports/create-trigger-report.mjs');b=bp.read_text().replace("mini_prompt:'Current micro-prompt',","mini_prompt:'Current micro-prompt',source_mini_prompt:'Original source micro-prompt',")
b=b.replace('Proposal only','Plan + targeted implementation').replace('Proposal · not a completed rollout','Plan + targeted implementation').replace('This is a plan, not a completed integration.','Targeted token and teaching safeguards are implemented; the complete registry rollout remains planned.')
bp.write_text(b)
