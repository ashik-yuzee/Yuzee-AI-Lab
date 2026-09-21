import {geminiSchema} from '../../qa/objectives/api.mjs';
/** Keep dynamic reference allowlists local: repeating them in nested unions can
 * exceed Gemini's structured-output complexity budget as answers accumulate. */
export function objectiveProviderSchema(schema:any):any {
 const result=structuredClone(schema);
 const visit=(node:any)=>{
  if(!node||typeof node!=='object')return;
  if(node.properties?.evidence_refs?.items)node.properties.evidence_refs.items={type:'string'};
  Object.values(node).forEach(visit);
 };
 visit(result);
 return geminiSchema(result);
}
