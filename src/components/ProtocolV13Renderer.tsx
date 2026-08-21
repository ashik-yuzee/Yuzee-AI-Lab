import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileCheck,
  ShieldCheck,
  Check,
  ExternalLink,
  Layers,
  ArrowUpDown,
  Send,
  HelpCircle,
  Clock,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import {
  YuzeeResponseV13,
  YuzeeContentBlock,
  YuzeeItem,
  YuzeeInteraction,
  YuzeeOption,
  YuzeeField,
  UserEvent,
  ServiceAction,
} from "../types";
import { TRUSTED_SERVICE_ACTIONS } from "../protocol/validator";
import { AppleConfirmDialog } from "./ui/AppleConfirmDialog";
import { AppleSelect } from "./ui/AppleSelect";

interface ProtocolV13RendererProps {
  data: YuzeeResponseV13;
  rawJson?: string;
  schemaValid?: boolean;
  semanticValid?: boolean;
  validationErrors?: string[];
  onInteract?: (event: UserEvent) => void;
  readOnly?: boolean;
  conversationId?: string;
}

export const ProtocolV13Renderer: React.FC<ProtocolV13RendererProps> = ({
  data,
  schemaValid = true,
  semanticValid = true,
  validationErrors = [],
  onInteract,
  readOnly = false,
  conversationId,
}) => {
  // Interaction State
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [rankedItems, setRankedItems] = useState<YuzeeOption[]>(
    data?.interaction?.options || []
  );
  const [freeTextAnswer, setFreeTextAnswer] = useState("");
  const [otherText, setOtherText] = useState("");
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Service Action Confirmation
  const [pendingAction, setPendingAction] = useState<ServiceAction | null>(null);
  const [executedActions, setExecutedActions] = useState<Record<string, boolean>>({});

  if (!data) return null;

  const interaction = data.interaction;
  const blocks = data.content_blocks || (data as any).blocks || [];
  const service = data.service;
  const followups = data.followups;

  // Single Select
  const handleOptionSelect = (option: YuzeeOption) => {
    if (readOnly || submitted) return;
    setSelectedOption(option.id);
    setIsOtherSelected(false);
    if (onInteract) {
      onInteract({
        type: "option_selected",
        interaction_id: interaction?.question_id || "question",
        option_id: option.id,
        value: option.value || option.label,
        userEvent: {
          interaction: {
            question_id: interaction?.question_id || "question",
            selected_option_ids: [option.id],
          },
        },
        timestamp: Date.now(),
      });
      setSubmitted(true);
    }
  };

  // Multi Select Toggle
  const toggleMultiOption = (optionId: string) => {
    if (readOnly || submitted) return;
    setSelectedMultiOptions((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  };

  const handleMultiSubmit = () => {
    if (readOnly || submitted || !onInteract) return;
    if (selectedMultiOptions.length === 0 && !otherText.trim()) return;

    onInteract({
      type: "option_selected",
      interaction_id: interaction?.question_id || "question",
      value: selectedMultiOptions.join(", ") + (otherText ? ` (Other: ${otherText})` : ""),
      userEvent: {
        interaction: {
          question_id: interaction?.question_id || "question",
          selected_option_ids: selectedMultiOptions,
          self_input: otherText.trim() || undefined,
        },
      },
      timestamp: Date.now(),
    });
    setSubmitted(true);
  };

  // Ranking Move
  const handleRankMove = (index: number, direction: "up" | "down") => {
    if (readOnly || submitted) return;
    const newItems = [...rankedItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setRankedItems(newItems);
  };

  const handleRankSubmit = () => {
    if (readOnly || submitted || !onInteract) return;
    onInteract({
      type: "ranked_submission",
      interaction_id: interaction?.question_id || "question",
      ranked_ids: rankedItems.map((i) => i.id),
      value: rankedItems.map((i) => i.label).join(" > "),
      userEvent: {
        interaction: {
          question_id: interaction?.question_id || "question",
          ranked_option_ids: rankedItems.map((i) => i.id),
        },
      },
      timestamp: Date.now(),
    });
    setSubmitted(true);
  };

  // Free Text Submit
  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || submitted || !freeTextAnswer.trim() || !onInteract) return;
    onInteract({
      type: "text_answer",
      interaction_id: interaction?.question_id || "question",
      value: freeTextAnswer.trim(),
      userEvent: {
        interaction: {
          question_id: interaction?.question_id || "question",
          self_input: freeTextAnswer.trim(),
        },
      },
      timestamp: Date.now(),
    });
    setSubmitted(true);
  };

  // Form Fields Submit
  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || submitted || !onInteract) return;
    onInteract({
      type: "fields_submitted",
      interaction_id: interaction?.question_id || "handoff",
      fields: fieldValues,
      userEvent: {
        interaction: {
          question_id: interaction?.question_id || "handoff",
          fields: fieldValues,
        },
      },
      timestamp: Date.now(),
    });
    setSubmitted(true);
  };

  // Recommended Action Click
  const handleActionClick = (actionId: string, label: string) => {
    if (readOnly || submitted || !onInteract) return;
    onInteract({
      type: "action_clicked",
      action_id: actionId,
      value: label,
      userEvent: {
        interaction: {
          question_id: interaction?.question_id || "action",
          selected_option_ids: [actionId],
          self_input: label,
        },
      },
      timestamp: Date.now(),
    });
    setSubmitted(true);
  };

  // Service Action Execution
  const [actionStatus, setActionStatus] = useState<Record<string, { executed: boolean; message: string }>>({});

  const triggerServiceAction = (act: ServiceAction) => {
    if (act.requires_confirmation) {
      setPendingAction(act);
    } else {
      executeServiceAction(act);
    }
  };

  const executeServiceAction = async (act: ServiceAction) => {
    const actId = act.action_id || act.id || '';
    try {
      const convId = conversationId || 'default';
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}/actions/${encodeURIComponent(actId)}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(act),
      });
      const data = await res.json();
      setActionStatus((prev) => ({
        ...prev,
        [actId]: {
          executed: !!data.executed,
          message: data.message || (data.executed ? 'Action Initiated' : 'Not connected in Token Lab.'),
        },
      }));
    } catch {
      setActionStatus((prev) => ({
        ...prev,
        [actId]: {
          executed: false,
          message: 'Not connected in Token Lab.',
        },
      }));
    }

    setPendingAction(null);
  };

  // Render individual Content Block
  const renderBlock = (block: YuzeeContentBlock, index: number) => {
    switch (block.type) {
      case "heading": {
        const isH2 = block.level === "h2";
        return (
          <div key={block.id || index} className="pt-2 pb-1">
            {isH2 ? (
              <h2 className="text-base font-bold text-slate-900 tracking-tight">{block.title || block.text}</h2>
            ) : (
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{block.title || block.text}</h3>
            )}
            {block.text && block.title && (
              <p className="text-xs text-slate-600 mt-1">{block.text}</p>
            )}
          </div>
        );
      }

      case "text":
        return (
          <div key={block.id || index} className="text-sm leading-relaxed text-slate-800 space-y-1">
            {block.title && <h4 className="font-semibold text-slate-900 mb-1">{block.title}</h4>}
            <p className="whitespace-pre-wrap">{block.text || (block as any).body}</p>
          </div>
        );

      case "list":
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            <div className="space-y-1.5">
              {block.items?.map((item: YuzeeItem) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="mt-0.5 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    {(item.text || item.value) && (
                      <p className="text-slate-600 mt-0.5 leading-normal">{item.text || item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "steps":
        return (
          <div key={block.id || index} className="space-y-3">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            <div className="space-y-2">
              {block.items?.map((item: YuzeeItem, sIdx: number) => {
                const isComplete = item.status === "complete";
                const isCurrent = item.status === "current";
                return (
                  <div
                    key={item.id || sIdx}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs transition-colors ${
                      isCurrent
                        ? "bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs"
                        : isComplete
                        ? "bg-emerald-50/60 border-emerald-200 text-slate-900"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isComplete ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                          ✓
                        </div>
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px] animate-pulse">
                          {sIdx + 1}
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold text-[10px]">
                          {sIdx + 1}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{item.title}</span>
                        {item.status && (
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded tracking-wider ${
                              isComplete
                                ? "bg-emerald-100 text-emerald-800"
                                : isCurrent
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                      {(item.text || item.value) && (
                        <p className="text-slate-600 mt-1 leading-relaxed">{item.text || item.value}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "table": {
        const columns = block.columns || [];
        const rows = block.rows || [];

        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            
            {/* Desktop Table */}
            <div className="hidden sm:block rounded-xl border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2.5 font-semibold text-slate-700">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      {columns.map((col) => {
                        const cell = row.cells?.find((c) => c.key === col.key);
                        return (
                          <td key={col.key} className="px-3 py-2.5 text-slate-800">
                            {cell?.value || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (Prevents Horizontal Scroll) */}
            <div className="sm:hidden space-y-2">
              {rows.map((row, rIdx) => (
                <div key={row.id || rIdx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs shadow-2xs">
                  {columns.map((col) => {
                    const cell = row.cells?.find((c) => c.key === col.key);
                    return (
                      <div key={col.key} className="flex justify-between items-baseline gap-2">
                        <span className="text-slate-500 text-[11px] font-medium">{col.label}:</span>
                        <span className="font-semibold text-slate-900 text-right">{cell?.value || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "comparison":
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {block.items?.map((item: YuzeeItem, cIdx: number) => (
                <div key={item.id || cIdx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                  <div className="font-bold text-xs text-slate-900">{item.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.text || item.value}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "callout": {
        const variantStyles: Record<string, string> = {
          info: "bg-sky-50/80 border-sky-300 text-sky-950",
          success: "bg-emerald-50/80 border-emerald-300 text-emerald-950",
          warning: "bg-amber-50/80 border-amber-300 text-amber-950",
          danger: "bg-rose-50/80 border-rose-300 text-rose-950",
          muted: "bg-slate-100 border-slate-200 text-slate-800",
          default: "bg-slate-50 border-slate-200 text-slate-900",
        };

        const currentStyle = variantStyles[block.variant || "default"] || variantStyles.default;

        return (
          <div
            key={block.id || index}
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${currentStyle} shadow-2xs space-y-1`}
          >
            {block.title && <h4 className="font-semibold text-xs tracking-tight">{block.title}</h4>}
            <p className="whitespace-pre-wrap">{block.text}</p>
          </div>
        );
      }

      case "key_value":
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {block.items?.map((item: YuzeeItem) => (
                <div key={item.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                  <span className="text-slate-500 font-medium">{item.title}</span>
                  <span className="font-semibold text-slate-900">{item.value || item.text}</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div key={block.id || index} className="text-xs text-slate-700">
            {block.title && <div className="font-semibold text-slate-900 mb-1">{block.title}</div>}
            <p>{block.text}</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Schema / Semantic Validation Warning if any */}
      {!schemaValid && (
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Schema validation notice:</span>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px]">
              {validationErrors.map((err, eIdx) => (
                <li key={eIdx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Content Blocks */}
      <div className="space-y-3">
        {blocks.map((block, idx) => renderBlock(block, idx))}
      </div>

      {/* Structured Interaction Section */}
      {interaction && interaction.kind !== "none" && interaction.input_type !== "none" && (
        <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3">
          {/* Interaction Header */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next Step</span>
            </span>
            <p className="text-sm font-semibold text-slate-900">
              {interaction.question || (interaction as any).prompt || "Select an option to proceed:"}
            </p>
          </div>

          {/* 1. SINGLE SELECT */}
          {interaction.input_type === "single_select" && interaction.options && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {interaction.options.map((opt) => {
                  const isSelected = selectedOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      disabled={submitted || readOnly}
                      onClick={() => handleOptionSelect(opt)}
                      className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        isSelected
                          ? "bg-sky-50 border-sky-500 text-sky-950 font-medium shadow-xs"
                          : "bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 text-slate-800"
                      } ${submitted && !isSelected ? "opacity-50" : ""}`}
                    >
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-600" />}
                      </div>
                      {opt.description && (
                        <p className="text-slate-500 text-[11px] mt-0.5 leading-normal">{opt.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Allow Other Input */}
              {interaction.allow_other_input && !submitted && (
                <div className="pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={interaction.other_input_label || "Other custom response..."}
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-sky-500"
                    />
                    <button
                      type="button"
                      disabled={!otherText.trim()}
                      onClick={() => {
                        if (!otherText.trim() || !onInteract) return;
                        onInteract({
                          type: "option_selected",
                          interaction_id: interaction.question_id || "question",
                          value: otherText.trim(),
                          userEvent: {
                            interaction: {
                              question_id: interaction.question_id || "question",
                              self_input: otherText.trim(),
                            },
                          },
                          timestamp: Date.now(),
                        });
                        setSubmitted(true);
                      }}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. MULTI SELECT */}
          {interaction.input_type === "multi_select" && interaction.options && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {interaction.options.map((opt) => {
                  const isChecked = selectedMultiOptions.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => toggleMultiOption(opt.id)}
                      className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        isChecked
                          ? "bg-sky-50 border-sky-500 text-sky-950 font-medium shadow-xs"
                          : "bg-white border-slate-200 hover:border-sky-300 text-slate-800"
                      } ${submitted ? "pointer-events-none opacity-80" : ""}`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            isChecked ? "bg-sky-600 border-sky-600 text-white" : "border-slate-300 bg-white"
                          }`}
                        >
                          {isChecked && "✓"}
                        </div>
                        <span>{opt.label}</span>
                      </div>
                      {opt.description && (
                        <p className="text-slate-500 text-[11px] mt-1 pl-6 leading-normal">{opt.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {!submitted && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleMultiSubmit}
                    disabled={selectedMultiOptions.length === 0}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Confirm Selection ({selectedMultiOptions.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. RANKED SELECT */}
          {interaction.input_type === "ranked_select" && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">Arrange options in priority order from highest to lowest:</p>
              <div className="space-y-1.5">
                {rankedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-slate-900">{item.label}</span>
                    </div>

                    {!submitted && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleRankMove(idx, "up")}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === rankedItems.length - 1}
                          onClick={() => handleRankMove(idx, "down")}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!submitted && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRankSubmit}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Confirm Priority Ranking
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. FREE TEXT QUESTION */}
          {interaction.input_type === "text" && (
            <form onSubmit={handleFreeTextSubmit} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your response..."
                  value={freeTextAnswer}
                  disabled={submitted}
                  onChange={(e) => setFreeTextAnswer(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-sky-500 shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!freeTextAnswer.trim() || submitted}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          )}

          {/* 5. HANDOFF FIELDS */}
          {interaction.input_type === "fields" && interaction.fields && (
            <form onSubmit={handleFieldSubmit} className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {interaction.fields.map((fld: YuzeeField) => (
                  <div key={fld.id} className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      {fld.label} {fld.required && <span className="text-rose-500">*</span>}
                    </label>

                    {fld.input_type === "australian_location" || fld.input_type === "single_select" ? (
                      <AppleSelect
                        id={`select-field-${fld.id}`}
                        value={fieldValues[fld.id] || ""}
                        options={(fld.options || []).map((opt) => ({
                          value: opt.value || opt.label,
                          label: opt.label,
                          description: opt.description || "",
                        }))}
                        placeholder="Select an option..."
                        onChange={(val) => setFieldValues({ ...fieldValues, [fld.id]: val })}
                        compact
                        disabled={submitted}
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder={`Enter ${fld.label.toLowerCase()}...`}
                        value={fieldValues[fld.id] || ""}
                        disabled={submitted}
                        required={fld.required}
                        onChange={(e) => setFieldValues({ ...fieldValues, [fld.id]: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-sky-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              {!submitted && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Submit Intake Details
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Recommended Actions */}
          {interaction.recommended_actions && interaction.recommended_actions.length > 0 && !submitted && (
            <div className="pt-1 flex flex-wrap gap-1.5">
              {interaction.recommended_actions.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => handleActionClick(act.id, act.label)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-800 border border-slate-200 hover:border-sky-300 text-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service Handoff Block */}
      {service && service.flow && service.flow !== "NONE" && service.actions && service.actions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Verified Service Actions</span>
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-mono">
              {service.flow}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {service.actions.map((act: ServiceAction) => {
              const actId = act.id || act.action_id || "";
              const currentStatus = actionStatus[actId];
              const isExecuted = currentStatus?.executed;
              const hasAttempted = !!currentStatus;
              const trusted = TRUSTED_SERVICE_ACTIONS[act.action_id || act.id];

              return (
                <div
                  key={actId}
                  className="p-3 bg-white border border-indigo-200 rounded-xl space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between font-semibold text-xs text-slate-900">
                    <span>{act.title || trusted?.title || "Service Action"}</span>
                    {act.requires_confirmation && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Confirm
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    {act.description || trusted?.description || "Connect with authorized pathway providers."}
                  </p>

                  <button
                    type="button"
                    disabled={hasAttempted || readOnly}
                    onClick={() => triggerServiceAction(act)}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      isExecuted
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : hasAttempted
                        ? "bg-slate-100 text-slate-700 border border-slate-300"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                    }`}
                  >
                    {isExecuted ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Action Initiated</span>
                      </>
                    ) : hasAttempted ? (
                      <span>{currentStatus?.message || "Not connected in Token Lab."}</span>
                    ) : (
                      <>
                        <span>Connect Service</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Service Action */}
      <AppleConfirmDialog
        isOpen={!!pendingAction}
        title="Confirm Service Connection"
        message={`Are you sure you want to initiate "${pendingAction?.title || "Service Action"}"? This will securely connect your verified pathway profile to the provider.`}
        confirmLabel="Confirm & Connect"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingAction) {
            executeServiceAction(pendingAction);
          }
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
