import React, { useId, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, MessageCircle, Sparkles } from 'lucide-react';
import type { DetailResult } from '../research/types';

export function ResearchAnswerCard({ result, disabled, onQuestion, onUse }: {
  result: DetailResult;
  disabled: boolean;
  onQuestion: (text: string, kind: 'ask_user' | 'suggested_question') => void;
  onUse: () => Promise<void>;
}) {
  const id = useId();
  const [using, setUsing] = useState(false);
  const suggested = result.nextQuestions.filter(q => q.kind === 'suggested_question');
  const clarifications = result.nextQuestions.filter(q => q.kind === 'ask_user');
  const status = { answered: 'Sources found', partial: 'Some details to confirm', needs_clarification: 'More context needed', no_evidence: 'Not confirmed yet' }[result.status];
  const sourceNumber = (sourceId: string) => result.sources.findIndex(s => s.id === sourceId) + 1;
  return <article className="research-answer" aria-labelledby={`${id}-title`}>
    <header className="research-answer-header">
      <span className={`research-status ${result.status === 'answered' ? 'is-supported' : 'is-pending'}`}>
        {result.status === 'answered' ? <Check size={14} aria-hidden="true" /> : <CircleHelp size={14} aria-hidden="true" />}{status}
      </span>
      <span className="research-date">Checked {new Date(result.retrievedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
    </header>
    <div className="research-answer-main">
      <p className="research-course">{result.request.target}</p>
      {(result.request.studyYear || result.request.location) && <p className="research-scope-note">{[result.request.studyYear && `Study year ${result.request.studyYear}`, result.request.location].filter(Boolean).join(' · ')}</p>}
      <h3 id={`${id}-title`}>{result.status === 'no_evidence' ? 'Let’s narrow this down' : result.status === 'needs_clarification' ? 'A little more context will help' : 'Your answer'}</h3>
      <p className="research-answer-summary">{result.summary}</p>
      <details className="research-original-question">
        <summary>View your question <ChevronDown size={14} aria-hidden="true" /></summary>
        <p>{result.request.question}</p>
      </details>
      {result.gaps.length > 0 && <section className="research-gaps" aria-labelledby={`${id}-gaps`}>
        <div className="research-section-heading"><h4 id={`${id}-gaps`}>Still to confirm</h4><span>{result.gaps.length} {result.gaps.length === 1 ? 'item' : 'items'}</span></div>
        <ul>{result.gaps.map((gap, i) => <li key={i}><CircleHelp size={18} aria-hidden="true" /><span>{gap}</span></li>)}</ul>
      </section>}
      {result.facts.length > 0 && <details className="research-evidence">
        <summary><span className="research-disclosure-label"><BookOpen size={18} aria-hidden="true" />Details & sources <span className="research-count">{result.facts.length} findings</span></span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="research-evidence-content">
          <p className="research-help">Source-based findings are AI summaries. Interpretations and general career expectations are labelled separately.</p>
          <ol className="research-findings">{result.facts.map((fact, i) => {
            const evidence = result.evidence.filter(e => fact.evidenceIds.includes(e.id));
            const sourceIds = new Set(evidence.flatMap(e => e.sourceIds));
            return <li key={i}>
              <span className="research-finding-kind">{{ source_backed: 'From a source', inference: 'Our interpretation', benchmark: 'General career expectation' }[fact.kind]}</span>
              <p>{fact.text}</p>
              <div className="research-citations">{result.sources.filter(s => sourceIds.has(s.id)).map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><span>{sourceNumber(source.id)}</span>{source.title}<ArrowUpRight size={13} aria-hidden="true" /></a>)}</div>
              <details className="research-passages"><summary>Read supporting passages</summary>{evidence.map(e => <blockquote key={e.id}>{e.text}</blockquote>)}</details>
            </li>;
          })}</ol>
        </div>
      </details>}
      {clarifications.length > 0 && <section className="research-clarifications" aria-labelledby={`${id}-clarify`}>
        <h4 id={`${id}-clarify`}><MessageCircle size={18} aria-hidden="true" />Help us make this more useful</h4>
        {clarifications.map((q, i) => <div className="research-clarification-row" key={i}><p>{q.text}</p><button type="button" className="research-text-button" disabled={disabled || using} onClick={() => onQuestion(q.text, 'ask_user')}>Answer <ArrowRight size={16} aria-hidden="true" /></button></div>)}
      </section>}
      {result.facts.length > 0 && <div className="research-plan-action"><button type="button" className="research-primary" disabled={disabled || using} onClick={async () => { setUsing(true); try { await onUse(); } finally { setUsing(false); } }}><Sparkles size={16} aria-hidden="true" />{using ? 'Adding to your conversation…' : 'Use this in my plan'}<ArrowRight size={16} aria-hidden="true" /></button><p>Continue in your conversation with these findings.</p></div>}
      {suggested.length > 0 && <section className="research-next" aria-label="Suggested follow-up questions"><h4>Explore next</h4>{suggested.map((q, i) => <button type="button" disabled={disabled || using} key={i} onClick={() => onQuestion(q.text, 'suggested_question')}><span>{q.text}</span><ArrowUpRight size={18} aria-hidden="true" /></button>)}</section>}
    </div>
    <footer className="research-answer-footer">
      <p>AI summary · Details can change. Check the sources before deciding.</p>
      {result.searchSuggestionsHtml && <iframe title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className="research-search-attribution" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:">${result.searchSuggestionsHtml}`} />}
    </footer>
  </article>;
}
