/**
 * Guidance retrieval for EXP-RAG: selects verbatim v1.11 modules for the current turn.
 * Stage 1: deterministic triggers derived from turn signals.
 * Stage 2: hybrid semantic retrieval — BM25 plus multi-vector BGE max-sim (module key + each example),
 * hubness-centred so generic modules do not match every message, fused with RRF.
 * Stage 3: tiered packing under a token budget, rendered in source-prompt order.
 */
import kb from './guidance/guidance-kb.json';
import type {Trigger} from './guidance/manifest';
import {Bm25Index,rrf,dot,packByBudget} from './search';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {embed,embedderAvailable,GEMINI_EMBEDDING,type EmbedProvider} from './embedder';

export interface GuidanceModule{id:string;title:string;layer:'core-module'|'application';family:'counselling'|'evidence';priority:number;triggers:Trigger[];when:string;examples:string[];order:number;tokens:number;text:string}
export const GUIDANCE_VERSION=kb.version;
export const GUIDANCE_MODULES=kb.modules as GuidanceModule[];

/** Tuned on tests/fixtures/exp-rag-guidance-eval.json (npm run eval:exp-rag -- --grid). Lift = similarity above the module's background mean. */
export const GUIDANCE_TUNING={budget:3600,hardCap:5200,evidenceBudget:2700,evidenceHardCap:3600,semanticMax:4,minLift:0.12,minLiftWithLexical:0.08,strongLift:0.24};
export type GuidanceTuning=typeof GUIDANCE_TUNING;
/** Gemini lifts run ~1.5x BGE's. Re-tuned on the same eval set (npm run eval:exp-rag -- --provider gemini --grid): recall stays 100% up to
 * minLift 0.28 / lexical 0.16; 0.18 / 0.10 keeps a margin (strongLift 0.36 drops recall to 96.9%, so it stays 0.24). 2.3k vs 2.8k guidance tokens per turn on the eval set. */
export const GUIDANCE_TUNING_GEMINI:GuidanceTuning={...GUIDANCE_TUNING,minLift:0.18,minLiftWithLexical:0.1,strongLift:0.24};
export const guidanceTuning=(provider:EmbedProvider)=>provider==='gemini'?GUIDANCE_TUNING_GEMINI:GUIDANCE_TUNING;

