/** MULTI_AGENT UI view model: a pure reducer over the orchestration events (contract.ts). Browser-safe. */
import {AGENT_DISPLAY,type AgentActivity,type OrchestrationEvent,type OrchestrationRecord,type OrchestrationState,type OrchestrationViewModel} from './contract';

/** Human status line per state (spec §4, §18). The server's own display message wins when an event carries one. */
export const STATUS_MESSAGE:Record<OrchestrationState,string>={
  idle:'',
  understanding_request:'I’m reading your question.',
  planning:'I’m working out who should check this.',
  agents_running:'Your Yuzee team is checking the details.',
  merging:'I’m bringing the results together now.',
  composing:'Oala has brought everything together.',
  completed:'Oala has brought everything together.',
  partial_failure:'Oala has brought together what finished. Some checks didn’t complete.',
  failed:'The team couldn’t finish this time.',
};
const ORDER:OrchestrationState[]=['idle','understanding_request','planning','agents_running','merging','composing'];
export const isTerminal=(s:OrchestrationState)=>s==='completed'||s==='partial_failure'||s==='failed';
/** States only move forward; late agent events never pull a merging turn back to "running". */
const advance=(from:OrchestrationState,to:OrchestrationState)=>isTerminal(from)||ORDER.indexOf(to)<=ORDER.indexOf(from)?from:to;

function counted(vm:OrchestrationViewModel):OrchestrationViewModel{
  const done=vm.activities.filter(a=>a.status==='completed'||a.status==='failed').length;
  return {...vm,totalCount:vm.activities.length,completedCount:done,runningCount:vm.activities.filter(a=>a.status==='running').length};
}
const empty=(id:string):OrchestrationViewModel=>({id,complexityLevel:0,state:'understanding_request',understood:'',visible:false,activities:[],completedCount:0,totalCount:0,runningCount:0,nextActions:[],statusMessage:STATUS_MESSAGE.understanding_request});

function patch(vm:OrchestrationViewModel,agentId:string,agent:AgentActivity['type'],change:Partial<AgentActivity>):AgentActivity[]{
  const known=vm.activities.some(a=>a.id===agentId);
  // An agent the plan did not list is still shown: it really ran.
  const list=known?vm.activities:[...vm.activities,{id:agentId,type:agent,displayName:AGENT_DISPLAY[agent]?.title??agent,status:'queued' as const,dependsOn:[]}];
  return list.map(a=>a.id===agentId?{...a,...change}:a);
}

export function applyOrchestrationEvent(prev:OrchestrationViewModel|null,ev:OrchestrationEvent):OrchestrationViewModel{
  if(ev.type==='RESPONSE_COMPLETED')return viewModelFromRecord(ev.record);
  // A new id is a new turn: never mix two orchestrations.
  const vm=ev.type==='ORCHESTRATION_STARTED'||!prev||prev.id!==ev.orchestrationId?empty(ev.orchestrationId):prev;
  const to=(state:OrchestrationState,message?:string)=>{const next=advance(vm.state,state);return {state:next,statusMessage:next===vm.state&&!message?vm.statusMessage:message||STATUS_MESSAGE[next]};};
  switch(ev.type){
    case 'ORCHESTRATION_STARTED':return vm;
    // May arrive twice (rules, then rules+planner): the refined plan replaces it but keeps each agent's live state.
    case 'PLAN_CREATED':return counted({...vm,...to('planning'),complexityLevel:ev.plan.complexityLevel,understood:ev.plan.understood,visible:ev.plan.visible,
      activities:[...ev.plan.agents.map(a=>({...(vm.activities.find(x=>x.id===a.id)??{status:'queued' as const}),id:a.id,type:a.type,displayName:AGENT_DISPLAY[a.type]?.title??a.type,dependsOn:a.dependsOn})),
        ...vm.activities.filter(x=>!ev.plan.agents.some(a=>a.id===x.id))]});
    case 'AGENT_STARTED':return counted({...vm,...to('agents_running'),activities:patch(vm,ev.agentId,ev.agent,{status:'running',currentMessage:ev.display.message,startedAt:ev.at})});
    case 'AGENT_PROGRESS':return {...vm,activities:patch(vm,ev.agentId,ev.agent,{currentMessage:ev.display.message})};
    case 'AGENT_COMPLETED':case 'AGENT_FAILED':return counted({...vm,...to('agents_running'),activities:patch(vm,ev.agentId,ev.agent,{
      status:ev.type==='AGENT_COMPLETED'?'completed':'failed',currentMessage:ev.display.message,summary:ev.result.summary||ev.display.message,
      completedAt:ev.at,evidenceCount:ev.result.sources.length,result:ev.result})});
    case 'MERGE_STARTED':return {...vm,...to('merging',ev.display.message)};
    case 'MERGE_COMPLETED':return {...vm,...to('merging',ev.display.message),merge:ev.merge,nextActions:ev.nextActions};
    case 'RESPONSE_STREAM_STARTED':return {...vm,...to('composing',ev.display.message)};
  }
  return vm;
}

/** Rebuilds the view from the record persisted on the assistant message (history, reload, conversation switch). */
export function viewModelFromRecord(record:OrchestrationRecord):OrchestrationViewModel{
  const activities:AgentActivity[]=record.plan.agents.map(a=>{
    const result=record.results.find(r=>r.taskId===a.id)??record.results.find(r=>r.agent===a.type&&!record.plan.agents.some(p=>p.id===r.taskId));
    return {id:a.id,type:a.type,displayName:AGENT_DISPLAY[a.type]?.title??a.type,dependsOn:a.dependsOn,
      status:result?.status??'queued',summary:result?.summary,currentMessage:result?.summary,evidenceCount:result?.sources.length,result};
  });
  return counted({id:record.id,complexityLevel:record.plan.complexityLevel,state:record.state,understood:record.plan.understood,visible:record.plan.visible,
    activities,completedCount:0,totalCount:0,runningCount:0,merge:record.merge??undefined,nextActions:record.nextActions??[],statusMessage:STATUS_MESSAGE[record.state]});
}

/** The stream ended (error or Stop) before RESPONSE_COMPLETED: say so instead of leaving agents "running". */
export function interruptOrchestration(vm:OrchestrationViewModel,stopped:boolean):OrchestrationViewModel{
  if(isTerminal(vm.state))return vm;
  const message=stopped?'Stopped before finishing':'Didn’t finish';
  return counted({...vm,state:'failed',statusMessage:stopped?'Stopped before the team finished.':STATUS_MESSAGE.failed,
    activities:vm.activities.map(a=>a.status==='running'||a.status==='queued'?{...a,status:'failed',currentMessage:message}:a)});
}

/** Parallel layout (spec §16): agents at the same dependency depth run side by side. */
export function dependencyLevels(activities:AgentActivity[]):AgentActivity[][]{
  const byId=new Map(activities.map(a=>[a.id,a])),depth=new Map<string,number>();
  const level=(a:AgentActivity,seen:Set<string>):number=>{
    if(depth.has(a.id))return depth.get(a.id)!;
    if(seen.has(a.id))return 0; // ponytail: cycle guard only; the planner never emits cycles
    seen.add(a.id);
    const d=Math.max(-1,...a.dependsOn.map(id=>byId.get(id)).filter((x):x is AgentActivity=>!!x).map(x=>level(x,seen)))+1;
    depth.set(a.id,d);return d;
  };
  const rows:AgentActivity[][]=[];
  for(const a of activities)(rows[level(a,new Set())]??=[]).push(a);
  return rows.filter(Boolean);
}
