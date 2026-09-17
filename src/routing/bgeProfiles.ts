import baseline from './bgeCalibration.json';
// Immutable v1 skill calibration remains the rollback point. No model weights changed.
export const BGE_RELEASE='bge-single-encoder-v2';
export const BGE_ARTIFACT='bge-small-en-v1.5-q8-cls-2026-09';
export const bgeProfiles={
 route:{...baseline.route,version:'bge-skill-route-v1',queryInstruction:false},
 topic:{...baseline.topic,version:'bge-topic-v1',queryInstruction:false},
 suggestion:{...baseline.suggestion,version:'bge-suggestion-v1',queryInstruction:false},
 needs:{score:.55,margin:.01,clarifyScore:.60,clarifyMargin:.04,version:'bge-input-needs-v3',queryInstruction:true},
 pathway:{score:.70,margin:.08,version:'bge-pathway-v2',queryInstruction:false},
} as const;
export type BgeTask=keyof typeof bgeProfiles;
export function bgeQuery(text:string,task:BgeTask){return (bgeProfiles[task].queryInstruction?'Represent this sentence for searching relevant passages: ':'')+text;}
export function taskRanking(candidates:{id:string;score:number}[],allowed:readonly string[],gate:{score:number;margin:number}){
 const ranking=candidates.filter(c=>allowed.includes(c.id)&&Number.isFinite(c.score)&&c.score>=-1&&c.score<=1)
  .sort((a,b)=>b.score-a.score).filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);
 const [first,second]=ranking;
 const failedGates=!second?['incomplete-ranking']:[...(first.score<gate.score?['min-similarity']:[]),...(first.score-second.score<gate.margin?['top2-margin']:[]),...(first.id==='other'?['background-wins']:[])];
 return {ranking,failedGates,selected:failedGates.length===0,id:first?.id,score:first?.score,margin:second?first.score-second.score:undefined};
}

/** Asking for more information requires stronger separation than an advisory answer/research hint. */
export function needGate(kind:string|undefined){const p=bgeProfiles.needs;return kind==='clarify'?{score:p.clarifyScore,margin:p.clarifyMargin}:p;}
export function rankNeeds(candidates:{id:string;score:number}[]){
 const initial=taskRanking(candidates,['answer','clarify','research','other'],bgeProfiles.needs);
 return initial.id==='clarify'?taskRanking(candidates,['answer','clarify','research','other'],needGate('clarify')):initial;
}
