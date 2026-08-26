import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface ClarificationOption {
  value: string;
  label: string;
  description?: string;
}

export interface ClarificationQuestion {
  id: string;
  dimension: string;
  priority: number;
  ui_type: "single_select" | "multi_select" | "ranked_select" | "free_text" | "mixed";
  question: string;
  why_we_ask?: string;
  required?: boolean;
  min_select?: number;
  max_select?: number;
  options?: ClarificationOption[];
  allow_self_input?: boolean;
  self_input_label?: string;
}

export interface ClarificationAnswer {
  question_id: string;
  dimension: string;
  selected_values: string[];
  self_input: string;
}

interface Props {
  questions: ClarificationQuestion[];
  bridgeMessage?: string;
  onSubmit: (answers: ClarificationAnswer[]) => void;
  disabled?: boolean;
}

const UI_TYPE_BADGE: Record<string, string> = {
  single_select: "bg-blue-100 text-blue-700",
  multi_select: "bg-violet-100 text-violet-700",
  ranked_select: "bg-amber-100 text-amber-700",
  free_text: "bg-slate-100 text-slate-600",
  mixed: "bg-emerald-100 text-emerald-700",
};

export const ClarificationQuestionsCard: React.FC<Props> = ({ questions, bridgeMessage, onSubmit, disabled }) => {
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; selfInput: string }>>(() =>
    Object.fromEntries(questions.map(q => [q.id, { selected: [], selfInput: "" }]))
  );
  const [rankedOrders, setRankedOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(questions.filter(q => q.ui_type === "ranked_select").map(q => [q.id, (q.options || []).map(o => o.value)]))
  );

  const toggleSelect = (qId: string, value: string, multi: boolean) => {
    setAnswers(prev => {
      const cur = prev[qId].selected;
      const next = multi
        ? cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
        : [value];
      return { ...prev, [qId]: { ...prev[qId], selected: next } };
    });
  };

  const moveRanked = (qId: string, idx: number, dir: -1 | 1) => {
    setRankedOrders(prev => {
      const arr = [...prev[qId]];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return { ...prev, [qId]: arr };
    });
  };

  const handleSubmit = () => {
    const result: ClarificationAnswer[] = questions.map(q => {
      const a = answers[q.id];
      const selected = q.ui_type === "ranked_select" ? rankedOrders[q.id] || [] : a.selected;
      return { question_id: q.id, dimension: q.dimension, selected_values: selected, self_input: a.selfInput };
    });
    onSubmit(result);
  };

  const hasAnswer = (q: ClarificationQuestion): boolean => {
    const a = answers[q.id];
    if (q.ui_type === "free_text") return a.selfInput.trim().length > 0;
    if (q.ui_type === "ranked_select") return true;
    return a.selected.length > 0 || a.selfInput.trim().length > 0;
  };

  const allRequired = questions.filter(q => q.required !== false).every(hasAnswer);

  return (
    <div className="space-y-3">
      {bridgeMessage && (
        <p className="text-sm text-slate-700 leading-relaxed">{bridgeMessage}</p>
      )}
      {questions.map((q, qi) => (
        <div key={q.id} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-slate-400 mr-1.5">{qi + 1}.</span>
                <span className="text-sm font-bold text-slate-900">{q.question}</span>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${UI_TYPE_BADGE[q.ui_type] || "bg-slate-100 text-slate-600"}`}>
                {q.ui_type.replace(/_/g, " ")}
              </span>
            </div>
            {q.why_we_ask && (
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{q.why_we_ask}</p>
            )}
          </div>

          <div className="p-3 space-y-1.5">
            {q.ui_type === "free_text" ? (
              <textarea
                rows={3}
                value={answers[q.id].selfInput}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], selfInput: e.target.value } }))}
                placeholder={q.self_input_label || "Type your answer…"}
                disabled={disabled}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:border-sky-400 focus:ring-1 focus:ring-sky-200 resize-none outline-none text-slate-800 placeholder:text-slate-400"
              />
            ) : q.ui_type === "ranked_select" ? (
              <div className="space-y-1">
                {(rankedOrders[q.id] || []).map((val, idx) => {
                  const opt = (q.options || []).find(o => o.value === val);
                  if (!opt) return null;
                  return (
                    <div key={val} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-sky-600 text-white text-[10px] font-bold shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900">{opt.label}</p>
                        {opt.description && <p className="text-[11px] text-slate-500">{opt.description}</p>}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveRanked(q.id, idx, -1)} disabled={idx === 0 || disabled} className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => moveRanked(q.id, idx, 1)} disabled={idx === (rankedOrders[q.id]?.length ?? 0) - 1 || disabled} className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {(q.options || []).map(opt => {
                  const isMulti = q.ui_type === "multi_select";
                  const selected = answers[q.id].selected.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${selected ? "bg-sky-50 border-sky-300" : "bg-slate-50 border-slate-200 hover:border-slate-300"} ${disabled ? "opacity-60 cursor-default" : ""}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isMulti ? (
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected ? "bg-sky-600 border-sky-600" : "border-slate-400"}`}>
                            {selected && <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        ) : (
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? "border-sky-600" : "border-slate-400"}`}>
                            {selected && <div className="w-2 h-2 rounded-full bg-sky-600" />}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => !disabled && toggleSelect(q.id, opt.value, isMulti)}>
                        <p className="text-xs font-semibold text-slate-900">{opt.label}</p>
                        {opt.description && <p className="text-[11px] text-slate-500 mt-0.5">{opt.description}</p>}
                      </div>
                      <input type={isMulti ? "checkbox" : "radio"} className="sr-only" checked={selected} onChange={() => !disabled && toggleSelect(q.id, opt.value, isMulti)} />
                    </label>
                  );
                })}
                {q.allow_self_input !== false && (
                  <input
                    type="text"
                    value={answers[q.id].selfInput}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], selfInput: e.target.value, selected: e.target.value ? [] : prev[q.id].selected } }))}
                    placeholder={q.self_input_label || "Something else — type my answer"}
                    disabled={disabled}
                    className="w-full text-xs px-3 py-2 mt-1 rounded-lg border border-dashed border-slate-300 focus:border-sky-400 focus:ring-1 focus:ring-sky-200 outline-none text-slate-700 placeholder:text-slate-400 bg-white"
                  />
                )}
              </>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={handleSubmit}
          disabled={!allRequired || disabled}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-default cursor-pointer"
        >
          Submit answers
        </button>
      </div>
    </div>
  );
};
