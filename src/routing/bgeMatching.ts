import content from './bgeSkillContent.json';
import registry from './microtools.json';
import {BGE_OUT_OF_SCOPE,bgeDomainExamples} from './bgeDomain';
export const BGE_MODEL_ID='Xenova/bge-small-en-v1.5';
export const BGE_CONTENT_VERSION='bge-skills-v1';
export const bgeMatchingIndex=[
 ...content.flatMap(t=>{const legacy=registry.find(x=>x.id===t.id)!;return [
  {toolId:t.id,text:t.text},
  {toolId:t.id,text:`${legacy.name}. ${legacy.use_when} ${legacy.purpose} Examples: ${legacy.trigger_examples}`},
 ];}),
 ...bgeDomainExamples.map(text=>({toolId:BGE_OUT_OF_SCOPE,text})),
];
/** Max per ID, including a background competitor; never normalise scores across models. */
export function rankBge(query:Float32Array,vectors:Float32Array[]){
 if(vectors.length!==bgeMatchingIndex.length)throw Error('Incomplete BGE index');
 const scores=new Map<string,number>();
 vectors.forEach((v,i)=>{
  const score=v.reduce((sum,n,j)=>sum+n*query[j],0),id=bgeMatchingIndex[i].toolId;
  scores.set(id,Math.max(scores.get(id)??-1,score));
 });
 const ranked=[...scores].map(([toolId,score])=>({toolId,score})).sort((a,b)=>b.score-a.score);
 // Preserve background evidence even if it is not among the top skill matches.
 return [...ranked.filter(c=>c.toolId!==BGE_OUT_OF_SCOPE).slice(0,4),ranked.find(c=>c.toolId===BGE_OUT_OF_SCOPE)!];
}
export type BgeGate={score:number;margin:number;domainMargin:number};
export function bgeGateResult(candidates:{toolId:string;score:number}[],gate:BgeGate){
 const valid=candidates.filter(c=>Number.isFinite(c.score)&&c.score>=-1&&c.score<=1);
 const domain=valid.find(c=>c.toolId===BGE_OUT_OF_SCOPE);
 const ranked=valid.filter(c=>c.toolId!==BGE_OUT_OF_SCOPE).sort((a,b)=>b.score-a.score)
  .filter((c,i,a)=>a.findIndex(x=>x.toolId===c.toolId)===i);
 if(ranked.length<2||!domain)return {selected:false,reason:'incomplete-ranking'};
 const [a,b]=ranked,margin=a.score-b.score,domainMargin=a.score-domain.score;
 const reason=a.score<gate.score?'low-similarity':domainMargin<gate.domainMargin?'outside-scope':margin<gate.margin?'ambiguous':'clear-semantic-match';
 return {selected:reason==='clear-semantic-match',reason,toolId:a.toolId,score:a.score,margin,domainMargin};
}
