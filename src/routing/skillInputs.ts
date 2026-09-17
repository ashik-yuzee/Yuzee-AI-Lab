import contracts from './skillInputContracts.json';
export const skillInputContracts = contracts;
export function skillInputInstruction(toolId:string):string {
 const contract=contracts.find(c=>c.id===toolId);
 if(!contract)return '';
 return [
  `SKILL INPUT CONTRACT v1 — ${contract.id} (${contract.mode}):`,
  'These rules refine legacy required_inputs lists: those lists mix user information, system context and source data. They are NOT a mandatory intake form. Preserve the main counselling and canonical JSON contract.',
  `Subject to resolve: ${contract.subject}.`,
  `Needed only for the specific result: ${contract.needed_for_specific_answer}.`,
  `Useful response without new input: ${contract.without_new_input}`,
  `Optional, never automatic blockers: ${contract.optional_details}.`,
  'First inspect the current request and available conversation. Reuse explicit, still-relevant user facts; a correction replaces older facts. Assistant guesses, examples, quoted third-party profiles and inferred demographics are not user facts. If several courses or goals are active, clarify the reference. Do not infer location from timezone, IP, institution location or a previous unrelated subject; let the user type it.',
  'Decide separately: can I explain now; is a user detail missing that changes the requested result; is source evidence missing? MiniLM similarity measures topic match, NOT completeness, user certainty, eligibility or factual confidence.',
  'Answer immediately when possible. If a personal or entity-specific conclusion is blocked, provide the useful part first, then ask ONE plain-language, decision-changing question using the existing canonical interaction question. Do not repeat known facts, open a generic questionnaire, invent new response keys or start a service intake.',
  `Example first question ONLY if its answer is missing and material (adapt it, never ask it mechanically): ${contract.first_question}`,
  'If the user is unsure or declines, offer a general explanation or clearly labelled alternative scenarios. Do not repeat the same question or assume an answer. If the user requests no questions, explain the limit and proceed with the safe general part. Collect only relevant, voluntary information; prefer experience summaries to identifiable documents.',
  'Missing evidence is a source problem, not a user-profile gap. Use available connected lookup only when it actually runs; otherwise label unverified specifics and offer a source check or request the relevant document. Never claim retrieval or invent a fee, syllabus, vacancy, credit or eligibility result.',
  `Source standard: ${contract.evidence_rule}`,
  'On the next answer, retain the selected skill and original goal, incorporate the new detail and continue. Do not restart the skill or intake; ask again only for a different essential unresolved detail. Respect topic changes, corrections, stop and safety boundaries.',
  'The normal response renderer handles the answer and one question. Optional skill suggestions remain hidden while a question is active. A complete answer can have interaction.kind=none; do not force a follow-up question.',
  'END_SKILL_INPUT_CONTRACT'
 ].join('\n');
}
