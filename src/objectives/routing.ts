import metadata from './selectionMetadata.json';
import catalogue from './catalogue.json';
export const objectiveCatalogue = catalogue.objectives;
export const OBJECTIVE_VERSION = catalogue.version+'-retrieval5-rto';
export const SHORTLIST_LIMIT=20;
export const selectionMetadata=metadata.rows;
export type ObjectiveMatch = {id:string;score:number;sources?:('user'|'context')[];userScore?:number;contextScore?:number};
// Selection language only. Never embed or send the 316 execution prompts.
export const legacyObjectiveIndex = objectiveCatalogue.flatMap(o=>[{id:o.tool_id,text:o.button_label},{id:o.tool_id,text:`${o.topic_name}. ${o.clear_purpose}`},{id:o.tool_id,text:`${o.button_label} ${o.when_to_serve.split('Use known context')[0]}`}]);
export const objectiveIndex=[...legacyObjectiveIndex,...selectionMetadata.flatMap(o=>[
 {id:o.id,text:o.label},{id:o.id,text:`${o.outcome} ${o.when_to_use}`},...o.examples.map(text=>({id:o.id,text}))
])].filter((p,i,rows)=>rows.findIndex(x=>x.id===p.id&&x.text===p.text)===i);
/** Reciprocal-rank fusion preserves both query lanes; context cannot erase raw-user candidates. */
export function fuseObjectiveMatches(user:ObjectiveMatch[],context:ObjectiveMatch[],limit=SHORTLIST_LIMIT,userText=''):ObjectiveMatch[]{
 const all=new Map<string, ObjectiveMatch&{fusion:number}>();
 for(const [source,ranking] of [['user',user],['context',context]] as const)ranking.forEach((c,i)=>{
  const row=all.get(c.id)||{id:c.id,score:c.score,sources:[],fusion:0};
  row.score=Math.max(row.score,c.score);row.sources!.push(source);if(source==='user')row.userScore=c.score;else row.contextScore=c.score;
  row.fusion+=(source==='user'?1.2:1)/(60+i+1);all.set(c.id,row);
 });
 const fused=[...all.values()].sort((a,b)=>b.fusion-a.fusion);
 const reference=/^(both|either|that one|this one|the first|the second|same|yes|no)(?:[,.! ]|$)/i.test(userText.trim())&&userText.length<80;
 const ordered=reference&&context.length?[...context.slice(0,Math.max(1,limit-4)).map(c=>all.get(c.id)!),...user.slice(0,4).map(c=>all.get(c.id)!),...fused]:fused;
 return ordered.filter((x,i,rows)=>rows.findIndex(y=>y.id===x.id)===i).slice(0,limit).map(({fusion,...row})=>row);
}
export function rankObjectivesFromVectors(query:Float32Array,vectors:Float32Array[]):ObjectiveMatch[]{
 if(vectors.length!==objectiveIndex.length)throw Error('Incomplete objective index');
 return mergeObjectiveRanks([vectors.map((v,i)=>({id:objectiveIndex[i].id,score:v.reduce((sum,n,j)=>sum+n*query[j],0)}))]);
}
export function mergeObjectiveRanks(rankings:ObjectiveMatch[][]):ObjectiveMatch[]{
 const scores=new Map<string,number>();
 for(const ranking of rankings)for(const c of ranking)if(Number.isFinite(c.score))scores.set(c.id,Math.max(scores.get(c.id)??-1,c.score));
 return [...scores].map(([id,score])=>({id,score})).sort((a,b)=>b.score-a.score).slice(0,SHORTLIST_LIMIT);
}
// These are preview retrieval gates, not calibrated probabilities or execution permission.
export function objectiveShortlist(matches:ObjectiveMatch[]):ObjectiveMatch[]{
 const ids=new Set(objectiveCatalogue.filter(o=>o.available).map(o=>o.tool_id));
 const unique=matches.filter((x,i)=>ids.has(x.id)&&Number.isFinite(x.score)&&x.score>=0.5&&x.score<=1.001&&matches.findIndex(y=>y.id===x.id)===i);
 return unique.slice(0,SHORTLIST_LIMIT);
}
export function objectiveSelectionBoundary(text:string){
 const t=text.trim();
 if(!t||t.length>16000)return 'input-limit';
 if(/^(hi|hello|hey|thanks?|thank you|ok|okay|yes|no|stop|cancel|never mind)[!. ]*$/i.test(t))return 'conversation';
 if(/\b(?:do not|don['’]?t)\s+(?:need|want|open|suggest|offer|show|start|run)\b.{0,45}\b(?:activit(?:y|ies)|tools?|workspace|suggestions?)\b/i.test(t))return 'declined';
 if(/\b(stop suggesting|no more (tools|suggestions)|do not suggest|don.t suggest)\b/i.test(t))return 'declined';
 return null;
}
