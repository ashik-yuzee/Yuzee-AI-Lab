import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, History, MapPin, MessageCircle, Pencil, Search, X } from 'lucide-react';
import { researchDetails } from '../research/client';
import type { DetailResult } from '../research/types';
import './research.css';
import { ResearchAnswerCard } from './ResearchAnswerCard';

export function MoreDetails({ conversationId, parentMessageId, disabled, onUse }:
  { conversationId: string; parentMessageId: string; disabled: boolean; onUse: (message: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [question, setQuestion] = useState('');
  const [studyYear, setStudyYear] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<DetailResult[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [editingScope, setEditingScope] = useState(true);
  const [replyTo, setReplyTo] = useState('');
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const id = useId();
  const active = Boolean(stage);
  const selected = results.find(r => r.id === selectedId) || results.at(-1);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open || loaded.current) return;
    const abort = new AbortController();
    setLoadingSaved(true);
    fetch(`/api/conversations/${encodeURIComponent(conversationId)}/details`, { signal: abort.signal })
      .then(async r => { if (!r.ok) throw new Error('Saved answers could not be loaded. Close and reopen this section to retry.'); return r.json(); })
      .then((saved: DetailResult[]) => {
        const own = saved.filter(r => r.request.parentMessageId === parentMessageId);
        setResults(own); loaded.current = true;
        const last = own.at(-1);
        if (last) { setSelectedId(last.id); setTarget(last.request.target); setStudyYear(last.request.studyYear); setLocation(last.request.location); setEditingScope(false); }
      }).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoadingSaved(false); });
    return () => abort.abort();
  }, [open, conversationId, parentMessageId]);
  function useScope(result: DetailResult) {
    setTarget(result.request.target); setStudyYear(result.request.studyYear); setLocation(result.request.location); setEditingScope(false);
  }
  function prepareQuestion(text: string, kind: 'ask_user' | 'suggested_question') {
    if (selected) useScope(selected);
    setReplyTo(kind === 'ask_user' ? text : '');
    setQuestion(kind === 'ask_user' ? '' : text);
    setError('');
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); questionRef.current?.focus({ preventScroll: true }); });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current || disabled || loadingSaved) return;
    const abort = new AbortController(); controller.current = abort;
    setStage('searching'); setError('');
    try {
      const submittedQuestion = replyTo ? `Replying to: ${replyTo}\nMy answer: ${question}` : question;
      const result = await researchDetails(conversationId, { parentMessageId, target, question: submittedQuestion, studyYear, location, refresh }, abort.signal, setStage);
      if (!abort.signal.aborted) {
        setResults(previous => [...previous.filter(r => r.id !== result.id), result]); setSelectedId(result.id);
        setQuestion(''); setReplyTo(''); setEditingScope(false);
        requestAnimationFrame(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (e: any) { if (!abort.signal.aborted) setError(e.message); }
    finally { if (controller.current === abort) { controller.current = null; setStage(''); } }
  }
  const questionLimit = replyTo ? Math.max(1, 1500 - replyTo.length - 25) : 1500;
  return <section className={`research-panel ${open ? 'is-open' : ''}`}>
    <button type="button" className="research-panel-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>
      <span className="research-toggle-icon"><Search size={18} aria-hidden="true" /></span><span><strong>Explore more</strong><span>Ask a question. Get the details that matter to you.</span></span><ChevronDown className="research-toggle-chevron" size={20} aria-hidden="true" />
    </button>
    {open && <div id={`${id}-body`} className="research-panel-body">
      {results.length > 1 && <details className="research-history"><summary><History size={16} aria-hidden="true" /><span>Saved answers</span><span className="research-count">{results.length}</span><ChevronDown size={16} aria-hidden="true" /></summary><div className="research-history-list">{[...results].reverse().map((result, index) => <button key={result.id} type="button" aria-pressed={selected?.id === result.id} disabled={active || disabled} onClick={() => { setSelectedId(result.id); if (!question.trim()) { useScope(result); setReplyTo(''); } setError(''); }}><span>{index === 0 ? 'Latest' : new Date(result.retrievedAt).toLocaleDateString()}</span><strong>{result.request.question}</strong>{selected?.id === result.id && <span className="research-history-current">Viewing</span>}</button>)}</div></details>}
      {selected && <div ref={answerRef} className="research-answer-anchor"><ResearchAnswerCard key={selected.id} result={selected} disabled={active || disabled} onQuestion={prepareQuestion} onUse={async () => {
        setError('');
        try {
          const ok = await onUse(`Use the research about ${selected.request.target} to help me decide what to check next. Treat study hours as estimates, keep unresolved points clear, and do not assume the course fits my schedule or that I qualify for payments. Research reference: ${selected.id}`);
          if (!ok) setError('Your research is saved. Please try adding it to your plan again.');
        } catch { setError('Your research is saved. Please try adding it to your plan again.'); }
      }} /></div>}
      <form ref={formRef} onSubmit={submit} className="research-question-form" aria-labelledby={`${id}-form-title`}>
        <div className="research-form-heading"><MessageCircle size={20} aria-hidden="true" /><h3 id={`${id}-form-title`}>{replyTo ? 'Your answer' : results.length ? 'Ask another question' : 'What would you like to know?'}</h3></div>
        {!results.length && <p className="research-help">Explore costs, entry requirements, skills or fitting study around your life.</p>}
        {!editingScope && target && <div className="research-context"><div><strong>{target}</strong><span><MapPin size={13} aria-hidden="true" />{[studyYear, location].filter(Boolean).join(' · ') || 'Year and location not added'}</span></div><button className="research-text-button" type="button" disabled={active || disabled} onClick={() => setEditingScope(true)}><Pencil size={14} aria-hidden="true" />Edit details</button></div>}
        {editingScope && <fieldset className="research-scope-fields" disabled={active || disabled || loadingSaved}><legend className="sr-only">Course and location details</legend>
          <label htmlFor={`${id}-target`}>Course or option<input id={`${id}-target`} value={target} onChange={e => setTarget(e.target.value)} required maxLength={350} placeholder="Course name and provider" /></label>
          <div className="research-field-pair"><label htmlFor={`${id}-year`}>Study year <span>Optional</span><input id={`${id}-year`} value={studyYear} onChange={e => setStudyYear(e.target.value)} maxLength={20} placeholder="For example, 2027" /></label><label htmlFor={`${id}-location`}>Location <span>Optional</span><input id={`${id}-location`} value={location} onChange={e => setLocation(e.target.value)} maxLength={150} placeholder="Enter a city or country" /></label></div>
          {results.length > 0 && <button type="button" className="research-text-button" disabled={!target.trim()} onClick={() => setEditingScope(false)}>Done editing</button>}
        </fieldset>}
        {replyTo && <div className="research-reply-context"><p>{replyTo}</p><button type="button" aria-label="Cancel clarification reply" disabled={active} onClick={() => { setReplyTo(''); setQuestion(''); }}> <X size={16} aria-hidden="true" /></button></div>}
        <label htmlFor={`${id}-question`} className="sr-only">{replyTo ? 'Your answer to the clarification' : 'Your follow-up question'}</label>
        <textarea ref={questionRef} id={`${id}-question`} rows={3} required maxLength={questionLimit} value={question} onChange={e => setQuestion(e.target.value)} disabled={active || disabled || loadingSaved} placeholder={replyTo ? 'Type your answer. “I’m not sure” is fine too.' : 'For example, can I study part-time while working?'} />
        {error && <p role="alert" className="research-error">{error}</p>}
        <div className="research-progress" role="status" aria-live="polite">{loadingSaved && <span>Loading your saved answers…</span>}{active && <span><span className="research-progress-dot" />{{ searching: 'Looking for relevant sources…', analysing: 'Preparing your answer…', reviewing: 'Checking the answer…', saving: 'Saving your answer…', cached: 'Opening your saved answer…' }[stage]}</span>}</div>
        <div className="research-form-actions"><button className="research-primary" disabled={active || disabled || loadingSaved || !question.trim() || !target.trim()}>{replyTo ? 'Continue with my answer' : 'Find my answer'}<ArrowRight size={17} aria-hidden="true" /></button>{active && <button type="button" className="research-text-button" onClick={() => { controller.current?.abort(); setError('Search stopped. Your question has been kept.'); }}>Stop search</button>}<details className="research-options"><summary>Search options<ChevronDown size={14} aria-hidden="true" /></summary><label><input type="checkbox" checked={refresh} onChange={e => setRefresh(e.target.checked)} disabled={active || disabled} />Check for updates instead of reusing a recent answer</label></details></div>
      </form>
    </div>}
  </section>;
}
