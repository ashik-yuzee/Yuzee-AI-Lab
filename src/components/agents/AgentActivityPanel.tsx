import React,{useEffect,useId,useState} from 'react';
import {Check,ChevronDown,Circle,AlertCircle,ArrowRight,Users,Scale,Recycle} from 'lucide-react';
import {AGENT_DISPLAY,type AgentActivity,type AgentFinding,type AgentResult,type NextAction,type OrchestrationViewModel} from '../../agents/contract';
import {dependencyLevels,isTerminal} from '../../agents/viewModel';

/** trackAgentEvent from the TokenLab context; passed in so these components render without a provider. */
export type TrackAgentEvent=(event:string,data:{orchestrationId:string;agent?:string;action?:string})=>void;

const STATUS_LABEL={queued:'Waiting',running:'Working',completed:'Done',failed:'Didn’t finish'} as const;
const FAILURE:Record<NonNullable<AgentResult['error']>['reason'],string>={
  TIMEOUT:'It ran out of time.',ERROR:'Something went wrong while checking.',CANCELLED:'It was cancelled.',SKIPPED_DEPENDENCY:'It needed a check that didn’t finish.',
};
const date=(iso?:string|null)=>{const d=iso?new Date(iso):null;return d&&!isNaN(+d)?d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):null;};
const confidence=(c:number)=>c>=.75?'High':c>=.5?'Medium':'Low';
const trimEllipsis=(m:string)=>m.replace(/(\.\.\.|…)\s*$/,''); // the UI adds its own while an agent works
const listJoin=(xs:string[])=>xs.length>1?`${xs.slice(0,-1).join(', ')} and ${xs.at(-1)}`:xs[0]||'';
const records=(n:number)=>`${n} ${n===1?'record':'records'}`;

function StatusIcon({activity,ended}:{activity:AgentActivity;ended:boolean}){
  // Unfinished agents in a finished turn are shown as not finished, never as still working.
  const status=ended&&(activity.status==='running'||activity.status==='queued')?'failed':activity.status;
  return <span className={`agent-icon is-${status}`}>
    {status==='completed'?<Check size={13} aria-hidden="true"/>:status==='failed'?<AlertCircle size={13} aria-hidden="true"/>:<Circle size={status==='running'?9:11} aria-hidden="true" fill={status==='running'?'currentColor':'none'}/>}
    <span className="sr-only">{STATUS_LABEL[status]}:</span>
  </span>;
}

function waitingFor(a:AgentActivity,all:AgentActivity[]){
  const open=a.dependsOn.map(id=>all.find(x=>x.id===id)).filter((x):x is AgentActivity=>!!x&&x.status!=='completed'&&x.status!=='failed');
  if(open.length>2)return 'Waiting for the other checks to finish'; // Pathway depends on every other agent
  return open.length?`Waiting for the ${open.map(x=>(AGENT_DISPLAY[x.type]?.short??x.displayName).toLowerCase()).join(' and ')} check`:'Getting ready';
}

function Finding({f}:{f:AgentFinding}){
  return <li><span className={`agent-basis is-${f.basis.toLowerCase()}`}>{f.basis==='FACT'?'Fact':'Interpretation'}</span><span>{f.text}</span></li>;
}

