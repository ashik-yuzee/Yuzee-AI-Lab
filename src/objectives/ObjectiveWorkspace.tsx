import '../warehouse/warehouse.css';
import {WarehouseConnections} from '../warehouse/WarehouseConnections';
import {WarehouseCourses} from '../warehouse/WarehouseCourses';
import {ContextDetails} from './ContextDetails';
import {WorkspaceResult,activityTitle,comparisonRows} from './WorkspaceResult';
import {AnswerHistory} from './ObjectiveHistory';
import {resultReady} from './workspacePolicy';
import React,{useEffect,useRef,useState} from 'react';
import {X,Maximize2,Minimize2,Compass,Search} from 'lucide-react';
import {useObjectives} from './ObjectiveContext';
import {useDrawerResize} from '../miniPathway/useDrawerResize';
import {PrimitiveRenderer} from './PrimitiveRenderer';
import './objectives.css';
export function ObjectiveWorkspace(){
 const o=useObjectives(),[expanded,setExpanded]=useState(false),[search,setSearch]=useState(''),[goal,setGoal]=useState('');
 const drawer=useDrawerResize(o.open,expanded,'yuzee-objective-workspace-width',1000),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(o.open)heading.current?.focus();},[o.open]);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(expanded)setExpanded(false);else o.setOpen(false);}};if(o.open)window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[o.open,expanded]);
 if(!o.enabled||!o.open)return null;
 const s=o.selected,p=s?.plan,cap=o.catalogue.find(x=>x.tool_id===s?.objectiveId)?.max_interactions;
 const rows=o.catalogue.filter(x=>`${x.button_label} ${x.topic_name} ${x.primary_category} ${x.tool_id}`.toLowerCase().includes(search.toLowerCase()));
 const warehouseComparison=s?.objectiveId==='STUDY_004'&&!!s?.context.warehouse_data?.comparison;
 const localDiscovery=s?.objectiveId==='DISCOVER_001'&&s?.context.warehouse_data?.status==='READY'&&!!s.context.warehouse_data.connected?.location?.region;
 const pending=p?.ui.some((c:any)=>c.required&&c.component!=='action_handoff');
 const supportingWarehouse=s&&<><WarehouseConnections localFirst={localDiscovery} pack={s.context.warehouse_data} onAreaChange={o.correct} onSaveExploration={o.saveExploration} onCourse={o.focusCourses} savedExploration={s.pendingCorrection?.explorationChoices||s.context.exploration_choices} disabled={o.busy||!!s.pendingAnswer||!!s.pendingCorrection||s.state==='CANCELLED'}/><WarehouseCourses pack={s.context.warehouse_data} selectedIds={s.context.selected_course_ids||[]} onFocus={o.focusCourses} disabled={o.busy||!!s.pendingAnswer||!!s.pendingCorrection||s.state==='CANCELLED'}/></>;
 const close=()=>o.setOpen(false);
 return <aside className={'objective-workspace'+(expanded?' expanded':'')} style={expanded?undefined:{width:drawer.width}} aria-label="Activity workspace">
  {!expanded&&<div className="objective-resize" {...drawer.separatorProps} aria-label="Resize activity workspace" aria-controls="objective-body"><span/></div>}
  <header><Compass size={23}/><div><small>YOUR WORKSPACE · PREVIEW</small><h2 ref={heading} tabIndex={-1}>{o.catalogueOpen?'Explore activities':activityTitle(s)}</h2></div><button aria-label={expanded?'Restore activity panel':'Expand activity panel'} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button><button aria-label="Close activity workspace" onClick={close}><X size={21}/></button></header>
  <div className="objective-workspace-nav"><button disabled={o.busy} onClick={()=>o.setCatalogueOpen(!o.catalogueOpen)}>{o.catalogueOpen&&s?'Back to my activity':'Browse (testing)'}</button>{o.sessions.length>0&&<select aria-label="Saved activities" disabled={o.busy} value={o.selectedId} onChange={e=>{o.setSelectedId(e.target.value);o.setCatalogueOpen(false);}}>{o.sessions.map(s=><option key={s.id} value={s.id}>{activityTitle(s)} · {s.state==='COMPLETE'?'Complete':s.state==='CANCELLED'?'Closed':'In progress'}</option>)}</select>}</div>
  <div id="objective-body" className="objective-body" aria-busy={o.busy}>
   {o.error&&<div className="objective-error" role="alert">{o.error}<button onClick={()=>o.setError('')}>Dismiss</button></div>}
   {o.busy&&<div className="objective-loading" role="status"><strong>Preparing your next useful step…</strong><p>Your answers stay visible while we prepare the next step.</p><i/><i/><i/><button onClick={o.stop}>Stop</button></div>}
   {o.catalogueOpen&&!o.busy?<>
    <p>Choose one question to work through. We will use what you have already shared and ask only for details that matter.</p>
    <p className="objective-muted">Preview: courses, career links and regional information are connected. External profile saving and live vacancy search are not connected. Two objectives are held for a source contract review.</p>
    <label className="objective-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search interests, courses, skills, jobs…" aria-label="Search activities"/></label>
    <label className="objective-text-answer">Anything to focus on? (optional)<textarea rows={2} maxLength={4000} value={goal} onChange={e=>setGoal(e.target.value)} placeholder="Use the current conversation, or add a specific question."/></label>
    <p className="objective-muted">{rows.length} {rows.length===1?'activity':'activities'}</p>
    <div className="objective-catalogue">{rows.map(item=><button key={item.tool_id} disabled={!item.available} onClick={()=>o.start(item.tool_id,goal)}><small>{item.primary_category}</small><strong>{item.button_label}</strong><span>{item.clear_purpose}</span><small>{!item.available?'Awaiting contract review':`Up to ${item.max_interactions} steps · ${item.tool_id}`}</small></button>)}</div>
   </>:p&&<>
    {s?.state==='CANCELLED'&&<p className="objective-progress">Activity closed</p>}
    {localDiscovery?null:warehouseComparison?<p className="objective-summary">{p.result.summary}</p>:comparisonRows(p.result)?<WorkspaceResult result={p.result}/>:<>
     {p.ui.filter((c:any)=>!c.required&&c.component!=='action_handoff').map((c:any)=><PrimitiveRenderer key={`${s?.id}:${s?.revision}:${c.id}`} hideKnown component={c} plan={p} onAnswer={o.answer} disabled={o.busy}/>)}
     {!p.ui.some((c:any)=>!c.required&&c.component!=='action_handoff')?<WorkspaceResult result={p.result}/>:p.result.summary&&<p className="objective-summary">{p.result.summary}</p>}
    </>}
    {s&&warehouseComparison&&<WarehouseCourses pack={s.context.warehouse_data} selectedIds={s.context.selected_course_ids||[]} onFocus={o.focusCourses} disabled={o.busy||!!s.pendingAnswer||!!s.pendingCorrection||s.state==='CANCELLED'}/>}
    {s&&warehouseComparison&&<details><summary>Related places, careers and local information</summary><WarehouseConnections pack={s.context.warehouse_data} onAreaChange={o.correct} onSaveExploration={o.saveExploration} onCourse={o.focusCourses} savedExploration={s.pendingCorrection?.explorationChoices||s.context.exploration_choices} disabled={o.busy||!!s.pendingAnswer||!!s.pendingCorrection||s.state==='CANCELLED'}/></details>}
    {s&&!warehouseComparison&&(localDiscovery?supportingWarehouse:s.context.warehouse_data?.status==='READY'?<details className="objective-supporting-data"><summary>Explore related careers, skills and local information</summary>{supportingWarehouse}</details>:null)}
    {localDiscovery&&p.result.interest_themes?.length>0&&<section className="discovery-themes"><h3>Interests taking shape</h3><p>{p.result.summary||"Based on the activities you have explored so far:"}</p><ul>{p.result.interest_themes.map((theme:any,i:number)=><li key={i}>{theme.label}</li>)}</ul></section>}
    {s&&<AnswerHistory session={s}/>}
    {s?.pendingAnswer&&!o.busy&&<div className="objective-saved-pending"><p>Your answer is saved. We still need to prepare the result.</p><button className="objective-primary" onClick={o.retry}>Retry with saved answer</button></div>}
    {pending&&!s?.pendingAnswer&&<section className="objective-refinement"><h3>Explore this further</h3>{p.ui.filter((c:any)=>c.required&&c.component!=='action_handoff').map((c:any)=><PrimitiveRenderer key={`${s?.id}:${s?.revision}:${c.id}`} hideKnown component={c} plan={p} onAnswer={o.answer} disabled={o.busy||!!s?.pendingCorrection||s?.state!=='ACTIVE'}/>)}</section>}
    {s&&<ContextDetails key={`${s.id}:${s.revision}`} session={s} onCorrect={o.correct} onRetry={o.retryCorrection} disabled={o.busy||!!s.pendingAnswer||s.state==='CANCELLED'}/>}
    {p.derived_signals.length>0&&<details><summary>How this was interpreted</summary>{p.derived_signals.map((d:any,i:number)=><p key={i}><strong>{d.signal}</strong> — {d.basis} <small>(AI interpretation)</small></p>)}</details>}
    {!localDiscovery&&p.unknowns.length>0&&<div className="objective-gaps"><strong>Still to check</strong><ul>{p.unknowns.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>}
    {p.readiness.blockers.length>0&&<div className="objective-gaps"><strong>Before the next step</strong><ul>{p.readiness.blockers.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>}
    {p.status==='NEEDS_RESEARCH'&&<p className="objective-gaps">Some information needed for this activity is not in the current results. Your work stays saved here.</p>}
    {s&&resultReady(s)&&<p className="objective-muted" role="status">Saved here. Oala can use these details when you next send a message.</p>}
    {s?.state==='ACTIVE'&&<button className="objective-cancel" disabled={o.busy} onClick={o.cancel}>End this activity</button>}
    <p className="objective-muted">Your answers are saved with this conversation. They do not change your profile or submit applications.</p>
   </>}
  </div>
 </aside>;
}
