/**
 * EXP-RAG turn pipeline.
 * Cached core system prompt + per-turn retrieved guidance (verbatim v1.11 modules), retrieved
 * warehouse evidence (typed lookup chunks + semantic catalogue index), rolling conversation memory
 * and the user's message. Mirrors the default request shape so validation, review, security and
 * telemetry downstream are unchanged.
 */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import type {GenerateContentConfig} from '@google/genai';
import {formatAssistantMessageRich,type Content} from '../services/MultiTurnRequestBuilder';
import {estimateTokens,type DialogueTurn} from '../services/TokenBudgetMemoryManager';
import type {WarehousePack} from '../warehouse/types';
import type {WarehouseQueryPlan} from '../warehouse/service';
import {needsWarehouse} from '../warehouse/service';
import {embed,embedderAvailable,embedderStatus,resolveProvider,type EmbedProvider} from './embedder';
import {detectTriggers,selectGuidance,renderGuidance,warmGuidance,GUIDANCE_VERSION,type GuidanceSelection} from './guidance';
import {packEvidence,selectEvidence,renderEvidence,scopeCatalogue,type EvidenceChunk,type EvidenceSelection} from './evidence';
import {planHistory,recallStatements,type RagMemory,type HistoryPlan} from './history';
import {warehouseIndex,type IndexHit} from './warehouseIndex';
import type {ChunkKind} from './warehouse/chunks';

/** planModel: the warehouse query planner only extracts search terms; Flash-Lite halves its latency (~1.3 s vs ~2.6 s). */
/** Levels Gemini 3.7 Flash accepts (no 'minimal'). */
export const EXP_RAG_THINKING_LEVELS=['low','medium','high'] as const;
export const EXP_RAG={mode:'EXP_RAG',model:'gemini-3.7-flash',thinkingLevel:'medium' as const,planModel:'gemini-3.5-flash-lite',version:'exp-rag-1.1'};
const CORE_FILE=path.resolve('src/rag/guidance/core-prompt.md');
let core:{text:string;hash:string;tokens:number}|null=null;
/** The cached EXP-RAG system instruction. Stable across turns and users, so one explicit cache serves all. */
export function expRagCorePrompt(){
  if(!core){const text=fs.readFileSync(CORE_FILE,'utf8');core={text,hash:crypto.createHash('sha256').update(text).digest('hex'),tokens:estimateTokens(text)};}
  return core;
}
/** Boot-time warm-up: core prompt, guidance vectors (default provider) and the index worker. Failures only disable dense retrieval. */
export function warmExpRag(){expRagCorePrompt();warmGuidance(resolveProvider())?.catch(()=>{});warehouseIndex.start();}

const lastQuestion=(content:string)=>{
  try{const p=JSON.parse(content);return p?.interaction?.question||formatAssistantMessageRich(content).split('\n').slice(1,3).join(' ');}catch{return content.slice(0,240);}
};
/** Retrieval query: the message itself, plus the open question and previous user turn when the message is short or referential. */
export function guidanceQuery(message:string,history:Array<{role:string;content:string}>):string{
  const words=message.trim().split(/\s+/).filter(Boolean).length;
  const referential=/\b(it|that|this|those|these|them|the (first|second|third|last|other) (one|option)|option|more|why|how so)\b/i.test(message);
  if(words>12&&!referential)return message;
  const lastAssistant=[...history].reverse().find(m=>m.role==='assistant');
  const lastUser=[...history].reverse().find(m=>m.role==='user');
  return [message,lastUser&&`Earlier: ${lastUser.content.slice(0,300)}`,lastAssistant&&`Assistant asked: ${lastQuestion(lastAssistant.content).slice(0,300)}`].filter(Boolean).join('\n');
}

