import assert from 'node:assert/strict';
import {applyOrchestrationEvent,viewModelFromRecord,interruptOrchestration,dependencyLevels,STATUS_MESSAGE} from '../src/agents/viewModel';
import type {AgentResult,OrchestrationEvent,OrchestrationPlan,OrchestrationRecord,OrchestrationViewModel} from '../src/agents/contract';

const id='orch-1';let at=0;
const ev=(e:any)=>({orchestrationId:id,at:++at,...e}) as OrchestrationEvent;
const result=(agent:any,taskId:string,status:'completed'|'failed'='completed'):AgentResult=>({agent,taskId,status,execution:'analysis',summary:`${agent} done`,facts:[],findings:[{text:'Demand is rising',basis:'INFERENCE',evidenceIds:['e1']}],recommendations:[],missingData:[],
  sources:[{id:'e1',source:'JOB_FEED',label:'Job record',retrievedAt:'2026-10-01T00:00:00Z'}],confidence:.7,warnings:[],metrics:{durationMs:900},...(status==='failed'?{error:{reason:'TIMEOUT',message:'timed out'}}:{})});
const rules:OrchestrationPlan={complexityLevel:3,domains:['PROFILE','SKILLS'],understood:'You want to become a UX designer.',visible:true,classifier:{method:'rules',signals:[]},
  agents:[{id:'p',type:'PROFILE_SPECIALIST',dependsOn:[],execution:'analysis',task:''},{id:'j',type:'JOBS_SPECIALIST',dependsOn:[],execution:'analysis',task:''}]};
const refined:OrchestrationPlan={...rules,classifier:{method:'rules+planner',signals:[]},agents:[...rules.agents,{id:'l',type:'LEARNING_SPECIALIST',dependsOn:['j'],execution:'analysis',task:''}]};

let vm:OrchestrationViewModel|null=null;
const step=(e:any)=>(vm=applyOrchestrationEvent(vm,ev(e)));
step({type:'ORCHESTRATION_STARTED',state:'understanding_request'});
assert.equal(vm!.state,'understanding_request');assert.equal(vm!.totalCount,0);
step({type:'PLAN_CREATED',plan:rules});
assert.equal(vm!.state,'planning');assert.equal(vm!.totalCount,2);assert.equal(vm!.activities[0].displayName,'Profile Specialist');
step({type:'AGENT_STARTED',agentId:'p',agent:'PROFILE_SPECIALIST',display:{title:'Profile',message:'I’m checking your profile now.'}});
step({type:'AGENT_STARTED',agentId:'j',agent:'JOBS_SPECIALIST',display:{title:'Jobs',message:'Checking current roles…'}});
assert.equal(vm!.state,'agents_running');assert.equal(vm!.runningCount,2);
// Refined plan replaces the first one but keeps live agent state and adds the new agent.
step({type:'PLAN_CREATED',plan:refined});
assert.equal(vm!.state,'agents_running','a late plan never moves the state back');
assert.equal(vm!.totalCount,3);assert.equal(vm!.runningCount,2);assert.equal(vm!.activities.find(a=>a.id==='p')!.currentMessage,'I’m checking your profile now.');
assert.deepEqual(dependencyLevels(vm!.activities).map(r=>r.map(a=>a.id)),[['p','j'],['l']],'independent agents share a level; dependants sit below');
step({type:'AGENT_PROGRESS',agentId:'j',agent:'JOBS_SPECIALIST',display:{message:'Reading 46 roles…'}});
assert.equal(vm!.activities.find(a=>a.id==='j')!.currentMessage,'Reading 46 roles…');assert.equal(vm!.runningCount,2,'progress does not change counts');
step({type:'AGENT_COMPLETED',agentId:'p',agent:'PROFILE_SPECIALIST',display:{title:'Profile',message:'Reviewed your experience'},result:{...result('PROFILE_SPECIALIST','p'),metrics:{durationMs:0,reused:true}}});
step({type:'AGENT_FAILED',agentId:'j',agent:'JOBS_SPECIALIST',display:{title:'Jobs',message:'Couldn’t check roles in time'},result:result('JOBS_SPECIALIST','j','failed')});
assert.equal(vm!.completedCount,2);assert.equal(vm!.runningCount,0);assert.equal(vm!.activities.find(a=>a.id==='j')!.status,'failed');
assert.equal(vm!.activities.find(a=>a.id==='p')!.evidenceCount,1);
step({type:'MERGE_STARTED',display:{message:'I’m bringing the results together now.'}});
assert.equal(vm!.state,'merging');assert.equal(vm!.statusMessage,'I’m bringing the results together now.');
// A late agent event keeps the turn in merging.
step({type:'AGENT_COMPLETED',agentId:'l',agent:'LEARNING_SPECIALIST',display:{title:'Learning',message:'Found 3 courses'},result:result('LEARNING_SPECIALIST','l')});
assert.equal(vm!.state,'merging');assert.equal(vm!.completedCount,3);
step({type:'MERGE_COMPLETED',merge:{confidence:.6,conflicts:[],missingData:[],staleEvidence:0,counts:{facts:1,findings:2,duplicatesRemoved:0,evidence:3},failedAgents:['JOBS_SPECIALIST']},nextActions:[{action:'ASK_FOLLOW_UP',label:'Ask',reason:'r',priority:1,prompt:'p'}],display:{message:'I have enough evidence to start bringing this together.'}});
assert.equal(vm!.nextActions.length,1);assert.equal(vm!.merge!.failedAgents[0],'JOBS_SPECIALIST');
step({type:'RESPONSE_STREAM_STARTED',display:{message:''}});
assert.equal(vm!.state,'composing');assert.equal(vm!.statusMessage,STATUS_MESSAGE.composing);