/** Expanded evidence for one specialist (spec §17). Everything shown comes from its AgentResult. */
export function AgentResultCard({result,id,onEvidence}:{result:AgentResult;id:string;onEvidence:()=>void}){
  const [sources,setSources]=useState(false);
  const findings=[...result.facts,...result.findings,...result.recommendations];
  return <div className="agent-result" id={id}>
    {result.status==='failed'&&<p className="agent-result-failed">This check didn’t finish. {result.error?FAILURE[result.error.reason]:''} Nothing from it was used in the answer.</p>}
    {findings.length>0&&<ul className="agent-findings">{findings.map((f,i)=><Finding key={i} f={f}/>)}</ul>}
    {result.missingData.length>0&&<div className="agent-result-section"><h5>Still to confirm</h5><ul>{result.missingData.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
    {result.warnings.length>0&&<div className="agent-result-section is-warning"><h5>Worth knowing</h5><ul>{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
    <p className="agent-result-meta">
      {result.status==='completed'&&<span>{confidence(result.confidence)} confidence</span>}
      {result.metrics.reused&&<span><Recycle size={12} aria-hidden="true"/>Reused from earlier in this conversation</span>}
      {result.metrics.durationMs>0&&<span>Took {(result.metrics.durationMs/1000).toFixed(1)}s</span>}
    </p>
    {result.sources.length>0&&<>
      <button type="button" className="agent-link" aria-expanded={sources} aria-controls={`${id}-sources`} onClick={()=>{if(!sources)onEvidence();setSources(!sources);}}>
        {sources?'Hide sources':`Show sources (${result.sources.length})`}<ChevronDown size={14} aria-hidden="true"/>
      </button>
      {sources&&<ul className="agent-sources" id={`${id}-sources`}>{result.sources.map(s=><li key={s.id}>
        <span>{s.label}</span>
        <small>{s.updatedAt&&date(s.updatedAt)?`Updated ${date(s.updatedAt)}`:`Checked ${date(s.retrievedAt)??'during this answer'}`}</small>
        {s.stale&&<span className="agent-stale">May be out of date</span>}
        {s.source==='INFERENCE'&&<span className="agent-stale">Interpretation</span>}
      </li>)}</ul>}
    </>}
  </div>;
}

function AgentRow({a,all,ended,orchestrationId,onTrack}:{a:AgentActivity;all:AgentActivity[];ended:boolean;orchestrationId:string;onTrack:TrackAgentEvent}){
  const id=useId(),[open,setOpen]=useState(false);
  const unfinished=ended&&(a.status==='running'||a.status==='queued');
  const message=unfinished?'Didn’t finish'
    :a.status==='queued'?waitingFor(a,all):a.status==='running'?a.currentMessage:a.summary||a.currentMessage;
  const sources=a.result?.sources.length??0;
  return <li className={`agent-row is-${unfinished?'failed':a.status}`}>
    <StatusIcon activity={a} ended={ended}/>
    <div className="agent-row-copy">
      <strong>{a.displayName}</strong>
      {message&&<span>{a.status==='running'&&!ended?<>{trimEllipsis(message)}<span aria-hidden="true">…</span></>:message}</span>}
      {a.result&&<button type="button" className="agent-link" aria-expanded={open} aria-controls={id}
        onClick={()=>{if(!open)onTrack('agent_result_expanded',{orchestrationId,agent:a.type});setOpen(!open);}}>
        {open?'Hide details':sources?`Details · ${records(sources)}`:'Details'}<ChevronDown size={14} aria-hidden="true"/>
      </button>}
      {open&&a.result&&<AgentResultCard id={id} result={a.result} onEvidence={()=>onTrack('agent_evidence_opened',{orchestrationId,agent:a.type})}/>}
    </div>
  </li>;
}

/** Levels 0–1: no team panel, at most one quiet status line and a "checked by" chip (spec §3, §27). */
function CompactStatus({view,onTrack}:{view:OrchestrationViewModel;onTrack:TrackAgentEvent}){
  const id=useId(),[openId,setOpenId]=useState<string|null>(null);
  const ended=isTerminal(view.state)||view.state==='composing';
  const running=view.activities.find(a=>a.status==='running');
  const done=view.activities.filter(a=>a.result);
  // The live region stays mounted (empty when idle) so the first message is announced.
  if(!ended)return <div className="agent-live" role="status" aria-live="polite">{running?.currentMessage&&<p className="agent-compact"><span className="agent-icon is-running" aria-hidden="true"><Circle size={9} fill="currentColor"/></span>{trimEllipsis(running.currentMessage)}…</p>}</div>;
  if(!done.length)return null;
  return <div className="agent-compact-done">{done.map(a=>{const open=openId===a.id;return <React.Fragment key={a.id}>
    <button type="button" className={`agent-chip is-${a.status}`} aria-expanded={open} aria-controls={`${id}-${a.id}`} onClick={()=>{if(!open)onTrack('agent_result_expanded',{orchestrationId:view.id,agent:a.type});setOpenId(open?null:a.id);}}>
      {a.status==='completed'?<Check size={12} aria-hidden="true"/>:<AlertCircle size={12} aria-hidden="true"/>}
      {a.status==='completed'?`Checked by the ${a.displayName}`:`The ${a.displayName} couldn’t finish`}{a.status==='completed'&&` · ${records(a.evidenceCount??0)}`}
      <ChevronDown size={12} aria-hidden="true"/>
    </button>
    {open&&a.result&&<AgentResultCard id={`${id}-${a.id}`} result={a.result} onEvidence={()=>onTrack('agent_evidence_opened',{orchestrationId:view.id,agent:a.type})}/>}
  </React.Fragment>;})}</div>;
}

/** "Your Yuzee team is working" (spec §15–17): real agents only, parallel agents side by side, collapses once Oala writes the answer. */
export function AgentActivityPanel({view,onTrack}:{view:OrchestrationViewModel;onTrack:TrackAgentEvent}){
  const id=useId();
  const [open,setOpen]=useState<boolean|null>(null);
  useEffect(()=>setOpen(null),[view.id]);
  if(!view.visible)return <CompactStatus view={view} onTrack={onTrack}/>;
  const ended=isTerminal(view.state);
  const answering=ended||view.state==='composing';
  const expanded=open??!answering; // the answer is primary once it starts
  const levels=dependencyLevels(view.activities);
  const conflicts=view.merge?.conflicts??[];
  const title=answering?(view.state==='failed'?'Your Yuzee team':'Oala has brought everything together.'):'Your Yuzee team is working';
  return <section className={`agent-panel is-${view.state}`} aria-labelledby={`${id}-title`}>
    <header className="agent-panel-header">
      <span className="agent-panel-icon" aria-hidden="true"><Users size={16}/></span>
      <div className="agent-panel-heading">
        <h4 id={`${id}-title`}>{title}</h4>
        {/* Announces state changes only (statusMessage changes per state), never each progress tick. */}
        <p role="status" aria-live="polite" aria-atomic="true">{answering&&view.state!=='failed'&&view.statusMessage===title
          ? `Checked by ${listJoin(view.activities.filter(a=>a.status==='completed').map(a=>AGENT_DISPLAY[a.type].short.toLowerCase()))} ${view.completedCount===1?'specialist':'specialists'}`
          : view.statusMessage}</p>
      </div>
      <button type="button" className="agent-panel-toggle" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={()=>setOpen(!expanded)}>
        <span>{view.completedCount} of {view.totalCount} {view.totalCount===1?'check':'checks'} complete</span>
        <ChevronDown size={16} aria-hidden="true"/>
        <span className="sr-only">{expanded?'Hide the team’s work':'Show the team’s work'}</span>
      </button>
    </header>
    {expanded&&<div className="agent-panel-body" id={`${id}-body`}>
      {view.understood&&<p className="agent-understood"><span>What I understood</span>{view.understood}</p>}
      {levels.map((row,i)=><div className="agent-level" key={i}>
        {i===0&&row.length>1&&<p className="agent-level-label">Working in parallel</p>}
        {i>0&&<p className="agent-level-label">Then</p>}
        <ul>{row.map(a=><AgentRow key={a.id} a={a} all={view.activities} ended={ended} orchestrationId={view.id} onTrack={onTrack}/>)}</ul>
      </div>)}
      {conflicts.length>0&&<div className="agent-nuance" role="note">
        <Scale size={15} aria-hidden="true"/>
        <div><strong>Not everything agreed</strong>{conflicts.map((c,i)=><p key={i}>{c.statements.join(' · ')} <small>({c.agents.map(t=>AGENT_DISPLAY[t]?.short??t).join(', ')})</small></p>)}</div>
      </div>}
      {view.merge&&view.merge.missingData.length>0&&<div className="agent-result-section"><h5>Still to confirm</h5><ul>{view.merge.missingData.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
    </div>}
  </section>;
}

/** Next actions the app can really perform (spec §30: no dead ends). */
// BUILD_PATHWAY opens the mini pathway when one can be offered, else sends its prompt; so it needs a prompt as the fallback.
export function actionable(a:NextAction):boolean{
  if(a.action==='UPDATE_PROFILE')return true;
  return ['ASK_FOLLOW_UP','COMPARE_COURSES','VIEW_JOB','REQUEST_JOB_MATCH','START_SKILL_ACTIVITY','BUILD_PATHWAY'].includes(a.action)&&!!a.prompt?.trim();
}
/** Asks MiniPathwayExperience to open/generate the mini pathway; returns false when no pathway can be offered right now. */
export const requestMiniPathway=()=>typeof window!=='undefined'&&!window.dispatchEvent(new CustomEvent('yuzee:build-pathway',{cancelable:true}));

const shown=new Set<string>();
export function AgentNextActions({view,disabled,onSend,onOpenProfile,onTrack}:{view:OrchestrationViewModel;disabled:boolean;onSend:(prompt:string)=>void;onOpenProfile:()=>void;onTrack:TrackAgentEvent}){
  const actions=[...view.nextActions].filter(actionable).sort((a,b)=>a.priority-b.priority).slice(0,4);
  const key=actions.map(a=>a.action).join(',');
  useEffect(()=>{for(const a of actions){const k=`${view.id}:${a.action}:${a.label}`;if(!shown.has(k)){shown.add(k);onTrack('agent_next_action_shown',{orchestrationId:view.id,action:a.action});}}},[view.id,key]);
  if(!actions.length)return null;
  const run=(a:NextAction)=>{
    onTrack('agent_next_action_clicked',{orchestrationId:view.id,action:a.action});
    if(a.action==='UPDATE_PROFILE')return onOpenProfile();
    if(a.action==='BUILD_PATHWAY'&&requestMiniPathway())return;
    if(a.prompt)onSend(a.prompt);
  };
  return <section className="agent-actions" aria-label="Suggested next steps">
    <h4>What you could do next</h4>
    {actions.map((a,i)=><button type="button" key={i} disabled={disabled&&a.action!=='UPDATE_PROFILE'} onClick={()=>run(a)}>
      <span><strong>{a.label}</strong>{a.reason&&<small>{a.reason}</small>}</span><ArrowRight size={17} aria-hidden="true"/>
    </button>)}
  </section>;
}
