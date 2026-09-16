import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, ArrowLeft, ArrowRight, BookOpen, Building2, Check, ChevronDown, ChevronRight, Compass, Download, FlaskConical, GraduationCap, Layers, MapPin, MessageCircle, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { Action, Context, Event, Inputs, Result, Trace, actionInputs, catalog, definitions, entities, journeys, makeResult, missingFields, portableResult, signature, startJourney, suggestions, validateEvent } from './engine';
import './style.css';
import CounsellorChat from './CounsellorChat';
import { StreamingStatus } from './StreamingStatus';
import { Progress } from '../shared/stream';
import { StreamScenario, pause } from './chat-client';
const icons = [GraduationCap, Compass, Building2, BookOpen, Layers];
export default function App() {
  const [journeyId,setJourneyId]=useState('study');
  const [sessions,setSessions]=useState<Record<string,Result[]>>({study:[startJourney('study')]});
  const [selections,setSelections]=useState<Record<string,string>>({study:'root-study'});
  const history=sessions[journeyId]??[];
  const current=history.find(x=>x.id===selections[journeyId])??history[0];
  const [pending,setPending]=useState<Action|null>(null);
  const [inputs,setInputs]=useState<Inputs>({});
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<Progress>({phase:'waiting',source:'fixture'});
  const [startedAt,setStartedAt]=useState(0);
  const [streamScenario,setStreamScenario]=useState<StreamScenario>('normal');
  const microAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>microAbort.current?.abort(),[]);
  const [more,setMore]=useState(false);
  const [inspect,setInspect]=useState(false);
  const [done,setDone]=useState(false);
  const [simulation,setSimulation]=useState<'normal'|'no_data'|'error'>('normal');
  const [trace,setTrace]=useState<Trace[]>([]);
  const [lastEvent,setLastEvent]=useState<Event|null>(null);
  const sequence=useRef(0), requestSequence=useRef(0), impressions=useRef(new Set<string>());
  const titleRef=useRef<HTMLHeadingElement>(null);
  const allActions=suggestions(current,history,5), actions=more?allActions:allActions.slice(0,3);
  const journey=journeys.find(x=>x.id===journeyId)!;
  const record=(item:Omit<Trace,'at'>)=>setTrace(t=>[...t,{at:new Date().toISOString(),...item}]);
  useEffect(()=>{
    for(const a of actions) {
      const key=`${journeyId}:${current.id}:${a.toolId}:${a.entityRefs.map(e=>e.id).join(',')}`;
      if(!impressions.current.has(key)) {impressions.current.add(key);record({type:'impression',toolId:a.toolId,parentId:current.id,entityIds:a.entityRefs.map(e=>e.id)});}
    }
  },[current.id,journeyId,more,history.length]);
  useEffect(()=>{if(pending)document.getElementById('detail-0')?.focus();},[pending]);
  function navigate(id:string) {
    requestSequence.current++;microAbort.current?.abort();setBusy(false);setSelections(s=>({...s,[journeyId]:id}));setPending(null);setNotice('');setDone(false);setMore(false);
    record({type:'navigate',resultId:id});
  }
  function switchJourney(id:string) {
    requestSequence.current++;microAbort.current?.abort();setBusy(false);setJourneyId(id);setPending(null);setNotice('');setDone(false);setMore(false);
    if(!sessions[id]) {const root=startJourney(id);setSessions(s=>({...s,[id]:[root]}));setSelections(s=>({...s,[id]:root.id}));}
  }
  function choose(action:Action) {
    setNotice('');setDone(false);
    record({type:'click',toolId:action.toolId,parentId:current.id,entityIds:action.entityRefs.map(e=>e.id)});
    const fields=missingFields(action,current.context);
    if(fields.length) {setPending(action);setInputs({...current.context.inputs});record({type:'needs_input',toolId:action.toolId,parentId:current.id});return;}
    execute(action,current.context);
  }
  async function execute(action:Action,context:Context,force=false) {
    const event:Event={version:'microtools-poc/1',conversationId:journeyId,parentMessageId:current.id,action,inputValues:actionInputs(action,context)};
    try {validateEvent(event,current,context);}catch(e) {setNotice((e as Error).message);return;}
    const existing=history.find(x=>x.signature===signature(action,context)&&x.status==='answer');
    if(existing&&!force) {navigate(existing.id);setNotice('You have already explored this. Here is your saved answer.');return;}
    const requestId=++requestSequence.current;
    setLastEvent(event);setBusy(true);setPending(null);setStartedAt(Date.now());setProgress({phase:'waiting',source:'fixture'});
    microAbort.current?.abort();const abort=new AbortController();microAbort.current=abort;
    try {
      await pause(250,abort.signal);
      if(streamScenario!=='no_summary')setProgress({phase:'thinking',source:'fixture'});
      await pause(streamScenario==='slow'?13500:1000,abort.signal);
      setProgress({phase:'receiving',source:'fixture'});await pause(250,abort.signal);
      setProgress({phase:'checking',source:'fixture'});await pause(150,abort.signal);
    } catch { return; }
    if(requestSequence.current!==requestId)return;
    const result=makeResult(action.toolId,context,action.entityRefs,current.id,`answer-${++sequence.current}`,['interrupted','invalid'].includes(streamScenario)?'error':simulation);
    setSessions(s=>({...s,[journeyId]:[...s[journeyId],result]}));setSelections(s=>({...s,[journeyId]:result.id}));
    setBusy(false);setMore(false);setNotice('');record({type:'result',toolId:result.toolId,resultId:result.id,parentId:current.id,status:result.status});
    requestAnimationFrame(()=>{titleRef.current?.focus();titleRef.current?.scrollIntoView({behavior:'smooth',block:'start'});});
  }
  function retry() {
    const parent=history.find(x=>x.id===current.parentId);
    if(!parent)return;
    const refs=current.entities.filter(e=>e.type===definitions[current.toolId].type).slice(0,1);
    const event:Event={version:'microtools-poc/1',conversationId:journeyId,parentMessageId:parent.id,action:{type:'MICRO_TOOL',toolId:current.toolId,entityRefs:refs,label:definitions[current.toolId].label,why:'Retry the same question.'}};
    event.inputValues=actionInputs(event.action,current.context);
    try {validateEvent(event,parent,current.context);const next=makeResult(current.toolId,current.context,refs,parent.id,`answer-${++sequence.current}`,['interrupted','invalid'].includes(streamScenario)?'error':simulation);setSessions(s=>({...s,[journeyId]:[...s[journeyId],next]}));setSelections(s=>({...s,[journeyId]:next.id}));setLastEvent(event);record({type:'result',toolId:next.toolId,resultId:next.id,parentId:parent.id,status:next.status});}catch(e){setNotice((e as Error).message);}
  }
  function downloadTrace() {
    const data={version:'microtools-poc/1',mode:'fixture',note:'Local test events only. Free-text answers, questions and location are intentionally omitted.',events:trace};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='yuzee-concept-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const breadcrumbs:Result[]=[];let ancestor:Result|undefined=current;const seen=new Set<string>();
  while(ancestor&&!seen.has(ancestor.id)) {breadcrumbs.unshift(ancestor);seen.add(ancestor.id);ancestor=history.find(r=>r.id===ancestor?.parentId);}
  const required=pending?missingFields(pending,current.context):[];
  return <div className="concept">
    <header className="topbar"><a href="/" className="brand" aria-label="Yuzee concept home"><span className="brandmark">y</span>yuzee<span className="brand-divider"/> <span className="product-name">Explore together</span></a><span className="concept-badge"><FlaskConical size={14}/> Separate concept</span></header>
    <div className="shell">
      <aside className="sidebar"><div className="sidebar-intro"><span className="eyebrow">A LITTLE CURIOSITY. MORE POSSIBILITY.</span><h1>Where would you<br/>like to start?</h1><p>Pick an example. Follow what matters to you.</p></div>
        <nav aria-label="Example journeys" className="journeys">{journeys.map((j,i)=>{const Icon=icons[i];return <button key={j.id} className={journeyId===j.id?'journey selected':'journey'} aria-current={journeyId===j.id?'page':undefined} onClick={()=>switchJourney(j.id)}><span className="journey-icon"><Icon size={20}/></span><span><strong>{j.name}</strong><small>{j.audience}</small></span><ChevronRight size={16}/></button>;})}</nav>
        <div className="sidebar-note"><span className="note-icon"><MessageCircle size={19}/></span><strong>You set the pace.</strong><p>Explore one question at a time. Come back to any answer, or stop when you have enough.</p></div>
        <button className="inspector-toggle" onClick={()=>setInspect(!inspect)} aria-expanded={inspect}><FlaskConical size={15}/>{inspect?'Hide concept lab':'Open concept lab'}<ChevronRight size={14}/></button>
      </aside>
      <main>
        <div className="sample-notice"><FlaskConical size={17}/><p><strong>Explore with sample course information.</strong> Try the conversation below in sample mode or with live Gemini. Provider research is not connected.</p></div>
        <section className="workspace" aria-label="Exploration">
          <div className="section-top"><div><span className="eyebrow">YOUR EXPLORATION</span><h2>{journey.name}</h2></div><span className="step-count">{breadcrumbs.length===1?'Start here':`Step ${breadcrumbs.length}`}</span></div>
          {breadcrumbs.length>1&&<nav className="breadcrumbs" aria-label="Answer path">{breadcrumbs.map((r,i)=><React.Fragment key={r.id}>{i>0&&<ChevronRight size={13}/>}<button onClick={()=>navigate(r.id)} aria-current={r.id===current.id?'step':undefined}>{i===0?'Starting point':definitions[r.toolId].label}</button></React.Fragment>)}</nav>}
          <div className="question-context"><MessageCircle size={17}/><span>{current.parentId?definitions[current.toolId].label:journey.question}</span></div>
          <article className={`answer-card ${current.status!=='answer'?'incomplete':''}`} aria-busy={busy}>
            <div className="answer-meta"><span className="answer-icon"><Sparkles size={18}/></span><span>{current.status==='answer'?'A clearer picture':'Still to find out'}</span><span className="sample-pill">{current.status==='answer'?'Sample answer':'Information needed'}</span></div>
            <h3 ref={titleRef} tabIndex={-1}>{current.title}</h3><p className="answer-summary">{current.summary}</p>
            {current.toolId==='COURSE_002'?<div className="comparison">{current.findings.map((f,i)=><div key={i} className={i===2?'comparison-caveat':''}><h4>{f.label}</h4><p>{f.text}</p></div>)}</div>:<div className="findings">{current.findings.map((f,i)=><div className={`finding ${f.state==='UNKNOWN'?'unknown':''}`} key={i}><span className="finding-index">{f.state==='UNKNOWN'?'?':String(i+1).padStart(2,'0')}</span><div><h4>{f.label}</h4><p>{f.text}</p></div></div>)}</div>}
            {current.unresolvedQuestions.length>0&&<div className="open-questions"><strong>What still needs an answer</strong>{current.unresolvedQuestions.map(q=><p key={q}>{q}</p>)}</div>}
            <details className="evidence"><summary>Where this information comes from <ChevronDown size={15}/></summary><div><p>Written sample content for testing this experience. There are no retrieved sources or verified claims. Names and connections are illustrative.</p><p>A connected version must supply the source, its date, relevant location, and whether a finding is confirmed, observed, inferred or projected.</p></div></details>
            {current.status!=='answer'&&<div className="recovery"><button className="secondary" onClick={()=>current.parentId&&navigate(current.parentId)}><ArrowLeft size={16}/>Back to my answer</button>{current.toolId!=='COURSE_011'&&<button className="secondary" onClick={retry}><RotateCcw size={15}/>Try sample again</button>}</div>}
          </article>
          {busy&&<div className="micro-stream"><div className="micro-request">{lastEvent?.action.label}</div><StreamingStatus progress={progress} startedAt={startedAt} onStop={()=>{requestSequence.current++;microAbort.current?.abort();setBusy(false);setNotice("Stopped. Your earlier answer is still here. Choose the question again whenever you are ready.");}}/></div>}
          {notice&&<div className="notice" role="status"><MessageCircle size={18}/><p>{notice}</p><button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={16}/></button></div>}
          {pending&&!busy?<section className="clarification" aria-labelledby="clarify-title"><div className="clarify-top"><span className="small-icon"><MessageCircle size={20}/></span><button aria-label="Cancel question" onClick={()=>setPending(null)}><X size={19}/></button></div><h3 id="clarify-title">A little detail will help</h3><p>For “{pending.label.toLowerCase()}”, we need {required.length===1?'one detail':'a few details'}. Your earlier choices stay with this exploration.</p><form onSubmit={e=>{e.preventDefault();execute(pending,{...current.context,inputs:{...inputs}});}}>{required.map((f,i)=><label key={f.key} className="field" htmlFor={`detail-${i}`}><span>{f.label}</span><small>{f.hint}</small>{f.options||f.kind==='course'?<select id={`detail-${i}`} required value={inputs[f.key]??''} onChange={e=>setInputs({...inputs,[f.key]:e.target.value})}><option value="">Choose an option</option>{f.kind==='course'?Object.values(entities).filter(e=>e.type==='course'&&e.id!==pending.entityRefs[0].id).map(e=><option key={e.id} value={e.id}>{e.name}</option>):f.options?.map(o=><option key={o}>{o}</option>)}</select>:<input id={`detail-${i}`} required maxLength={500} value={inputs[f.key]??''} autoComplete="off" onChange={e=>setInputs({...inputs,[f.key]:e.target.value})}/>}</label>)}<div className="form-footer"><span>Kept in this tab only</span><button className="primary" type="submit">Continue <ArrowRight size={16}/></button></div></form></section>:!busy&&current.status==='answer'&&!done&&<section className="next-section" aria-labelledby="next-title"><div className="next-heading"><div><h3 id="next-title">{actions.length?'What would you like to know next?':'You have reached a useful stopping point.'}</h3><p>{actions.length?'Choose a question, or ask in your own words.':'Return to an earlier answer to explore a different direction.'}</p></div><span className="branch-symbol"><ArrowUpRight size={22}/></span></div><div className="action-grid">{actions.map(a=><button key={`${a.toolId}-${a.entityRefs[0].id}`} className="action-card" onClick={()=>choose(a)}><span className="action-top"><Search size={17}/><ArrowUpRight size={17}/></span><strong>{a.label}</strong><small>{a.why}</small><span className="action-footer">{missingFields(a,current.context).length?'A quick question first':'Explore this'}<ArrowRight size={14}/></span></button>)}</div>{allActions.length>3&&<button className="more-options" aria-expanded={more} onClick={()=>setMore(!more)}>{more?'Show fewer questions':`See ${allActions.length-3} more ${allActions.length-3===1?'question':'questions'}`}<ChevronDown size={14}/></button>}
            <button className="finish" onClick={()=>{setDone(true);record({type:'finish',resultId:current.id});}}><Check size={16}/>I have enough for now</button></section>}
          {done&&<section className="finished" role="status"><span className="small-icon"><Check size={22}/></span><h3>Take it at your own pace.</h3><p>Your answers will stay here while this tab is open. You can come back to another question whenever you are ready.</p><button className="secondary" onClick={()=>setDone(false)}>Keep exploring <ArrowRight size={16}/></button></section>}
          <CounsellorChat journeyId={journeyId} contextId={current.id} card={{title:current.title,summary:current.summary}} disabled={busy||!!pending||done} scenario={streamScenario}/>
          {history.length>1&&<details className="history"><summary><Layers size={17}/>Your saved answers <span>{history.length}</span><ChevronDown size={15}/></summary><div>{history.map((r,i)=><button key={r.id} onClick={()=>navigate(r.id)} aria-current={r.id===current.id?'true':undefined}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{r.title}</strong><small>{r.parentId?`From: ${history.find(x=>x.id===r.parentId)?.title??'Earlier answer'}`:'Starting point'}{r.status!=='answer'?' · No answer yet':''}</small></div><ArrowUpRight size={16}/></button>)}</div></details>}
          <footer className="workspace-footer"><MapPin size={13}/><span>Location is only requested when it is needed. You enter it yourself.</span></footer>
        </section>
      </main>
    </div>
    {inspect&&<section className="lab" aria-label="Concept lab"><div className="lab-header"><div><span className="eyebrow">FOR REVIEWING THE CONCEPT</span><h2>What happens behind each click</h2></div><button aria-label="Close concept lab" onClick={()=>setInspect(false)}><X size={20}/></button></div><p>{catalog.length} tools in the registry · {Object.keys(definitions).length} sample adapters · 40 shared rules to implement and verify before production. Suggestions use reviewed links and required inputs. Optional live Gemini counselling is available below the cards. The micro-tool adapters still use sample data; no live provider service is connected.</p><div className="lab-controls"><label htmlFor="simulation">Next sample response<select id="simulation" value={simulation} onChange={e=>setSimulation(e.target.value as typeof simulation)}><option value="normal">Normal sample</option><option value="no_data">No data returned</option><option value="error">Service error</option></select></label><label htmlFor="stream-scenario">Stream demonstration<select id="stream-scenario" value={streamScenario} onChange={e=>setStreamScenario(e.target.value as StreamScenario)}><option value="normal">Normal stream</option><option value="no_summary">No thought summary</option><option value="slow">Slow response</option><option value="interrupted">Interrupted stream</option><option value="invalid">Invalid answer</option></select></label><button className="secondary" onClick={downloadTrace}><Download size={16}/>Download {trace.length} test events</button></div><div className="pipeline"><span>Explicit click</span><ChevronRight size={15}/><span>Check context & inputs</span><ChevronRight size={15}/><span>Sample adapter</span><ChevronRight size={15}/><span>Typed answer</span></div><details><summary>Latest action event</summary><pre>{JSON.stringify(lastEvent?{...lastEvent,action:{...lastEvent.action,entityRefs:lastEvent.action.entityRefs.map(({id,type})=>({id,type}))}}:{note:'Select a question to create an action event.'},null,2)}</pre></details><details><summary>Current answer contract</summary><pre>{JSON.stringify(portableResult(current,history),null,2)}</pre></details><details><summary>Registry connection for this answer</summary><pre>{JSON.stringify(catalog.find(t=>t.id===current.toolId),null,2)}</pre></details><p className="lab-small">Test events stay in memory until you explicitly download them. They omit questions, profile text and location. Prompt bodies are kept outside this frontend.</p></section>}
  </div>;
}
