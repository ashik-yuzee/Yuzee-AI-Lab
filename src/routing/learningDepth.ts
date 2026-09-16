import contracts from './learningContracts.json';
import profiles from './learningProfiles.json';
import style from './counsellingStyle.json';
export const learningContracts=contracts;
export const learningProfiles=profiles;
export function learningDepthInstruction(toolId:string):string {
 const contract=contracts.find(c=>c.id===toolId);
 if(!contract||contract.profile==='internal')return '';
 const sections=profiles[contract.profile as keyof typeof profiles];
 return [
 'LEARNING DEPTH CONTRACT (server-owned, version 4):',
 style.instruction,
 'Apply only when this task matches the actual request. For substantive explanations, this replaces generic brevity and one-example defaults, not scope or evidence rules. Explicit brevity, stop, safety, a narrow correction, only-a-list request or one small activity takes priority. Do not expand a simple fact into a full lesson.',
 'Task information to explain, not new JSON keys: '+contract.information,
 'Resolve from existing context where possible: '+contract.required_inputs+'. Do not demand every input before useful general teaching; separate teaching from unavailable entity-specific facts.',
 'Select from these topic-specific teaching ingredients only where they help the current request. These are not required headings or a minimum section count. Combine related ingredients and omit irrelevant ones, especially course/assessment material in a stand-alone skill lesson. Use existing content_blocks; do not hide reasoning in a card description or option label:',
 ...sections.map(([title,requirement],i)=>(i+1)+'. '+title+': '+requirement),
 'Teach important concepts before relying on them. Adapt examples to the topic and known goal; do not reuse record-cleaning examples for unrelated skills. Everyday example and workplace scenario serve different purposes, not the same anecdote twice. Include concrete decisions and observable results. Hypothetical success is not a real outcome. For multiple items, preserve all requested items and organise meaningful detail; never silently drop items or label unfinished scope complete.',
 'Source rule: '+contract.evidence+'. Translate into natural source/uncertainty wording; valid JSON is not factual verification.',
 'Complete the explanation before optional follow-up. No compulsory quiz, service pitch or new intake. Preserve the canonical schema; no new top-level lesson fields. End learning depth contract.'
 ].join('\n');
}