const record:OrchestrationRecord={id,version:'1',plan:refined,results:[result('PROFILE_SPECIALIST','p'),result('JOBS_SPECIALIST','j','failed'),result('LEARNING_SPECIALIST','l')],merge:vm!.merge!,nextActions:vm!.nextActions,state:'partial_failure',startedAt:0,completedAt:5,
  metrics:{totalMs:5,agentsMs:3,agentCostUsd:0,agentTokens:0,reusedResults:1}};
step({type:'RESPONSE_COMPLETED',record});
assert.equal(vm!.state,'partial_failure');assert.equal(vm!.completedCount,3);assert.equal(vm!.totalCount,3);assert.equal(vm!.runningCount,0);
assert.deepEqual(viewModelFromRecord(record),vm,'the saved record rebuilds the same view');
assert.equal(applyOrchestrationEvent(vm,ev({type:'RESPONSE_STREAM_STARTED',display:{message:'x'}})).state,'partial_failure','terminal states are final');

// A new orchestration id starts a fresh view; interrupted turns never leave agents "running".
const next=applyOrchestrationEvent(vm,{orchestrationId:'orch-2',at:99,type:'AGENT_STARTED',agentId:'m',agent:'MARKET_SPECIALIST',display:{title:'Market',message:'Checking demand…'}});
assert.equal(next.id,'orch-2');assert.equal(next.totalCount,1);assert.equal(next.runningCount,1);
const stopped=interruptOrchestration(next,true);
assert.equal(stopped.state,'failed');assert.equal(stopped.runningCount,0);assert.equal(stopped.activities[0].status,'failed');assert.match(stopped.statusMessage!,/Stopped/);
assert.equal(interruptOrchestration(vm!,false),vm,'a finished turn is left alone');
console.log('agents view model: all checks passed');

// Markup: what the panel says, and that actions without a working handler are not rendered.
const React=(await import('react')).default;
const {renderToStaticMarkup}=await import('react-dom/server');
const {AgentActivityPanel,AgentNextActions,actionable}=await import('../src/components/agents/AgentActivityPanel');
const noop=()=>{};
let live:OrchestrationViewModel|null=null;
for(const e of [{type:'ORCHESTRATION_STARTED'},{type:'PLAN_CREATED',plan:refined},{type:'AGENT_STARTED',agentId:'j',agent:'JOBS_SPECIALIST',display:{title:'Jobs',message:'Checking current UX designer roles'}}])live=applyOrchestrationEvent(live,ev(e));
const running=renderToStaticMarkup(React.createElement(AgentActivityPanel,{view:live!,onTrack:noop}));
assert.match(running,/Your Yuzee team is working/);assert.match(running,/0 of 3 checks complete/);assert.match(running,/Working in parallel/);
assert.match(running,/Waiting for the jobs check/,'only a real dependency is described as waiting');assert.match(running,/role="status"/);assert.match(running,/aria-expanded="true"/);
assert.doesNotMatch(running,/progress|%/i,'no fake progress');
const done=renderToStaticMarkup(React.createElement(AgentActivityPanel,{view:viewModelFromRecord({...record,merge:{...record.merge!,conflicts:[{subject:'demand',agents:['JOBS_SPECIALIST','MARKET_SPECIALIST'],statements:['Demand is rising','Demand is flat']}]}}),onTrack:noop}));
assert.match(done,/Oala has brought everything together\./);assert.match(done,/aria-expanded="false"/,'collapsed once the answer is there');assert.doesNotMatch(done,/Working in parallel/);
const compact=renderToStaticMarkup(React.createElement(AgentActivityPanel,{view:{...viewModelFromRecord({...record,plan:{...refined,visible:false,agents:[refined.agents[1]]},results:[result('JOBS_SPECIALIST','j')],state:'completed'})},onTrack:noop}));
assert.match(compact,/Checked by the Jobs Specialist · 1 record/);assert.doesNotMatch(compact,/Your Yuzee team/);
const act=(action:any,prompt?:string)=>({action,label:action,reason:'',priority:1,prompt});
assert.equal(actionable(act('ASK_FOLLOW_UP','Tell me more')),true);assert.equal(actionable(act('ASK_FOLLOW_UP')),false);
assert.equal(actionable(act('UPDATE_PROFILE')),true);assert.equal(actionable(act('SAVE_JOB','Save it')),false,'no handler, not rendered');
const actions=renderToStaticMarkup(React.createElement(AgentNextActions,{view:{...vm!,nextActions:[act('SAVE_JOB','x'),act('VIEW_JOB','Show me the roles'),act('UPDATE_PROFILE')]},disabled:false,onSend:noop,onOpenProfile:noop,onTrack:noop}));
assert.match(actions,/VIEW_JOB/);assert.match(actions,/UPDATE_PROFILE/);assert.doesNotMatch(actions,/SAVE_JOB/);
console.log('agents panel markup: all checks passed');