const GREETING=/^(hi|hey|hello|hiya|howdy|yo|good (morning|afternoon|evening|day))( there| again| oala| yuzee)?[\s!.]*$/i;
const FAREWELL=/^(bye|goodbye|bye bye|see (you|ya)( later| soon)?|cya|take care|thanks|thank you|thx|ty|cheers|many thanks|that'?s all( for now)?|i'?m done( for now)?)( so much| a lot| heaps| for (your|the|all the|all your) help| oala)*[\s!.]*$/i;
/** Instant local replies for pure social turns, including mid-conversation, when no question is pending. */
export function expRagBypass(message:string,ctx:{hasHistory:boolean;activeKind?:string|null;structured:boolean;attachments:boolean}):null|{kind:'greeting'|'farewell';text:string}{
  if(ctx.structured||ctx.attachments||ctx.activeKind==='handoff')return null;
  const t=message.trim();
  // Explicit thanks/goodbye closes the turn even when a question is pending; it is never an answer to it.
  if(FAREWELL.test(t))return {kind:'farewell',text:"You're welcome. You can come back whenever you want to explore your next step."};
  // A pending question owns everything else, including a bare greeting.
  if(ctx.activeKind==='question')return null;
  if(GREETING.test(t))return {kind:'greeting',text:ctx.hasHistory?'Hi again. We can pick up where we left off, or start on something new. What would you like to look at?':"Hi, I'm Oala. I can help you explore courses, skills and career options. What would you like help with?"};
  return null;
}

const RESERVED=/<(\/?)(runtime_context|retrieved_guidance|retrieved_evidence|conversation_memory|conversation_summary|turn_notes|specialist_findings|user_message|module|lookup|catalogue|context)\b/gi;
/** Users cannot forge application sections: look-alike tags in user text are defanged. */
export const neutralise=(text:string)=>text.replace(RESERVED,'‹$1$2');

const KINDS:Record<string,ChunkKind[]>={
  COURSES:['qualification','course','short_course','unit'],
  CAREERS:['occupation','anzsco','qualification'],
  INDUSTRY:['occupation','anzsco','qualification'],
  SKILLS_JOBS:['occupation','unit','qualification','anzsco'],
  LOCAL:['occupation','qualification'],
};
const planTerms=(p:WarehouseQueryPlan&{queries?:string[]}|null)=>p?[...(p.queries||[]),...(p.occupation_queries||[]),...(p.role_queries||[]),...(p.skill_queries||[]),...(p.job_queries||[]),...(p.industry_queries||[]),...(p.provider_queries||[])].join('; '):'';

/** vectors: the chosen provider (guidance, evidence, recall). indexVector: always BGE, because the prebuilt
 * warehouse index stores BGE vectors; without BGE the index is searched lexically. */
export interface ExpRagStart{query:string;provider:EmbedProvider;vectors:Float32Array[];indexVector?:Float32Array;earlyHits:Promise<IndexHit[]>;startedAt:number;embedMs:number}
/** Starts work that does not depend on the warehouse lookup (query embedding + early index search). */
export async function startExpRagTurn(message:string,history:Array<{role:string;content:string}>,signal:AbortSignal,requestedProvider?:unknown):Promise<ExpRagStart>{
  const startedAt=Date.now();
  const provider=resolveProvider(requestedProvider);
  const query=guidanceQuery(message,history);
  const texts=query===message?[message]:[message,query];
  const tryEmbed=(p:EmbedProvider,list:string[])=>embedderAvailable(p)?embed(list,'query',{provider:p}).catch(()=>[] as Float32Array[]):Promise.resolve([] as Float32Array[]);
  const [vectors,bge]=await Promise.all([tryEmbed(provider,texts),provider==='bge'?Promise.resolve(null):tryEmbed('bge',[message])]);
  const indexVector=(bge??vectors)[0];
  const embedMs=Date.now()-startedAt;
  const earlyHits=needsWarehouse(message,history.filter(m=>m.role==='user').slice(-3).map(m=>m.content).join(' '))
    ?warehouseIndex.search({text:query,vector:indexVector},signal).catch(()=>[] as IndexHit[])
    :Promise.resolve([] as IndexHit[]);
  return {query,provider,vectors,indexVector,earlyHits,startedAt,embedMs};
}

