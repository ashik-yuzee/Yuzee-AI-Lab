/**
 * MULTI_AGENT orchestrator (spec §5, §23, §40). A real DAG executor: each specialist starts as soon as its declared
 * dependencies finish, independent ones run concurrently, every agent has a timeout and at most one retry on
 * 429/5xx, the request AbortSignal cancels pending and running work, and a failed agent never fails the run.
 */
import crypto from 'node:crypto';
import type {AgentResult,AgentType,MergeOutcome,NextAction,OrchestrationEvent,OrchestrationPlan,OrchestrationRecord,PlannedAgent} from './contract';
import {AGENT_DISPLAY} from './contract';
import {AGENTS,REGISTRY_VERSION,agentEnabled} from './registry';
import {buildPlan,refinePlan,type Route} from './router';
import {makeRunner,profileHash,type SpecialistDeps,type PlannerView} from './specialists';
import {mergeResults,renderPackage} from './merger';

export type AgentOutput=Omit<AgentResult,'agent'|'taskId'|'status'|'execution'|'metrics'|'error'>&{metrics?:Partial<AgentResult['metrics']>;displayMessage?:string};
export interface RunCtx{signal:AbortSignal;progress:(message:string)=>void;upstream:AgentResult[];attempt:number}
export type Runner=(node:PlannedAgent,ctx:RunCtx)=>Promise<AgentOutput>;
export interface DagOptions{
  orchestrationId:string;agents:PlannedAgent[];run:Runner;emit:(e:OrchestrationEvent)=>void;signal:AbortSignal;
  timeoutMs:(t:AgentType)=>number;startMessage:(t:AgentType)=>string;
  /** Agents that need at least one upstream result; they are SKIPPED_DEPENDENCY when every dependency failed. */
  needsUpstream:(t:AgentType)=>boolean;
  /** Shared input the agent waits for after it starts (the warehouse lookup); its timeout starts afterwards. */
  gate?:(n:PlannedAgent)=>Promise<unknown>|undefined;
}
const MIN_RETRY_MS=2000;
const retryable=(e:any)=>{const s=Number(e?.status??e?.httpStatus??e?.code);return s===429||s>=500&&s<600;};
const failed=(o:DagOptions,n:PlannedAgent,reason:NonNullable<AgentResult['error']>['reason'],message:string,durationMs=0):AgentResult=>({agent:n.type,taskId:`${o.orchestrationId}:${n.id}`,status:'failed',execution:n.execution,summary:'',facts:[],findings:[],recommendations:[],missingData:[],sources:[],confidence:0,warnings:[],metrics:{durationMs},error:{reason,message}});
const FAIL_TEXT:Record<string,string>={TIMEOUT:"Didn't finish in time, so I've left it out rather than guessing",ERROR:"Couldn't complete this check, so I've left it out rather than guessing",CANCELLED:'Stopped because the question changed',SKIPPED_DEPENDENCY:'Skipped because the checks it builds on did not finish'};

