/** Phase 1 migration. Preserve supplied v1.7; regenerate v1.11 and check both runtimes. */
import fs from 'node:fs';
import {COMPARISON_SNIPPET} from '../src/warehouse/comparisonSnippet';
import {LOCAL_GUIDANCE_SNIPPET} from '../src/warehouse/localGuidanceSnippet';
import {createHash} from 'node:crypto';
import {serviceRegistryPrompt,serviceRegistry} from '../src/orchestration/serviceRegistry';
const baseline='src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.7.md';
let text=fs.readFileSync(baseline,'utf8');
if(createHash('sha256').update(text).digest('hex')!=='dae1a51322233fdf030558643a31bf0ff81cda54d3ed0eb6abff50b307a38890')throw Error('Baseline changed: review the migration instead of silently regenerating.');
function replace(from:string,to:string){if(!text.includes(from))throw Error('Missing migration anchor: '+from);text=text.replaceAll(from,to);}
// Replace invalid legacy identifiers, not validator acceptance rules.
const router=text.match(/<SNIPPET id="03_RMO_ROUTER">([\s\S]*?)<\/SNIPPET>/)![1];
const principles=router.slice(router.indexOf('ROUTING PRINCIPLES')).replaceAll('EDUCATION_RMO','EDU_OFFER_RMO');
replace(router,`\nSelect one PRIMARY canonical RMO for the active need. Product and protocol mappings are owned by 05B_SERVICE_REGISTRY.\nROUTING\n${serviceRegistry.routes.map(r=>`${r.intent} -> ${r.protocol_id}`).join('\n')}\nDo not select by student/employed/unemployed/graduate labels alone. Use the immediate goal and actual gap. Apprenticeship versus traineeship and ordinary graduate work versus a structured graduate program must not be collapsed.\n${principles}`);
const product=text.match(/<SNIPPET id="05B_SERVICE_REGISTRY">([\s\S]*?)<\/SNIPPET>/)![1];
replace(product,'\n'+serviceRegistryPrompt()+'\n');
const gate=`SERVICE TIMING — TWO PATHS
PROACTIVE OFFER: the understanding gate below controls an unsolicited Yuzee service offer. A relevant service can remain internal while the user explores.
EXPLICIT REQUEST: answer a requested explanation or run/prepare a requested read-only, reversible activity as soon as enough information exists to be useful. Do not require understanding_score >=80 or counsellor_confidence_score >=75 before comparing named choices, explaining differences, checking supplied information or drafting a pathway. Ask one genuinely necessary missing-input question inside the activity; optional personalisation does not block a general result. A generic "yes" without a clear referent is not an explicit request.
Workspace guidance is separate from service_trigger execution. An activity can be useful with service_trigger.trigger_now=false and actions=[]. An explicit request never creates a missing backend capability. External COMMIT actions still require sufficient scope, a connected trusted action and application authorisation/confirmation. Readiness is never execution success.
PROACTIVE SERVICE VISIBILITY RULE`;
replace('H. SERVICE READINESS GATE',gate);
replace('Maintain the best-fit primary RMO and Yuzee service internally, but do not surface services before the counselling readiness gate is met.','Maintain the best-fit RMO internally. Apply the 02C proactive-offer gate to unsolicited offers; fulfil explicit informational or reversible workspace requests when useful.');
replace('Surface Yuzee action only after the counselling readiness gate says the user has genuinely understood enough to benefit from it.','Proactively offer Yuzee services only after the counselling readiness gate. Explicit user requests follow the separate 02C path; external actions still require capability, scope and authorisation.');
replace('Relevant RMOs/services remain internal and hidden.','Relevant unsolicited RMO/service offers remain internal and hidden. Explicit information/workspace requests can be fulfilled during GUIDANCE.');
replace('Never move from GUIDANCE to a visible service solely because the user said yes; the understanding gate must already be satisfied.','Never treat an ambiguous yes as service consent. The understanding gate applies to proactive offers; a clear explicit request follows the separate 02C path.');
replace('Select the best-fit service internally as a candidate, but do not surface it during ordinary early/mid counselling.','Select the best-fit service internally as a candidate. Keep unsolicited offers hidden during early/mid counselling; answer explicit service information and reversible workspace requests under 02C.');
replace('Service timing is controlled by 02C_COUNSELLOR_UNDERSTANDING_ENGINE, not by keyword matching or the mere existence of an RMO.','Service timing follows both paths in 02C_COUNSELLOR_UNDERSTANDING_ENGINE. Neither keyword matching nor the mere existence of an RMO authorises execution.');
replace('VISIBILITY / ACTION RULES\nHIDDEN:', 'VISIBILITY / ACTION RULES\nThese stages govern proactive offers. Explicit read-only/reversible requests use 02C and need not wait for a counselling score; they never bypass COMMIT confirmation or capability checks.\nHIDDEN:');
replace('12. Keep services hidden until the existing understanding/readiness gate permits visibility.','12. Keep unsolicited service offers hidden until the understanding gate permits visibility; fulfil explicit information and reversible workspace requests under 02C.');
replace('Is service visibility consistent with the existing understanding gate?','Does service timing follow the correct 02C proactive-offer or explicit-request path?');
replace('Do not show Yuzee services while service_visibility_state=HIDDEN.','Do not show unsolicited Yuzee service offers while service_visibility_state=HIDDEN. Explicit information and workspace results remain permitted under 02C.');
replace('SERVICE VISIBILITY MAPPING\nHIDDEN:','SERVICE VISIBILITY MAPPING\nThe following stages concern service offers/actions, not whether a counselling activity may run. Fulfil explicit reversible activity requests through the workspace coordinator without inventing service_trigger actions. The 02C understanding thresholds govern proactive offers only.\nHIDDEN:');
replace('- only after understanding_score >=80, counsellor_confidence_score >=75,','- for a proactive offer, only after understanding_score >=80, counsellor_confidence_score >=75,');
replace('`mode_source`, `safety_override_applied`, `user_confidence`, `progress`.','`mode_source`, `safety_override_applied`, `user_confidence`, `progress`, `activity_context`.');
// Remove a compulsory landscape lecture that competed with the one-question rule.
const exploration=text.slice(text.indexOf('EARLY UNIVERSITY EXPLORATION — CONTENT QUALITY RULE'),text.indexOf('Choose one INTERNAL planner intent:'));
replace(exploration,`EARLY UNIVERSITY EXPLORATION — CONTENT QUALITY RULE
When university is the user's goal but their field is unclear, give a small useful starting point and ask ONE question about an enjoyed subject, project or task. Do not combine interests and dislikes, or course field and completion date, into one question. One input request means one piece of information, not one question mark.
Do not automatically deliver a five-family taxonomy, a degree-structure lecture and a questionnaire together. Use a landscape framework when the user requests an overview or it materially helps this turn. Present it as an illustrative lens, not an official or exhaustive taxonomy. Once material dimensions have been chosen, preserve their distinctions rather than merging them to fit a control.
Broader degrees MAY allow exploration depending on course structure; later major choice, cross-faculty electives, transfers and credit are not guaranteed. Explain only the flexibility relevant now, with qualification beside the claim. More structured degrees may align with professional-entry requirements, but requirements vary by discipline and jurisdiction. Do not imply a named degree automatically grants professional status.
This fallback never makes university the default for other goals.

`);
// Current Node additions become part of the standalone prompt, before the locked renderer.
const additions=['connected-context','warehouse-data','activity-context','clear-guidance','learning-depth'].map(name=>fs.readFileSync(`src/prompts/${name}.md`,'utf8')).join('\n\n');
const marker='<SNIPPET id="08_SEMANTIC_JSON_RENDERER">';
if(!text.includes(marker))throw Error('Renderer boundary missing');
text=text.replace(marker,additions+'\n\n<SNIPPET id="01E_RTO_COURSE_COMPARISON">\n'+COMPARISON_SNIPPET+'\n</SNIPPET>\n\n<SNIPPET id="01F_LOCAL_EXPLORATION">\n'+LOCAL_GUIDANCE_SNIPPET+'\n</SNIPPET>\n\n'+marker);
text='# Yuzee Quiz Counsellor & Training v1.11\n\nPhase 4: skills, occupations, learning options and dated local job evidence with shared interactive workspace choices. Response protocol remains v1.3. Generated by scripts/build-quiz-prompt.ts; v1.7 is the preserved migration baseline.\n\n'+text;
for(const file of ['src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.11.md','spring-backend/src/main/resources/yuzee/prompts/Yuzee_Quiz_Counsellor_Training_v1.11.md']){
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==text)throw Error('Generated prompt drift: '+file);}
 else fs.writeFileSync(file,text);
}
console.log(`${process.argv.includes('--check')?'Checked':'Generated'} v1.11: ${Buffer.byteLength(text)} bytes; ${createHash('sha256').update(text).digest('hex')}`);