export interface ExpRagTurnInput{
  start:ExpRagStart;
  message:string;
  /** Model-facing user input (raw text or USER_EVENT JSON). */
  userInput:string;
  structured:boolean;
  conv:{messages:any[];activeInteraction?:any;ragMemory?:RagMemory;careerContext?:Record<string,string|undefined>};
  pack:WarehousePack|null;
  plan:(WarehouseQueryPlan&{action?:string;queries?:string[]})|null;
  runtime:{date?:string;timezone?:string;location?:string;userFacts:string[];userQuestionAnswers:unknown[];coordination?:unknown;savedWorkspaces?:unknown[];workspaceVisible:boolean;workspaceAnswers?:unknown[]};
  context:Array<{label:string;text:string}>;
  turnNotes:string[];
  signal:AbortSignal;
  /** MULTI_AGENT: the merged <specialist_findings> block; awaited last, so guidance and evidence selection overlap the specialists. */
  specialists?:Promise<string>;
}
export interface ExpRagTurn{
  contents:Content[];userTurnText:string;history:HistoryPlan;guidance:GuidanceSelection;evidence:EvidenceSelection;specialists:string;
  recalled:Array<{id:string;text:string}>;sections:Array<{name:string;description:string;tokens:number;preview:string}>;telemetry:any;
}

function runtimeBlock(r:ExpRagTurnInput['runtime']):string{
  const lines=[
    r.date&&`Date: ${r.date}`,
    r.location?`User-stated location: ${r.location}`:r.timezone&&`Timezone: ${r.timezone} (not a location)`,
    r.userFacts.length&&`Saved profile facts (self-reported): ${r.userFacts.slice(0,8).join('; ')}`,
    r.userQuestionAnswers.length&&`Answers to clarification questions: ${JSON.stringify(r.userQuestionAnswers)}`,
    r.workspaceAnswers?.length&&`Workspace answers and corrections (self-reported, saved to this conversation): ${JSON.stringify(r.workspaceAnswers)}`,
    (r.workspaceVisible||(r.savedWorkspaces?.length??0)>0)&&r.coordination&&`Workspace coordination (server-validated): ${JSON.stringify(r.coordination)}`,
    r.savedWorkspaces?.length&&`Saved workspace results (AI output, not confirmed user facts): ${JSON.stringify(r.savedWorkspaces)}`,
  ].filter(Boolean);
  // Client-supplied facts/answers and saved AI output are data: look-alike section tags are defanged.
  return lines.length?`<runtime_context>\n${neutralise(lines.join('\n'))}\n</runtime_context>`:'';
}
const capsule=(c?:Record<string,unknown>)=>{const e=Object.entries(c||{}).map(([k,v])=>[k,typeof v==='string'?v.trim():v==null?'':String(v)] as const).filter(([,v])=>v);return e.length?neutralise(`Structured memory capsule (user-maintained): ${e.map(([k,v])=>`${k}: ${v}`).join('; ')}`):'';};

function buildContents(turns:DialogueTurn[],summary:string,careerCapsule:string,current:string):Content[]{
  const preamble=[summary&&`<conversation_summary>\n${summary.trim()}\n</conversation_summary>`,careerCapsule].filter(Boolean).join('\n\n');
  const complete=turns.filter(t=>t.assistantMessage);
  const contents:Content[]=[];
  complete.forEach((t,i)=>{
    contents.push({role:'user',parts:[{text:i===0&&preamble?`${preamble}\n\n${neutralise(t.userMessage.content)}`:neutralise(t.userMessage.content)}]});
    contents.push({role:'model',parts:[{text:formatAssistantMessageRich(t.assistantMessage!.content)}]});
  });
  contents.push({role:'user',parts:[{text:!complete.length&&preamble?`${preamble}\n\n${current}`:current}]});
  return contents;
}