export function runDag(o:DagOptions){
  const nodes=new Map(o.agents.map(a=>[a.id,{...a,dependsOn:[...a.dependsOn]}]));
  const results=new Map<string,AgentResult>();const running=new Map<string,Promise<void>>();
  let wake=()=>{};const onRunAbort=()=>wake();o.signal.addEventListener('abort',onRunAbort);
  const at=()=>Date.now();
  const emitDone=(n:PlannedAgent,r:AgentResult,display?:string)=>o.emit(r.status==='completed'
    ?{type:'AGENT_COMPLETED',orchestrationId:o.orchestrationId,at:at(),agentId:n.id,agent:n.type,display:{title:AGENT_DISPLAY[n.type].title,message:display||r.summary},result:r}
    :{type:'AGENT_FAILED',orchestrationId:o.orchestrationId,at:at(),agentId:n.id,agent:n.type,display:{title:AGENT_DISPLAY[n.type].title,message:FAIL_TEXT[r.error!.reason]},result:r});

  async function execute(n:PlannedAgent,upstream:AgentResult[]):Promise<{r:AgentResult;display?:string}>{
    const t0=at();let finished=false;
    const progress=(message:string)=>{if(!finished&&!o.signal.aborted)o.emit({type:'AGENT_PROGRESS',orchestrationId:o.orchestrationId,at:at(),agentId:n.id,agent:n.type,display:{message}});};
    const ac=new AbortController();
    const cancel=()=>ac.abort(Object.assign(Error('Cancelled'),{code:'CANCELLED'}));
    if(o.signal.aborted)cancel();else o.signal.addEventListener('abort',cancel,{once:true});
    const aborted=new Promise<never>((_,reject)=>ac.signal.addEventListener('abort',()=>reject(ac.signal.reason),{once:true}));aborted.catch(()=>{});
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const gate=o.gate?.(n);
      if(gate)await Promise.race([gate,aborted]);
      const ms=o.timeoutMs(n.type);const deadline=at()+ms;
      timer=setTimeout(()=>ac.abort(Object.assign(Error(`Timed out after ${ms} ms`),{code:'TIMEOUT'})),ms);
      for(let attempt=1;;attempt++){
        try{
          const out=await Promise.race([o.run(n,{signal:ac.signal,progress,upstream,attempt}),aborted]);
          const {displayMessage,metrics,...rest}=out;
          return {r:{...rest,agent:n.type,taskId:`${o.orchestrationId}:${n.id}`,status:'completed',execution:n.execution,metrics:{...metrics,durationMs:metrics?.reused?0:at()-t0}},display:displayMessage};
        }catch(e){if(ac.signal.aborted||attempt>1||!retryable(e)||deadline-at()<MIN_RETRY_MS)throw e;progress('Retrying after a temporary provider error');}
      }
    }catch(e:any){
      const reason=e?.code==='TIMEOUT'?'TIMEOUT':e?.code==='CANCELLED'||o.signal.aborted?'CANCELLED':'ERROR';
      return {r:failed(o,n,reason,String(e?.message||e).slice(0,200),at()-t0)};
    }finally{finished=true;clearTimeout(timer);o.signal.removeEventListener('abort',cancel);}
  }
  function start(n:PlannedAgent,upstream:AgentResult[]){
    o.emit({type:'AGENT_STARTED',orchestrationId:o.orchestrationId,at:at(),agentId:n.id,agent:n.type,display:{title:AGENT_DISPLAY[n.type].title,message:o.startMessage(n.type)}});
    running.set(n.id,execute(n,upstream).then(({r,display})=>{results.set(n.id,r);running.delete(n.id);if(!o.signal.aborted||r.status==='completed')emitDone(n,r,display);wake();}));
  }
  const done=(async()=>{
    for(;;){
      if(o.signal.aborted){
        // Pending work never starts; running agents observe the same signal and settle as CANCELLED.
        for(const n of nodes.values())if(!results.has(n.id)&&!running.has(n.id))results.set(n.id,failed(o,n,'CANCELLED','Cancelled before it started'));
        await Promise.all(running.values());break;
      }
      let changed=true;
      while(changed){
        changed=false;
        for(const n of nodes.values()){
          if(results.has(n.id)||running.has(n.id))continue;
          const deps=n.dependsOn.filter(d=>nodes.has(d)&&d!==n.id);
          if(!deps.every(d=>results.has(d)))continue;
          const upstream=deps.map(d=>results.get(d)!);
          if(deps.length&&o.needsUpstream(n.type)&&upstream.every(u=>u.status==='failed')){const r=failed(o,n,'SKIPPED_DEPENDENCY','Every check it depends on failed');results.set(n.id,r);emitDone(n,r);changed=true;continue;}
          start(n,upstream);
        }
      }
      if(!running.size){
        for(const n of nodes.values())if(!results.has(n.id)){const r=failed(o,n,'SKIPPED_DEPENDENCY','Unresolvable dependency');results.set(n.id,r);emitDone(n,r);}
        break;
      }
      await new Promise<void>(r=>{wake=r;});
    }
    o.signal.removeEventListener('abort',onRunAbort);
    return [...nodes.values()].map(n=>results.get(n.id)!);
  })();
  /** Adds agents/dependencies from a refined plan. A node that already started keeps its original dependencies. */
  const extend=(agents:PlannedAgent[])=>{for(const a of agents){const n=nodes.get(a.id);if(!n)nodes.set(a.id,{...a,dependsOn:[...a.dependsOn]});else if(!results.has(a.id)&&!running.has(a.id))n.dependsOn=[...new Set([...n.dependsOn,...a.dependsOn])];}wake();};
  return {done,extend};
}

