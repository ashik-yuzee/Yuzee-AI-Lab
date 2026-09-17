/** A repeated short follow-up signals an unresolved explanation, not a new intake. */
export function shortReplyGuidance(text:string, history:Array<{role:string;content:string}>, structured=false):string {
 const normalise=(value:string)=>value.trim().toLocaleLowerCase().replace(/[.!?]+$/u,'').trim();
 const current=normalise(text);
 if(structured || !current || current.split(/\s+/u).length>5 || !/[\p{L}]/u.test(current))return '';
 const lastUser=[...history].reverse().find(message=>message.role==='user');
 if(!lastUser || normalise(lastUser.content)!==current)return '';
 return 'CURRENT TURN CLARITY GUIDANCE (application-owned): The user has repeated the same short follow-up after the last explanation. The earlier explanation has not resolved their need. Keep the existing subject and named options. Re-explain in everyday words: one direct definition, two or three useful checks with why they matter, and one simple illustrative example. Do not reproduce the prior checklist, table or intake question. Avoid trade jargon and unsupported provider claims. If the precise concern is still unclear, ask one focused clarification only after the useful explanation. Prefer a few short paragraphs to another multi-section report.';
}