export async function buildExpRagTurn(i:ExpRagTurnInput):Promise<ExpRagTurn>{
  const t0=Date.now();const history=planHistory(i.conv.messages,i.conv.ragMemory);
  const {query,vectors,provider}=i.start;
  const pack=i.pack;
  const exploration=pack?.connected?.exploration;
  // Catalogue index: only when the turn needs warehouse data and the planner did not rule it out.
  const tIndex=Date.now();
  const wantsData=pack?pack.status!=='NOT_NEEDED':false;
  let hits:IndexHit[]=[];
  if(wantsData&&i.plan?.action!=='NONE'){
    const kinds=i.plan?.action?KINDS[i.plan.action]:undefined;
    const terms=planTerms(i.plan);
    const codes=[...new Set((`${i.message} ${terms}`.match(/\b[A-Z]{3,5}\d{5}[A-Z]?\b/g)||[]))].map(c=>`qual:${c}`);
    // The planner's typed search terms get their own embedding: cleaner than the conversational message.
    const termVector=terms&&embedderAvailable('bge')?(await embed([terms],'query').catch(()=>[]))[0]:undefined;
    const [early,focused,exact]=await Promise.all([
      i.start.earlyHits,
      terms?warehouseIndex.search({text:terms,vector:termVector??i.start.indexVector,kinds,weights:{dense:1,lexical:1}},i.signal).catch(()=>[] as IndexHit[]):Promise.resolve([] as IndexHit[]),
      warehouseIndex.byIds(codes,i.signal).catch(()=>[] as IndexHit[]),
    ]);
    // Exact code matches always qualify; single subjects never outrank whole programs unless asked for.
    for(const h of exact)h.dense=1;
    const score=(h:IndexHit)=>(h.dense??0)+(h.lexicalRank!=null&&h.lexicalRank<3?0.02:0)-(h.meta?.subject&&!/\b(subject|unit)\b/i.test(i.message)?0.05:0);
    const seen=new Set<string>();
    hits=scopeCatalogue([...exact,...focused,...early.filter(h=>!kinds||kinds.includes(h.kind))],pack)
      .filter(h=>!seen.has(h.id)&&!!seen.add(h.id))
      .sort((a,b)=>score(b)-score(a));
  }
  const indexMs=Date.now()-tIndex;
  const tEvidence=Date.now();
  let lookup=packEvidence(pack);
  if(pack&&pack.status!=='READY'&&pack.status!=='NOT_NEEDED'&&hits.length){
    lookup=[{id:'status',group:'lookup',entity:'status',anchor:true,text:`[warehouse status] The live typed lookup is ${pack.status.toLowerCase()} for this turn; any catalogue index matches are shown below. Do not claim provider-specific fees, intakes, funding or local data that is not shown.`,tokens:60}];
  }
  const context:EvidenceChunk[]=i.context.map((c,n)=>({id:`context:${n}`,group:'context',entity:`context:${n}`,anchor:true,text:`[${c.label}] ${neutralise(c.text)}`,tokens:estimateTokens(c.text)}));
  const evidence=await selectEvidence(query,vectors,lookup,hits,context,undefined,provider);
  const evidenceMs=Date.now()-tEvidence;
  const triggers=detectTriggers({message:i.message,history:i.conv.messages,activeInteraction:i.conv.activeInteraction,structured:i.structured,
    warehouse:{ready:pack?.status==='READY'||evidence.catalogueCount>0,comparison:!!pack?.comparison,local:!!pack?.connected?.localOverview||!!i.plan?.facets?.includes('LOCAL'),skillsJobs:!!(exploration&&(exploration.roles.length||exploration.jobs.length||exploration.learning.length))},
    workspace:i.runtime.workspaceVisible||(i.runtime.savedWorkspaces?.length??0)>0||(i.runtime.workspaceAnswers?.length??0)>0,research:i.context.some(c=>/research/i.test(c.label))});
  const tGuide=Date.now();
  const guidance=await selectGuidance(query,triggers,vectors,undefined,provider);
  const guidanceMs=Date.now()-tGuide;
  const recalled=await recallStatements(query,vectors,history.recallPool,undefined,provider).catch(()=>[]);
  const memoryBlock=recalled.length?`<conversation_memory note="Earlier statements by the user, recalled verbatim because they relate to this turn.">\n${recalled.map(r=>`- "${neutralise(r.text.slice(0,600))}"`).join('\n')}\n</conversation_memory>`:'';
  const notes=i.turnNotes.filter(Boolean);
  const notesBlock=notes.length?`<turn_notes>\n${notes.join('\n\n')}\n</turn_notes>`:'';
  const guidanceBlock=renderGuidance(guidance);const evidenceBlock=renderEvidence(evidence);const runtime=runtimeBlock(i.runtime);
  const tSpec=Date.now();const specialistsBlock=i.specialists?await i.specialists:'';const specialistsWaitMs=Date.now()-tSpec;
  const userTurnText=[runtime,guidanceBlock,evidenceBlock,specialistsBlock,memoryBlock,notesBlock,`<user_message>\n${neutralise(i.userInput)}\n</user_message>`].filter(Boolean).join('\n\n');
  const careerCapsule=capsule(i.conv.careerContext);
  const contents=buildContents(history.keptTurns,history.summary,careerCapsule,userTurnText);
  const tok=(s:string)=>estimateTokens(s);
  const sections=[
    {name:'EXP-RAG core prompt (cached)',description:'Short cached system instruction',tokens:expRagCorePrompt().tokens,preview:expRagCorePrompt().text.slice(0,75)},
    ...(history.summary?[{name:'Rolling conversation summary',description:`Covers ${history.summarizedTurns} earlier turn(s)`,tokens:tok(history.summary),preview:history.summary.slice(0,75)}]:[]),
    ...(history.keptTurns.length?[{name:'Recent turns (verbatim)',description:`${history.keptTurns.length} turn(s)`,tokens:history.verbatimTokens,preview:history.keptTurns.at(-1)!.userMessage.content.slice(0,75)}]:[]),
    ...(runtime?[{name:'Runtime context',description:'Date, location, profile facts, workspace state',tokens:tok(runtime),preview:runtime.slice(18,93)}]:[]),
    ...(guidanceBlock?[{name:'Retrieved guidance',description:guidance.modules.map(m=>m.id).join(', '),tokens:tok(guidanceBlock),preview:guidance.modules.map(m=>m.title).join(' · ').slice(0,75)}]:[]),
    ...(evidenceBlock?[{name:'Retrieved evidence',description:`${evidence.lookupCount} lookup + ${evidence.catalogueCount} catalogue chunk(s)`,tokens:tok(evidenceBlock),preview:evidence.chunks[0]?.text.slice(0,75)||''}]:[]),
    ...(specialistsBlock?[{name:'Specialist findings',description:'Merged MULTI_AGENT specialist results',tokens:tok(specialistsBlock),preview:specialistsBlock.split('\n')[1]?.slice(0,75)||''}]:[]),
    ...(memoryBlock?[{name:'Recalled user statements',description:`${recalled.length} statement(s)`,tokens:tok(memoryBlock),preview:recalled[0].text.slice(0,75)}]:[]),
    ...(notesBlock?[{name:'Turn notes',description:'Server-owned advisory notes',tokens:tok(notesBlock),preview:notes[0].slice(0,75)}]:[]),
    {name:'Current User Input',description:'Active incoming prompt / UserEvent',tokens:tok(i.userInput),preview:i.userInput.slice(0,75)},
  ];
  const telemetry={
    version:EXP_RAG.version,guidanceVersion:GUIDANCE_VERSION,
    core:{tokens:expRagCorePrompt().tokens,hash:expRagCorePrompt().hash.slice(0,16)},
    embedder:embedderStatus(provider),indexDense:!!i.start.indexVector,index:warehouseIndex.status(),
    guidance:{tokens:guidance.tokens,modules:guidance.trace,dropped:guidance.dropped,triggers:guidance.triggers,dense:guidance.dense},
    evidence:{tokens:evidence.tokens,lookup:evidence.lookupCount,catalogue:evidence.catalogueCount,dropped:evidence.dropped,dense:evidence.dense,candidates:{lookup:lookup.length,catalogue:hits.length},ids:evidence.chunks.map(c=>c.id)},
    memory:{summaryTokens:tok(history.summary),summarizedTurns:history.summarizedTurns,verbatimTurns:history.keptTurns.length,verbatimTokens:history.verbatimTokens,recalled:recalled.length,droppedUnsummarized:history.droppedUnsummarized},
    latencyMs:{embed:i.start.embedMs,guidance:guidanceMs,index:indexMs,evidence:evidenceMs,assemble:Date.now()-t0,sinceStart:Date.now()-i.start.startedAt,...(i.specialists?{specialistsWait:specialistsWaitMs}:{})},
    ...(specialistsBlock?{specialists:{tokens:tok(specialistsBlock)}}:{}),
  };
  return {contents,userTurnText,history,guidance,evidence,specialists:specialistsBlock,recalled,sections,telemetry};
}

