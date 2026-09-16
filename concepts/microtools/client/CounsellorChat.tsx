import React,{useEffect,useRef,useState} from 'react';
import { ArrowUp, Check, ChevronDown, MessageCircle, RotateCcw, Sparkles } from 'lucide-react';
import { CounselAnswer, Progress } from '../shared/stream';
import { ChatContext, PriorMessage, StreamScenario, geminiChat, sampleChat } from './chat-client';
import { StreamingStatus } from './StreamingStatus';
type Turn={id:string;question:string;answer?:CounselAnswer;error?:string;stopped?:boolean;mode:'sample'|'gemini';topic:string};
function AnswerBubble({answer,fresh,onReply,disabled,mode}:{answer:CounselAnswer;fresh:boolean;onReply:(s:string)=>void;disabled:boolean;mode:Turn['mode']}) {
  const [visible,setVisible]=useState(fresh?1:4);
  useEffect(()=>{if(!fresh||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setVisible(4);return;}setVisible(1);const timer=setInterval(()=>setVisible(n=>{if(n>=3)clearInterval(timer);return Math.min(4,n+1);}),130);return()=>clearInterval(timer);},[fresh,answer]);
  return <div className="counsel-bubble"><span className="counsel-author"><Sparkles size={15}/>Yuzee<small>{mode==='gemini'?'Gemini response':'Sample response'}</small></span>
    {answer.acknowledgement&&<p className="counsel-ack">{answer.acknowledgement}</p>}
    {visible>=2&&<p className="counsel-answer">{answer.answer}</p>}
    {visible>=3&&answer.uncertainty&&<p className="counsel-uncertainty"><strong>Still to check</strong>{answer.uncertainty}</p>}
    {visible>=4&&answer.question&&<div className="counsel-question"><strong>{answer.question}</strong>{answer.options.length>0&&<div className="reply-chips">{answer.options.map(o=><button type="button" key={o} onClick={()=>onReply(o)} disabled={disabled}>{o}</button>)}</div>}<small>You can also answer in your own words.</small></div>}
  </div>;
}
export default function CounsellorChat({journeyId,contextId,card,disabled,scenario}:{journeyId:string;contextId:string;card:ChatContext;disabled:boolean;scenario:StreamScenario}) {
  const [sessions,setSessions]=useState<Record<string,Turn[]>>({});const turns=sessions[journeyId]??[];
  const [drafts,setDrafts]=useState<Record<string,string>>({});const draft=drafts[journeyId]??'';
  const [mode,setMode]=useState<'sample'|'gemini'>('sample');
  const [active,setActive]=useState<{id:string;startedAt:number;progress:Progress}|null>(null);
  const [expanded,setExpanded]=useState(false);
  const controller=useRef<AbortController|null>(null);const token=useRef(0);const currentScope=useRef(journeyId);const lastContext=useRef(contextId);
  const input=useRef<HTMLTextAreaElement>(null);const streamAnchor=useRef<HTMLDivElement>(null);
  const update=(scope:string,id:string,patch:Partial<Turn>)=>setSessions(s=>({...s,[scope]:(s[scope]??[]).map(t=>t.id===id?{...t,...patch}:t)}));
  function stop() {
    token.current++;controller.current?.abort();
    if(active){update(currentScope.current,active.id,{stopped:true});setActive(null);}
  }
  useEffect(()=>{
    if(currentScope.current!==journeyId||lastContext.current!==contextId){stop();currentScope.current=journeyId;lastContext.current=contextId;setExpanded(false);}
  },[journeyId,contextId]);
  useEffect(()=>()=>{controller.current?.abort();},[]);
  async function submit(text:string) {
    if(active||disabled||!text.trim())return;
    const requestId=crypto.randomUUID(),scope=journeyId,n=++token.current;
    const abort=new AbortController();controller.current=abort;
    const prior:PriorMessage[]=turns.filter(t=>t.answer).slice(-3).flatMap(t=>[{role:'user' as const,text:t.question},{role:'assistant' as const,text:[t.answer!.answer,t.answer!.question].filter(Boolean).join(' ').slice(0,1800)}]);
    setSessions(s=>({...s,[scope]:[...(s[scope]??[]),{id:requestId,question:text.trim(),mode,topic:card.title}]}));
    setDrafts(d=>({...d,[scope]:text.trim()}));
    setActive({id:requestId,startedAt:Date.now(),progress:{phase:'waiting',source:mode==='sample'?'fixture':'app'}});
    requestAnimationFrame(()=>streamAnchor.current?.scrollIntoView({behavior:'smooth',block:'nearest'}));
    const onProgress=(p:Progress)=>{if(n===token.current)setActive(a=>a?{...a,progress:p}:a);};
    const deadline=setTimeout(()=>abort.abort(),65000);
    try {
      const answer=mode==='sample'?await sampleChat(text,prior,scenario,abort.signal,onProgress):await geminiChat(requestId,text,card,prior,abort.signal,onProgress);
      if(abort.signal.aborted||n!==token.current)return;
      update(scope,requestId,{answer});setDrafts(d=>({...d,[scope]:''}));
    }catch(e){if(n!==token.current)return;update(scope,requestId,{error:abort.signal.aborted?'The response took too long. Your question is kept below; you can try again.':(e as Error).message});}
    finally {clearTimeout(deadline);if(n===token.current)setActive(null);}
  }
  const shown=expanded?turns:turns.slice(-2);
  const latest=turns.at(-1);
  return <section className="counsellor" aria-labelledby="counsellor-title"><div className="counsellor-header"><div><span className="eyebrow">LET’S TALK IT THROUGH</span><h3 id="counsellor-title">What matters to you?</h3></div><label className="chat-mode"><span className="sr-only">Conversation mode</span><select aria-label="Conversation mode" value={mode} disabled={!!active} onChange={e=>setMode(e.target.value as typeof mode)}><option value="sample">Sample conversation</option><option value="gemini">Gemini live</option></select></label></div>
    <p className="counsellor-intro">{mode==='sample'?'Try a conversation about your time, skills or next step. Sample responses demonstrate the flow.':'Gemini receives your message, this sample card and recent replies. No live provider research is connected.'}</p>
    {turns.length>2&&<button className="earlier-chat" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><MessageCircle size={14}/>{expanded?'Hide earlier messages':`View ${turns.length-2} earlier ${turns.length-2===1?'exchange':'exchanges'}`}<ChevronDown size={14}/></button>}
    <div className="chat-turns">{shown.map(t=><div className="chat-turn" key={t.id}><div className="user-bubble"><small>You · {t.topic}</small><p>{t.question}</p></div>{t.answer&&<AnswerBubble mode={t.mode} answer={t.answer} fresh={t.id===latest?.id} onReply={submit} disabled={!!active||disabled||t.id!==latest?.id}/>}<div className="chat-turn-status">{t.stopped&&<p><Check size={14}/>Stopped. Your question is kept below.</p>}{t.error&&<div role="alert"><p>{t.error}</p><button type="button" disabled={!!active||disabled} onClick={()=>submit(t.question)}><RotateCcw size={14}/>Try again</button></div>}</div></div>)}</div>
    <div ref={streamAnchor}>{active&&<StreamingStatus progress={active.progress} startedAt={active.startedAt} onStop={stop}/>}</div>
    <form className="conversation-composer" onSubmit={e=>{e.preventDefault();submit(draft);}}><label htmlFor="counsel-message" className="sr-only">Your message to Yuzee</label><textarea id="counsel-message" ref={input} rows={2} maxLength={1500} disabled={!!active||disabled} placeholder={latest?.answer?.question?'Write your reply, or ask another question…':'For example, I’m interested, but I need to fit study around work…'} value={draft} onChange={e=>setDrafts(d=>({...d,[journeyId]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit(draft);}}}/><button type="submit" aria-label="Send message" disabled={!!active||disabled||!draft.trim()}><ArrowUp size={19}/></button></form><div className="composer-caption"><span>{mode==='sample'?'Sample mode · no AI call':'Gemini · sample card, no web research'}</span><span>Enter to send · Shift+Enter for a new line</span></div>
  </section>;
}