// ── Turn-level glue ──────────────────────────────────────────────────────────────────────────────────────────────
export const MULTI_AGENT_VERSION=`multi-agent-1.0/${REGISTRY_VERSION}`;
/** Composer thinking for the final Oala answer (Gemini 3.7 Flash) when the user's level is missing or unsupported. */
export const MULTI_AGENT_COMPOSER_THINKING:'low'|'medium'|'high'='medium';
/** The Composer thinking control applies as chosen. A step-down on team turns (specialists already did the analysis)
 * was tested on 4–5 Oct 2026: 'low' was ~4 s faster but ranked last in 9 of 14 blind judgements (unsupported timelines,
 * generic picks), so 'medium' stays the default and 'low' is the user's fast option. */
export const composerThinking=(chosen:string|undefined)=>chosen==='low'||chosen==='medium'||chosen==='high'?chosen:MULTI_AGENT_COMPOSER_THINKING;
export const MULTI_AGENT_NOTE=`MULTI_AGENT turn. <specialist_findings> holds the merged, evidence-checked results of the specialists who worked on this request. Write ONE coherent Oala answer, never a list of agent reports, and do not name the internal specialists or say "agents". Use the ANSWER PLAN at the top of the package as your outline. Tie every recommendation to what this user said about themselves (their experience, constraints, place). The user can open the team's detailed findings next to your answer, so do not restate them line by line. When you cite a figure or record, say where it comes from in plain words (e.g. "Jobs and Skills Australia projects…", "recent job ads in the sample ask for…"); mention record-level details such as employer names or percentages only when they directly answer the question. When the user names a place, name the local providers or options from the evidence. Structure: direct answer first; one short sentence on what you checked, in plain words (e.g. "I looked at your experience, recent teaching assistant job records and short training options"); what was found; what it means for this user; the best next action; alternatives where they exist. Keep FACT and INFERENCE apart: never present an inference, projection or historical-only outlook as a current fact. Preserve every listed conflict as nuance ("many employers ask for X, but it is not universal"). When a check did not finish, say plainly that you left it out rather than guessing, and do not fill the gap. Job records are not confirmed open today. Ask a question only when the answer would change your advice, make it specific to this user's goal, and ask only one; never a generic profile question such as their highest qualification unless qualifications decide between the routes you gave. The <retrieved_evidence> records remain the source of truth for names, figures and dates.`;

const profileCache=new Map<string,AgentResult>();
export const rememberProfile=(conversationId:string,r:AgentResult)=>{if(r.status==='completed'&&!r.metrics.reused){profileCache.delete(conversationId);profileCache.set(conversationId,r);if(profileCache.size>500)profileCache.delete(profileCache.keys().next().value!);}};
/** Same profile inputs as a completed earlier review (this process or a persisted record) → reuse it. */
export function findReusableProfile(conversationId:string,hash:string,records:Array<OrchestrationRecord|undefined>):AgentResult|null{
  const ok=(r?:AgentResult|null)=>r&&r.agent==='PROFILE_SPECIALIST'&&r.status==='completed'&&(r.data as any)?.inputHash===hash?r:null;
  return ok(profileCache.get(conversationId))||records.slice().reverse().map(rec=>ok(rec?.results.find(r=>r.agent==='PROFILE_SPECIALIST'))).find(Boolean)||null;
}

