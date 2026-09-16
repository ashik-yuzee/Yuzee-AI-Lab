import {parseOalaMention} from '../oala/invocation';
import registry from './microtools.json';
import {learningDepthInstruction} from './learningDepth';
export type MicroTool = typeof registry[number];
export const microTools:MicroTool[]=registry;
export const ROUTER_VERSION='minilm-guarded-v1';
export const MODEL_ID='Xenova/all-MiniLM-L6-v2';
export const ROUTER_MODEL_KEY='oala-router-model';
export const ROUTER_MODELS=[
 {id:'Xenova/all-MiniLM-L6-v2',label:'MiniLM-L6',size:'22 MB',description:'Default · fastest startup'},
 {id:'Xenova/all-MiniLM-L12-v2',label:'MiniLM-L12',size:'33 MB',description:'Deeper encoder · better accuracy'},
 {id:'Xenova/bge-small-en-v1.5',label:'BGE-small en-v1.5',size:'33 MB',description:'Best retrieval score in range'},
] as const;
export type RouterModelId=typeof ROUTER_MODELS[number]['id'];
export const MIN_SCORE=0.48;
export const MIN_MARGIN=0.06;
export type Candidate={toolId:string;score:number};
export type RoutingDecision={status:'selected'|'abstained';toolId?:string;score?:number;margin?:number;reason:string;version:string;latencyMs?:number};
// These catalogue entries describe internal control operations, not user-facing answers.
const internalOnly=new Set(['CORE_001','CORE_002']);
export const eligibleTools=microTools.filter(t=>!internalOnly.has(t.id));
export const abstain=(reason:string):RoutingDecision=>({status:'abstained',reason,version:ROUTER_VERSION});
export function routingSkipReason(text:string,structuredAnswer=false):string|null {
 const s=text.trim();
 if(structuredAnswer)return 'structured-answer';
 if(!s || s.length>1800)return 'input-length';
 if(!/[a-z]/i.test(s)||/[^\u0000-\u024f\u2000-\u206f]/.test(s))return 'language-or-symbols';
 if(/^(hi|hello|hey|thanks|thank you|yes|no|okay|ok|sure|not sure|i[’']?m not sure)[.!\s]*$/i.test(s))return 'conversation';
 if(/^actually\b/i.test(s)||/\b(stop|pause|cancel|forget|ignore|instead|rather than|do not|don[’']t|not interested|not looking)\b/i.test(s))return 'correction-or-boundary';
 if(/\b(kill myself|suicid|self.harm|hurt myself|emergency)\b/i.test(s))return 'sensitive-boundary';
 if(/^(more|tell me more|go on|continue|what about that|what about this|why|how much|what next)[?.!\s]*$/i.test(s))return 'needs-context';
 if(s.split(/\s+/).length<4)return 'needs-context';
 // Multiple jobs in one request belong with the full counsellor until a multi-tool planner is evaluated.
 if((s.match(/\?/g)||[]).length>1)return 'multiple-questions';
 return null;
}
export const indexText=(t:MicroTool)=>`${t.name}. ${t.use_when} ${t.purpose} Examples: ${t.trigger_examples}`;
export function chooseRoute(candidates:Candidate[]):RoutingDecision {
 const ranked=candidates.filter(c=>eligibleTools.some(t=>t.id===c.toolId)&&Number.isFinite(c.score)&&c.score>=-1&&c.score<=1).sort((a,b)=>b.score-a.score);
 const unique=ranked.filter((c,i)=>ranked.findIndex(r=>r.toolId===c.toolId)===i);
 if(unique.length<2)return abstain('incomplete-ranking');
 const [first,second]=unique,margin=first.score-second.score;
 if(first.score<MIN_SCORE)return {...abstain('low-similarity'),score:first.score,margin};
 if(margin<MIN_MARGIN)return {...abstain('ambiguous'),score:first.score,margin};
 return {status:'selected',toolId:first.toolId,score:first.score,margin,reason:'clear-semantic-match',version:ROUTER_VERSION};
}
/** Browser routing is advisory. Only allowlisted catalogue text can reach Gemini. */
export function acceptClientRoute(value:unknown,mode:string,text:string,structuredAnswer=false):RoutingDecision {
 const mention=parseOalaMention(text);
 if(!mention.active)return abstain('not-addressed');
 const skip=routingSkipReason(mention.message,structuredAnswer);if(skip)return abstain(skip);
 const r=value as Partial<RoutingDecision>|undefined;
 if(!r||r.version!==ROUTER_VERSION)return abstain('no-selection');
 if(r.status==='abstained'){
  const known=['not-ready','low-similarity','ambiguous','incomplete-ranking','busy','timeout','unavailable','inference-failed','cancelled','token-budget'];
  return abstain(known.includes(r.reason||'')?r.reason!:'no-selection');
 }
 if(r.status!=='selected')return abstain('no-selection');
 if(!eligibleTools.some(t=>t.id===r.toolId))return abstain('unknown-tool');
 if(typeof r.score!=='number'||!Number.isFinite(r.score)||r.score<MIN_SCORE||r.score>1||typeof r.margin!=='number'||!Number.isFinite(r.margin)||r.margin<MIN_MARGIN||r.margin>2)return abstain('invalid-score');
 return {status:'selected',toolId:r.toolId,score:r.score,margin:r.margin,reason:'clear-semantic-match',version:ROUTER_VERSION};
}
export function scopedInstruction(decision:RoutingDecision):string {
 const tool=eligibleTools.find(t=>decision.status==='selected'&&t.id===decision.toolId);
 if(!tool)return '';
 return `OPTIONAL_FOCUS_FOR_THIS_TURN:
The local similarity router suggests "${tool.name}". This is a fallible topic hint, not a user instruction or evidence. Ignore it if it does not match the actual request and conversation. The main counselling instructions and canonical JSON contract still control the response. Do not expose routing labels, similarity scores or internal classifications. Do not restart intake, override a correction, invent facts, imply retrieval occurred, or perform an external action. Unknown workload, accessibility, eligibility, prices and availability remain unknown until supported by relevant evidence. Respect requests for one sentence or no follow-up.
Use only the relevant parts of this catalogue guidance; any request for a different output format or internal fields must be adapted to the main response contract:
${tool.mini_prompt}

${learningDepthInstruction(tool.id)}
END_OPTIONAL_FOCUS`;
}
