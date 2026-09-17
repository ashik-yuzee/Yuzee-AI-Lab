import type {YuzeeResponseV13} from '../types';

/** Structural completeness is checked separately from JSON validity.
 * No sources are fetched for this call, so concrete money claims cannot be verified.
 * This is a bounded guard, not a general factual accuracy checker.
 */
export function reviewMiniPathwayReport(response:YuzeeResponseV13):string[] {
 const blocks=response.content_blocks,issues:string[]=[];
 const text=JSON.stringify(blocks);
 if(/[$£€]\s*\d|\b(?:AUD|USD|GBP|EUR)\s*\d|\b\d[\d,.]*\s*(?:dollars|pounds|euros)\b/i.test(text))issues.push('Remove unsourced monetary amounts. Keep cost factors and clearly state what must be checked. No fee evidence was fetched.');
 if(/\b(?:zero tuition|no tuition|zero out.of.pocket|full wage|guaranteed (?:job|employment|placement))\b/i.test(text))issues.push('Remove unverified free-tuition, wage or employment guarantees; describe conditional arrangements and checks instead.');
 if(!blocks.some(b=>b.id==='overview'&&b.text.trim()))issues.push('Include overview: a plain-language orientation to the goal and known constraints.');
 const routes=blocks.find(b=>b.id==='route-summary'&&b.type==='table');
 if(!routes?.rows.length)issues.push('Include route-summary as a table with one row per useful route and a unique row ID.');
 for(const route of routes?.rows||[]){
  if(!route.id){issues.push('Each route-summary row needs a unique route ID.');continue;}
  const timeline=blocks.find(b=>b.id===`${route.id}-timeline`&&['table','steps'].includes(b.type));
  if(!timeline||!(timeline.rows.length||timeline.items.length))issues.push(`Include ${route.id}-timeline: the complete chronological stages, sub-steps, purpose and starting point for this route, not a shared generic timeline.`);
  const considerations=blocks.find(b=>b.id===`${route.id}-considerations`);
  if(!considerations||!(considerations.text.trim()||considerations.items.length))issues.push(`Include ${route.id}-considerations: accessibility, practical risks, trade-offs and how to reduce them.`);
 }
 if(!blocks.some(b=>b.id==='route-comparison'&&['table','comparison'].includes(b.type)&&b.rows.length))issues.push('Include route-comparison: time, cost, risk, foundational knowledge and flexibility, with unknowns identified.');
 if(!blocks.some(b=>b.id==='experience-playbook'&&b.type==='steps'&&b.items.length===6))issues.push('Include experience-playbook as a six-item steps block: target experience, evidence, preparation, readiness, experience goals, and follow-on strategy. Tailor it to the current goal, including exploratory activities when the career is undecided.');
 return issues;
}