const RX:Partial<Record<Trigger,RegExp>>={
  correction:/(?:^|[.!?]\s+)(?:no|nope|actually|wait)\b|\b(that'?s (not|wrong|incorrect)|you (got|have) (it|that|me) wrong|i (said|meant)|not what i (said|meant)|i didn'?t say|correction|misunderstood|no,? i (am|do|did|have|can|want|don'?t|can'?t))\b/i,
  overwhelm:/\b(too much|overwhelm\w*|confus\w*|lost|don'?t (understand|get it)|doesn'?t make sense|makes no sense|simpler|simplify|slow down|stuck|too (long|complicated|complex))\b/i,
  compare:/\b(compare|comparison|comparing|vs\.?|versus|difference(s)? between|which (is|one|would be|should i)|better (option|choice|for me)|or should i|pros and cons|trade-?offs?|torn between|choose between|deciding between)\b/i,
  serviceIntent:/\b(apply|application|enrol+|sign (me )?up|register me|book|get (me )?an? (offer|place|spot)|find me|match me|send (it|this|my|the)|submit|lodge|request (an? )?(offer|callback|call)|start (the|my) (request|application|service)|help me (apply|get|find))\b/i,
  draft:/\b(draft|summary of my request|adjust (it|the request)|change my (location|residency|goal))\b/i,
  jurisdiction:/\b(tafe|rto|atar|vce|vcal|hsc|wace|sace|qce|ncea|cert(ificate)?\s*(i{1,3}|iv|[1-4])\b|diploma|apprentic\w*|traineeship\w*|licen[cs]\w*|registration|hecs|fee-?help|vet student loan|fee-?free|subsid\w*|funding|funded|visa|aqf|white card|wwcc|police check|regulat\w*|accredit\w*|credit transfer|rpl|recognition of prior)\b/i,
  cost:/\b(cost\w*|fee|fees|price\w*|afford\w*|tuition|loan|hecs|pay for|paying|subsid\w*|cheap\w*|expensive|budget|how much)\b/i,
  university:/\b(uni|university|universities|degree|bachelor|major|undergrad\w*|postgrad\w*|atar)\b/i,
  studyLoad:/\b(\d+\s*(hours?|hrs?)\b|hours (a|per) week|study load|workload|units? per|part[- ]time study|full[- ]time study|self[- ]paced|captions?)\b/i,
  returnToWork:/\b(return(ing)? to (work|the workforce)|back to work|after (a )?(long )?break|career break|stay[- ]at[- ]home|been (home|caring)|carer|career change|change careers?|switch careers?|changing careers?)\b/i,
  courseQuality:/\b(quality|reputation|(good|great|decent|bad|best) (course|tafe|rto|provider|uni|training|place|choice|college|school|institute)|how good|any good|is (it|this|that) (any )?good|better training|trainers?|workshops?)\b/i,
  localFigures:/\b(how many|number of|demand|job market|jobs? (in|around|near)|hiring|employers?|outlook|growth|forecast|shortage|vacanc\w*|local overview)\b/i,
  yuzeeServices:/\b(yuzee|what (can|do) you (do|offer)|your services|how can you help|what services)\b|@oala/i,
  statedPlace:/\b(i (live|am living|stay) (in|at|near|around)|i'?m (from|in|based in|living in)|based in|around here|in my (area|town|suburb|city|region)|my local)\b/i,
  nearbyProviders:/\b(near me|nearby|close to (me|home)|closest|local (tafe|uni|college|provider|campus|course)s?|(tafe|tafes|unis?|universit(y|ies)|colleges?|rtos?|campus(es)?|providers?|open days?|intakes?) (in|near|around) [a-z]+)\b/i,
  experience:/\b(i (currently )?work (as|in|at)|work(ing)? (part|full)[- ]time|(i'?m|i am) (working|employed)|i('ve| have) (been )?work(ed|ing) (as|in|at)|i was an? \w+ (for|at)|i('m| am) an? \w+ (at|in|for)|my (experience|background|current job)|years? (of )?experience|background in|worked as)\b/i,
  format:/\b(table|chart|bullet points?|dot points?|report|breakdown|in detail|detailed|shorter|brief(ly)?|quick (answer|version)|short version|summari[sz]e)\b/i,
  offTopic:/\b(recipe|weather|joke|movie|song|football|cricket|celebrity|trivia|horsepower|engine)\b/i,
};

const UNSURE=/\b(not sure|unsure|don'?t know|no idea|undecided|confused about|what (should|can|could) i do|where (do|should) i start|help me (decide|choose|figure)|need (some )?direction|lost)\b/i;

export interface TurnSignalsInput{
  message:string;
  /** Prior messages (user/assistant) in order. */
  history:Array<{role:string;content:string;createdAt?:number}>;
  activeInteraction?:{kind?:string}|null;
  structured?:boolean;
  warehouse?:{ready:boolean;comparison:boolean;local:boolean;skillsJobs:boolean};
  workspace?:boolean;
  research?:boolean;
  now?:number;
}
/** Deterministic, explainable turn signals. Each maps to modules via the manifest's `triggers`. */
export function detectTriggers(i:TurnSignalsInput):Set<Trigger>{
  const t=new Set<Trigger>();const text=i.message||'';
  // Instant local replies (greetings) are not counselling turns: the first real answer still gets first-turn rules.
  const hasAssistant=i.history.some(m=>m.role==='assistant'&&!(m as any).telemetry?.usage?.isMock);
  if(!hasAssistant)t.add('firstTurn');
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  if(hasAssistant&&!i.structured&&words>0&&words<=5)t.add('shortReply');
  for(const [k,rx] of Object.entries(RX) as Array<[Trigger,RegExp]>)if(rx.test(text))t.add(k);
  t.delete('localFigures');
  if(i.activeInteraction?.kind==='handoff')t.add('activeHandoff');
  const last=[...i.history].reverse().find(m=>m.createdAt)?.createdAt;
  if(last&&(i.now??Date.now())-last>12*3600_000)t.add('returning');
  if(i.warehouse?.ready){
    t.add('warehouse');
    if(i.warehouse.comparison)t.add('rtoComparison');
    if(i.warehouse.local){t.add('local');if(RX.localFigures!.test(text))t.add('localFigures');}
    if(i.warehouse.skillsJobs)t.add('skillsJobs');
  }
  // Early 'I live here and don't know what to do' exploration, not every turn that has local data.
  if((t.has('statedPlace')||i.warehouse?.local)&&UNSURE.test(text))t.add('placeUnsure');
  if(i.workspace)t.add('workspace');
  if(i.research)t.add('research');
  return t;
}

let lexical:Bm25Index|undefined;
type GuidanceIndex={vectors:Map<string,Float32Array[]>;background:Map<string,number>};
const indexes=new Map<EmbedProvider,Promise<GuidanceIndex>>();
const maxSim=(q:Float32Array,list:Float32Array[])=>{let best=-1;for(const v of list){const s=dot(q,v);if(s>best)best=s;}return best;};

/** Module key + each example as passages; examples again as queries (for the background mean). */
function guidanceTexts(){
  const passages:string[]=[],owners:string[]=[];
  for(const m of GUIDANCE_MODULES){passages.push(`${m.title}. ${m.when}`);owners.push(m.id);for(const e of m.examples){passages.push(e);owners.push(m.id);}}
  const queries=GUIDANCE_MODULES.flatMap(m=>m.examples),queryOwners=GUIDANCE_MODULES.flatMap(m=>m.examples.map(()=>m.id));
  const hash=crypto.createHash('sha256').update(JSON.stringify([passages,queries])).digest('hex');
  return {passages,owners,queries,queryOwners,hash};
}

/** Shipped Gemini vectors (int8, built by scripts/build-rag-guidance-vectors.ts) spare serverless cold starts ~600 embeddings. */
export const GEMINI_VECTOR_FILE=path.resolve('src/rag/guidance/guidance-vectors.gemini.json');
const quantise=(v:Float32Array)=>Buffer.from(Int8Array.from(v,x=>Math.max(-127,Math.min(127,Math.round(x*127)))).buffer).toString('base64');
const dequantise=(b64:string)=>{const q=new Int8Array(Buffer.from(b64,'base64'));const v=Float32Array.from(q,x=>x/127);let n=0;for(const x of v)n+=x*x;n=Math.sqrt(n)||1;return v.map(x=>x/n);};
export async function buildGeminiGuidanceVectors(){
  const t=guidanceTexts();
  const [p,q]=await Promise.all([embed(t.passages,'passage',{provider:'gemini'}),embed(t.queries,'query',{provider:'gemini'})]);
  return {model:GEMINI_EMBEDDING.model,dimensions:GEMINI_EMBEDDING.dimensions,textHash:t.hash,passages:p.map(quantise),queries:q.map(quantise)};
}
function shippedGemini(hash:string):{passages:Float32Array[];queries:Float32Array[]}|null{
  try{
    const f=JSON.parse(fs.readFileSync(GEMINI_VECTOR_FILE,'utf8'));
    if(f.model!==GEMINI_EMBEDDING.model||f.dimensions!==GEMINI_EMBEDDING.dimensions||f.textHash!==hash)return null;
    return {passages:f.passages.map(dequantise),queries:f.queries.map(dequantise)};
  }catch{return null;}
}

/** Precompute module vectors (title+when and each example, ~350 short passages) and each module's
 * background similarity: its mean max-sim to every OTHER module's examples. BGE: under 3 s on CPU. */
export function warmGuidance(provider:EmbedProvider='bge'){
  // BM25 over the retrieval key only: module bodies are long and generic (eval: 91% vs 86% lexical-only recall).
  lexical??=new Bm25Index(GUIDANCE_MODULES.map(m=>({id:m.id,text:`${m.title} ${m.when} ${m.examples.join(' ')}`})));
  let index=indexes.get(provider);
  if(!index&&embedderAvailable(provider)){
    index=(async()=>{
      const t=guidanceTexts();
      const shipped=provider==='gemini'?shippedGemini(t.hash):null;
      const [passages,queries]=shipped?[shipped.passages,shipped.queries]:await Promise.all([embed(t.passages,'passage',{provider}),embed(t.queries,'query',{provider})]);
      const vectors=new Map<string,Float32Array[]>();
      passages.forEach((v,i)=>{const list=vectors.get(t.owners[i])||[];list.push(v);vectors.set(t.owners[i],list);});
      const background=new Map<string,number>();
      for(const [id,list] of vectors){
        let sum=0,n=0;queries.forEach((q,i)=>{if(t.queryOwners[i]!==id){sum+=maxSim(q,list);n++;}});
        background.set(id,sum/Math.max(1,n));
      }
      return {vectors,background};
    })();
    index.catch(()=>{if(indexes.get(provider)===index)indexes.delete(provider);});
    indexes.set(provider,index);
  }
  return index;
}

export interface GuidanceSelection{
  modules:GuidanceModule[];tokens:number;dense:boolean;
  trace:Array<{id:string;reason:'trigger'|'semantic';lift?:number;triggers?:Trigger[]}>;
  dropped:string[];triggers:Trigger[];
}
/**
 * @param queryVectors one or more query embeddings (raw message, context-augmented query); max lift wins.
 */
export async function selectGuidance(query:string,triggers:Set<Trigger>,queryVectors:Float32Array[]=[],tuning?:GuidanceTuning,provider:EmbedProvider='bge'):Promise<GuidanceSelection>{
  tuning??=guidanceTuning(provider);
  const index=warmGuidance(provider);
  const byId=new Map(GUIDANCE_MODULES.map(m=>[m.id,m]));
  const triggered=GUIDANCE_MODULES.filter(m=>m.triggers.some(t=>triggers.has(t)));
  const lex=lexical!.search(query,20);
  const lift=new Map<string,number>();let dense=false;
  if(queryVectors.length&&index){
    try{
      const {vectors,background}=await index;dense=true;
      for(const [id,list] of vectors)lift.set(id,Math.max(...queryVectors.map(q=>maxSim(q,list)))-background.get(id)!);
    }catch{dense=false;}
  }
  const fused=rrf(dense?[lex,[...lift].sort((a,b)=>b[1]-a[1]).map(([id])=>({id}))]:[lex]);
  const lexRank=new Map(lex.map((x,i)=>[x.id,i]));
  const semantic=[...fused].sort((a,b)=>b[1]-a[1]).map(([id])=>id)
    .filter(id=>!triggered.some(m=>m.id===id))
    .filter(id=>{
      const r=lexRank.get(id)??99;
      if(!dense)return r<3;
      const l=lift.get(id)??-1;
      return l>=tuning.minLift||(r<5&&l>=tuning.minLiftWithLexical);
    }).slice(0,tuning.semanticMax).map(id=>byId.get(id)!);
  // Tiered packing: important detected situations, then strong semantic matches, then the rest.
  const strong=(m:GuidanceModule)=>(lift.get(m.id)??0)>=tuning.strongLift;
  const byPriority=(a:GuidanceModule,b:GuidanceModule)=>b.priority-a.priority||a.order-b.order;
  const ordered=[
    ...triggered.filter(m=>m.priority>=4).sort(byPriority),
    ...semantic.filter(strong),
    ...triggered.filter(m=>m.priority<4).sort(byPriority),
    ...semantic.filter(m=>!strong(m)),
  ];
  // Evidence-policy modules and counselling modules pack under separate budgets so neither starves the other.
  const kept:GuidanceModule[]=[];let dropped:GuidanceModule[]=[];let used=0;
  for(const [family,budget,cap] of [['counselling',tuning.budget,tuning.hardCap],['evidence',tuning.evidenceBudget,tuning.evidenceHardCap]] as const){
    const members=ordered.filter(m=>m.family===family);
    // Priority-5 triggered modules (detected high-risk situations) are packed first and may use the hard cap;
    // everything else fills what remains of the soft budget.
    const must=members.filter(m=>triggered.includes(m)&&m.priority>=5);
    const first=packByBudget(must,cap,m=>m.tokens);
    const rest=packByBudget(members.filter(m=>!must.includes(m)),Math.max(0,budget-first.used),m=>m.tokens);
    kept.push(...first.kept,...rest.kept);dropped.push(...first.dropped,...rest.dropped);used+=first.used+rest.used;
  }
  const trace=kept.map(m=>triggered.includes(m)
    ?{id:m.id,reason:'trigger' as const,triggers:m.triggers.filter(t=>triggers.has(t))}
    :{id:m.id,reason:'semantic' as const,lift:Math.round((lift.get(m.id)??0)*1000)/1000});
  return {modules:kept.sort((a,b)=>a.order-b.order),tokens:used,dense,trace,dropped:dropped.map(m=>m.id),triggers:[...triggers]};
}

/** Render selected modules for the user turn, in source-prompt order. */
export function renderGuidance(sel:GuidanceSelection):string{
  if(!sel.modules.length)return '';
  return `<retrieved_guidance version="${GUIDANCE_VERSION}">\n${sel.modules.map(m=>`<module id="${m.id}" layer="${m.layer}" title="${m.title}">\n${m.text}\n</module>`).join('\n')}\n</retrieved_guidance>`;
}