export interface MultiAgentRun{
  id:string;startedAt:number;
  /** Feed the warehouse planner's validated plan (WarehouseInput.onPlan). */
  onPlan:(p:PlannerView)=>void;
  plan:()=>OrchestrationPlan;
  done:Promise<{results:AgentResult[];merge:MergeOutcome;nextActions:NextAction[];block:string;agentsMs:number}>;
}
export interface MultiAgentInput{
  conversationId:string;message:string;route:Route;signal:AbortSignal;emit:(e:OrchestrationEvent)=>void;
  deps:Omit<SpecialistDeps,'target'|'planner'|'reusableProfile'|'company'>;
  priorRecords:Array<OrchestrationRecord|undefined>;
  /** Test hook (non-production only): these agents are forced to time out. */
  debugFail?:Set<AgentType>;
}
export function startMultiAgent(i:MultiAgentInput):MultiAgentRun{
  const id=`orch-${crypto.randomUUID()}`;const startedAt=Date.now();
  let plan=buildPlan(i.route,agentEnabled);let target=i.route.target;let planner:PlannerView|null=null;
  const emit=(e:any)=>i.emit({orchestrationId:id,at:Date.now(),...e});
  emit({type:'ORCHESTRATION_STARTED',state:'understanding_request'});
  emit({type:'PLAN_CREATED',plan});
  console.log('[multi-agent] classified',JSON.stringify({id,level:plan.complexityLevel,domains:plan.domains,agents:plan.agents.map(a=>a.type),signals:plan.classifier.signals}));
  const deps:SpecialistDeps={...i.deps,target:()=>target,planner:()=>planner,company:i.route.company,
    reusableProfile:hash=>findReusableProfile(i.conversationId,hash,i.priorRecords)};
  const real=makeRunner(deps);
  const run:Runner=(n,ctx)=>i.debugFail?.has(n.type)?new Promise<never>(()=>{}):real(n,ctx);
  const isData=(t:AgentType)=>t!=='PROFILE_SPECIALIST';
  const dag=runDag({orchestrationId:id,agents:plan.agents,run,emit:i.emit,signal:i.signal,
    timeoutMs:t=>AGENTS[t].timeoutMs,startMessage:t=>AGENTS[t].status(target,i.route.company),
    needsUpstream:t=>AGENTS[t].requiredInputs.includes('specialist_results'),gate:n=>isData(n.type)?i.deps.pack:undefined});
  const done=dag.done.then(results=>{
    const agentsMs=Date.now()-startedAt;
    for(const r of results)if(r.agent==='PROFILE_SPECIALIST')rememberProfile(i.conversationId,r);
    for(const r of results)if(r.status==='failed'&&r.error?.reason!=='CANCELLED')console.warn('[multi-agent] agent failed',JSON.stringify({id,agent:r.agent,reason:r.error?.reason,message:r.error?.message,ms:r.metrics.durationMs}));
    emit({type:'MERGE_STARTED',display:{message:'Bringing the results together'}});
    const {merge,nextActions}=mergeResults(results,plan);
    emit({type:'MERGE_COMPLETED',merge,nextActions,display:{message:merge.failedAgents.length?`I have enough to answer; ${merge.failedAgents.length} check${merge.failedAgents.length===1?'':'s'} didn't finish`:'I have enough evidence to start bringing this together'}});
    return {results,merge,nextActions,block:plan.complexityLevel>=2?renderPackage(results,merge,nextActions):'',agentsMs};
  });
  return {id,startedAt,plan:()=>plan,done,onPlan:p=>{
    planner=p;
    const refined=refinePlan(plan,{...i.route,target},p,agentEnabled);
    if(!refined)return;
    plan=refined.plan;target=refined.target;
    console.log('[multi-agent] refined',JSON.stringify({id,agents:plan.agents.map(a=>a.type),signals:plan.classifier.signals}));
    emit({type:'PLAN_CREATED',plan});
    dag.extend(plan.agents);
  }};
}

/** The persisted record (assistant MessageItem.orchestration). */
export function orchestrationRecord(run:MultiAgentRun,out:Awaited<MultiAgentRun['done']>,composeMs?:number):OrchestrationRecord{
  const ok=out.results.filter(r=>r.status==='completed');
  return {id:run.id,version:MULTI_AGENT_VERSION,plan:run.plan(),results:out.results,merge:out.merge,nextActions:out.nextActions,
    state:!out.results.length||ok.length===out.results.length?'completed':ok.length?'partial_failure':'failed',startedAt:run.startedAt,completedAt:Date.now(),
    metrics:{totalMs:Date.now()-run.startedAt,agentsMs:out.agentsMs,...(composeMs!=null?{composeMs}:{}),
      agentCostUsd:out.results.reduce((n,r)=>n+(r.metrics.reused?0:r.metrics.costUsd||0),0),
      agentTokens:out.results.reduce((n,r)=>n+(r.metrics.reused?0:(r.metrics.inputTokens||0)-(r.metrics.cachedTokens||0)+(r.metrics.outputTokens||0)+(r.metrics.thinkingTokens||0)),0),
      reusedResults:out.results.filter(r=>r.metrics.reused).length}};
}