/** EXP-RAG review fast path: an approved answer costs a few output tokens instead of a full rewrite. */
export const EXP_REVIEW_VERDICT=`OUTPUT FOR THIS REVIEW: if the candidate needs no correction, return {"verdict":"OK"} and no content_blocks; wording preferences and optional polish are not corrections. Return {"verdict":"REVISE","content_blocks":[...]} with the complete corrected content_blocks only when a claim must be removed or qualified, material repetition or filler should go, or the answer misses what the user actually asked.`;
export const EXP_REVIEW_SCHEMA=(contentBlocks:unknown)=>({type:'object',properties:{verdict:{type:'string',enum:['OK','REVISE']},content_blocks:contentBlocks},required:['verdict']});
export function applyVerdictReview<T>(original:T,text:string,applyBlocks:(original:T,blocksJson:string)=>T):{value:T;verdict:'OK'|'REVISE'}{
  const r=JSON.parse(text);
  if(r?.verdict==='OK')return {value:original,verdict:'OK'};
  if(r?.verdict==='REVISE'&&Array.isArray(r.content_blocks)&&r.content_blocks.length)return {value:applyBlocks(original,JSON.stringify({content_blocks:r.content_blocks})),verdict:'REVISE'};
  throw Error('Incomplete teaching review');
}

