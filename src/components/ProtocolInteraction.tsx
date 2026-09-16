import React, { useId, useState, useRef, useEffect } from 'react';
import {ArrowRight,MessageCircle,Pencil,ChevronUp} from 'lucide-react';
import type { YuzeeInteraction, UserEvent } from '../types';
import { validateInteractionFields } from '../protocol/validator';

type Props = { initialFields?: Record<string,string>; interaction: YuzeeInteraction; readOnly?: boolean; onInteract?: (event: UserEvent) => Promise<boolean | void> | void };

/** One explicit submission, with drafts preserved until the server accepts the reply. */
export function ProtocolInteraction({ interaction: q, readOnly, onInteract, initialFields = {} }: Props) {
  const scope = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [ranked, setRanked] = useState(q.options.map(o => o.id));
  const [answer, setAnswer] = useState('');
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(q.fields.filter(f => initialFields[f.id] !== undefined).map(f => [f.id,initialFields[f.id]])));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ownOpen,setOwnOpen] = useState(false);
  const answerRef=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{if(ownOpen)answerRef.current?.focus();},[ownOpen]);
  if (q.kind === 'none' || q.input_type === 'none') return null;
  const disabled = !!readOnly || pending || submitted || !onInteract;
  const hasAnswer = q.input_type === 'ranked_select' ? ranked.length > 0 : q.input_type === 'fields' ? true : q.input_type === 'text' ? !!answer.trim() : selected.length > 0 || (q.allow_other_input && !!answer.trim());
  const label = (id: string) => q.options.find(o => o.id === id)?.label || id;
  const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:bg-slate-50';
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError('');
    const inter: any = { question_id: q.question_id };
    let value = '';
    if (q.input_type === 'fields') {
      const check = validateInteractionFields(q, fields);
      setFieldErrors(check.fieldErrors);
      if (!check.valid) { setError('Please check the highlighted fields.'); return; }
      inter.fields = Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,v.trim()]));
      value = q.fields.map(f => `${f.label}: ${f.options.find(o => o.value === fields[f.id])?.label || fields[f.id]?.trim() || 'Not provided'}`).join('\n');
    } else if (q.input_type === 'text') {
      if (!answer.trim()) { setError('Please type your answer.'); return; }
      inter.self_input = answer.trim(); value = answer.trim();
    } else if (q.input_type === 'ranked_select') {
      inter.ranked_option_ids = ranked; value = ranked.map(label).join(' → ');
    } else {
      if (!selected.length && !answer.trim()) { setError('Choose an option or write your own answer.'); return; }
      inter.selected_option_ids = selected;
      if (q.allow_other_input && answer.trim()) inter.self_input = answer.trim();
      value = [...selected.map(label), answer.trim()].filter(Boolean).join(', ');
    }
    setPending(true);
    try {
      const accepted = await onInteract?.({type: q.input_type === 'ranked_select' ? 'ranked_submission' : q.input_type === 'fields' ? 'fields_submission' : 'text_answer', interaction_id: q.question_id, value, userEvent: {interaction: inter}, timestamp: Date.now()} as UserEvent);
      if (accepted === false) setError('Your reply could not be completed. Your answer is still here. Please try again.');
      else setSubmitted(true);
    } catch { setError('Your reply could not be sent. Your answer is still here. Please try again.'); }
    finally { setPending(false); }
  }
  function move(index: number, delta: number) {
    const next = [...ranked]; const target = index + delta;
    [next[index], next[target]] = [next[target], next[index]]; setRanked(next);
  }
  return <form onSubmit={submit} noValidate className="main-chat-question" aria-labelledby={`${scope}-question`}>
    <div className="main-chat-question-kicker"><MessageCircle size={15}/>Your next step</div>
    <p id={`${scope}-question`} className="main-chat-question-title">{q.question}</p>
    {readOnly || submitted ? <p className="text-sm text-slate-600">{submitted ? 'Answer sent.' : pending ? 'Sending your answer…' : 'Earlier question · You can add or change details in your message below.'}</p> : <>
      <p className="main-chat-question-hint">{q.input_type === 'multi_select' ? 'Choose all that fit.' : q.input_type === 'single_select' ? 'Choose the next step that suits you.' : q.input_type === 'ranked_select' ? 'Move what matters most to the top.' : q.input_type === 'fields' ? 'Enter your details. Required fields are marked.' : 'A short answer is fine. You can also say “I’m not sure”.'}</p>
      <fieldset disabled={disabled} className="main-chat-choices">
        <legend className="sr-only">{q.question}</legend>
        {['single_select','multi_select'].includes(q.input_type) && q.options.map(o => <label key={o.id} className={`main-chat-choice ${selected.includes(o.id) ? 'is-selected' : ''}`}>
          <input className="mt-1 h-4 w-4" type={q.input_type === 'single_select' ? 'radio' : 'checkbox'} name={`${scope}-choice`} checked={selected.includes(o.id)} onChange={() => {setSelected(q.input_type === 'single_select' ? [o.id] : selected.includes(o.id) ? selected.filter(id => id !== o.id) : [...selected,o.id]); if (q.input_type === 'single_select') {setAnswer('');setOwnOpen(false);}}} />
          <span className="main-chat-choice-copy"><strong>{o.label}</strong>{o.description && <span>{o.description}</span>}</span>
        </label>)}
        {q.input_type === 'ranked_select' && <ol className="space-y-2">{ranked.map((id,i) => <li key={id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 bg-white"><span className="px-2 text-slate-500">{i+1}</span><span className="flex-1">{label(id)}</span><button type="button" aria-label={`Move ${label(id)} up`} disabled={i===0} onClick={() => move(i,-1)} className="p-3 disabled:opacity-30">↑</button><button type="button" aria-label={`Move ${label(id)} down`} disabled={i===ranked.length-1} onClick={() => move(i,1)} className="p-3 disabled:opacity-30">↓</button></li>)}</ol>}
        {q.input_type === 'fields' && q.fields.map(f => <div key={f.id} className="space-y-2"><label htmlFor={`${scope}-${f.id}`} className="block font-medium">{f.label}{f.required ? ' (required)' : ' (optional)'}</label>
          {f.input_type === 'single_select' && f.id !== 'location' ? <select id={`${scope}-${f.id}`} value={fields[f.id] || ''} onChange={e => setFields({...fields,[f.id]:e.target.value})} className={inputClass} aria-invalid={!!fieldErrors[f.id]} aria-describedby={fieldErrors[f.id] ? `${scope}-${f.id}-error` : undefined}><option value="">Choose an option</option>{f.options.map((o:any) => <option key={o.value || o.label} value={o.value || o.label}>{o.label}</option>)}</select> : <input id={`${scope}-${f.id}`} type="text" value={fields[f.id] || ''} maxLength={500} placeholder={f.id === 'location' ? 'Type your suburb, town or postcode' : ''} autoComplete={f.id === 'location' ? 'address-level2' : 'off'} onChange={e => setFields({...fields,[f.id]:e.target.value})} className={inputClass} aria-invalid={!!fieldErrors[f.id]} aria-describedby={`${scope}-${f.id}-hint ${scope}-${f.id}-error`} />}
          {f.id === 'location' && <p id={`${scope}-${f.id}-hint`} className="text-sm text-slate-600">Include your state or country if needed. No street address needed.</p>}
          {fieldErrors[f.id] && <p id={`${scope}-${f.id}-error`} className="text-sm text-red-700">{fieldErrors[f.id]}</p>}
        </div>)}
        {q.allow_other_input && ['single_select','multi_select'].includes(q.input_type) && <button type="button" className="main-chat-own-toggle" aria-expanded={ownOpen} aria-controls={`${scope}-own`} onClick={()=>setOwnOpen(!ownOpen)}><Pencil size={14}/>{ownOpen?'Hide my own answer':'Write my own answer'}{ownOpen&&<ChevronUp size={14}/>}</button>}
        {(q.input_type === 'text' || ownOpen && q.allow_other_input && ['single_select','multi_select'].includes(q.input_type)) && <div id={`${scope}-own`} className="main-chat-own-field"><label htmlFor={`${scope}-answer`}>{q.input_type === 'text' ? 'Your answer' : q.other_input_label || 'Your own answer'}</label><textarea ref={answerRef} id={`${scope}-answer`} className={inputClass} value={answer} placeholder="A short answer is fine. You can also say you’re not sure." onChange={e => {setAnswer(e.target.value); if (q.input_type === 'single_select') setSelected([]);}} rows={2} maxLength={4000}/></div>}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="main-chat-question-footer"><span>{selected.length? (q.input_type === 'multi_select' ? `${selected.length} selected` : 'One option selected') : answer.trim()?'Your own answer':'You can change direction at any time.'}</span><button type="submit" disabled={disabled || !hasAnswer}>{pending ? 'Sending…' : 'Continue'}<ArrowRight size={15}/></button></div>
    </>}
  </form>;
}