/** A free-text question asks for one thing: "What do you do now, and would you prefer X or Y?" keeps its first ask.
 * Eval: 14 of 34 EXP-RAG questions joined two asks this way. */
export function trimCompoundQuestion(q:string):string{
  const first=q.match(/^[^?]{12,}\?/)?.[0]??q;
  const cut=first.match(/^(.{12,}?)(?:,|\s?[—–-])?\s*(?:and|or)\s+(?:are|do|does|would|is|have|has|will|did|can|could|should)\s+you\b/i);
  return cut?cut[1].replace(/[\s,;:—–-]+$/,'')+'?':first;
}
/** One visible question per turn: a compound free-text question keeps its first ask (questions with options are left
 * alone: the options may belong to the second clause), and a question ending the last prose block is a second ask,
 * so it is removed. Returns true when the response changed. */
export function enforceSingleQuestion(r:any):boolean{
  if(r?.interaction?.kind!=='question'||!r.interaction.question||!Array.isArray(r.content_blocks))return false;
  let changed=false;
  if(!r.interaction.options?.length){const q=trimCompoundQuestion(r.interaction.question);if(q!==r.interaction.question){r.interaction.question=q;changed=true;}}
  const i=r.content_blocks.map((b:any)=>b?.type).lastIndexOf('text');
  const b=r.content_blocks[i];if(!b||typeof b.text!=='string'||!/\?\s*$/.test(b.text))return changed;
  const kept=b.text.replace(/(^|[.!:;]\s+|\n+)[^.!?\n]*\?\s*$/,'$1').trimEnd();
  if(kept===b.text.trimEnd())return changed;
  if(kept)b.text=kept;else if(r.content_blocks.length>1)r.content_blocks.splice(i,1);else return changed;
  return true;
}

/** Gemini config for EXP-RAG: medium thinking on Gemini 3.7 Flash, prompt-only JSON like the default mode. */
export function expRagConfig(resolveThinking:(model:string,level:string)=>{thinkingConfig?:any;appliedThinkingLevel:any;numericBudget:number},opts:{temperature?:number;topP?:number;maxOutputTokens?:number;structuredSchema?:any;thinkingLevel?:string}){
  // The user may change the thinking level mid-chat; medium is the EXP-RAG default (and replaces 'adaptive').
  const level=opts.thinkingLevel&&EXP_RAG_THINKING_LEVELS.includes(opts.thinkingLevel as any)?opts.thinkingLevel:EXP_RAG.thinkingLevel;
  const thinking=resolveThinking(EXP_RAG.model,level);
  const config:GenerateContentConfig={
    systemInstruction:expRagCorePrompt().text,
    maxOutputTokens:opts.maxOutputTokens??65536,
    ...(opts.structuredSchema?{responseMimeType:'application/json',responseSchema:opts.structuredSchema}:{}),
    ...(opts.temperature!=null?{temperature:opts.temperature}:{}),
    ...(opts.topP!=null?{topP:opts.topP}:{}),
    ...(thinking.thinkingConfig?{thinkingConfig:thinking.thinkingConfig}:{}),
  };
  return {config,appliedThinkingLevel:thinking.appliedThinkingLevel,numericBudget:thinking.numericBudget};
}
