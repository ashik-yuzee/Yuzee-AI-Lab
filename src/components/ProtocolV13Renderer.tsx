import React, { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

  // Must be declared before any early return to satisfy Rules of Hooks
  const [actionStatus, setActionStatus] = useState<Record<string, { executed: boolean; message: string }>>({});

  // Reset ranked items when the response data changes (new message from AI)
  useEffect(() => {
    setRankedItems(data?.interaction?.options || []);
  }, [data?.interaction?.options]);

  if (!data) return null;

  // Model may omit id or leave it empty — fall back to value so it matches the server's trusted list
  const optId = (opt: YuzeeOption): string => opt.id || opt.value;

  const interaction = data.interaction;
  const blocks = data.content_blocks || (data as any).blocks || [];
  // Support both v1.3 (data.service) and v1.4 (data.service_trigger)
  const service = data.service || (data as any).service_trigger;
  const serviceFlow: string = service?.flow || service?.primary_requested_service || 'NONE';
  const followups = data.followups;

  // Single Select
  const handleOptionSelect = (option: YuzeeOption) => {
    if (readOnly || submitted) return;
    setSelectedOption(optId(option));
    setIsOtherSelected(false);
    if (onInteract) {
      onInteract({
        type: "option_selected",
        interaction_id: interaction?.question_id || "question",
        option_id: optId(option),
        value: option.value || option.label,
        userEvent: {
          interaction: {
            question_id: interaction?.question_id || "question",
            selected_option_ids: [optId(option)],
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
      ranked_ids: rankedItems.map((i) => optId(i)),
      value: rankedItems.map((i) => i.label).join(" > "),
      userEvent: {
        interaction: {
          question_id: interaction?.question_id || "question",
          ranked_option_ids: rankedItems.map((i) => optId(i)),
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
            <div className="prose prose-slate prose-sm max-w-none prose-p:my-0.5 prose-li:my-0 prose-headings:text-slate-900">
              <Markdown remarkPlugins={[remarkGfm]}>{block.text || (block as any).body || ""}</Markdown>
            </div>
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

      case "cards": {
        const d = (block as any).data || {};
        const cards: any[] = d.cards || [];
        const statusColors: Record<string, string> = {
          recommended: "border-sky-400 bg-sky-50/60",
          alternative: "border-violet-300 bg-violet-50/50",
          completed: "border-emerald-300 bg-emerald-50/50",
          current: "border-amber-400 bg-amber-50/50",
          blocked: "border-rose-300 bg-rose-50/40",
          warning: "border-amber-300 bg-amber-50/40",
          neutral: "border-slate-200 bg-white",
          upcoming: "border-slate-200 bg-white",
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            {block.text && <p className="text-xs text-slate-600">{block.text}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {cards.map((card: any, cIdx: number) => (
                <div key={card.id || cIdx} className={`p-3.5 rounded-xl border shadow-2xs space-y-1.5 ${statusColors[card.status] || statusColors.neutral}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{card.title}</div>
                      {card.subtitle && <div className="text-[11px] text-slate-500">{card.subtitle}</div>}
                    </div>
                    {card.badge && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">{card.badge}</span>
                    )}
                  </div>
                  {card.description && <p className="text-xs text-slate-600 leading-relaxed">{card.description}</p>}
                  {card.facts?.length > 0 && (
                    <div className="pt-1 border-t border-slate-200/80 grid grid-cols-2 gap-x-3 gap-y-1">
                      {card.facts.map((f: any, fIdx: number) => (
                        <div key={fIdx} className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{f.label}</span>
                          <span className="text-[11px] font-semibold text-slate-800">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "timeline": {
        const d = (block as any).data || {};
        const milestones: any[] = d.milestones || [];
        const msStatus: Record<string, { dot: string; label: string }> = {
          completed: { dot: "bg-emerald-500", label: "bg-emerald-100 text-emerald-800" },
          current:   { dot: "bg-amber-500 animate-pulse", label: "bg-amber-100 text-amber-900" },
          upcoming:  { dot: "bg-slate-300", label: "bg-slate-100 text-slate-600" },
          blocked:   { dot: "bg-rose-400", label: "bg-rose-100 text-rose-800" },
          paused:    { dot: "bg-violet-400", label: "bg-violet-100 text-violet-800" },
          unknown:   { dot: "bg-slate-200", label: "bg-slate-100 text-slate-500" },
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            <div className="relative pl-5 space-y-3">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" />
              {milestones.map((m: any, mIdx: number) => {
                const s = msStatus[m.status] || msStatus.unknown;
                return (
                  <div key={m.id || mIdx} className="relative flex items-start gap-3">
                    <div className={`absolute -left-5 mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${s.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900">{m.label}</span>
                        {m.time_label && <span className="text-[10px] text-slate-400 font-medium">{m.time_label}</span>}
                        {m.optional && <span className="text-[9px] text-slate-400 italic">optional</span>}
                        <span className={`text-[9px] font-semibold uppercase px-1 py-0.5 rounded tracking-wide ${s.label}`}>{m.status}</span>
                      </div>
                      {m.description && <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{m.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case "flow": {
        const d = (block as any).data || {};
        const nodes: any[] = d.nodes || [];
        const edges: any[] = d.edges || [];
        const nodeStatus: Record<string, string> = {
          recommended: "border-sky-400 bg-sky-50",
          current:     "border-amber-400 bg-amber-50",
          completed:   "border-emerald-300 bg-emerald-50",
          blocked:     "border-rose-300 bg-rose-50",
          neutral:     "border-slate-200 bg-white",
          upcoming:    "border-slate-200 bg-slate-50",
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            {block.text && <p className="text-xs text-slate-600">{block.text}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {nodes.map((node: any, nIdx: number) => (
                <div key={node.id || nIdx} className={`p-3 rounded-xl border text-xs shadow-2xs ${nodeStatus[node.status] || nodeStatus.neutral}`}>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900">{node.label}</span>
                    <span className="shrink-0 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{node.node_type}</span>
                  </div>
                  {node.description && <p className="text-[11px] text-slate-600 leading-relaxed">{node.description}</p>}
                </div>
              ))}
            </div>
            {edges.length > 0 && (
              <div className="text-[10px] text-slate-400 space-y-0.5 pt-1">
                {edges.map((e: any, eIdx: number) => (
                  <div key={eIdx} className="flex items-center gap-1">
                    <span className="font-medium text-slate-500">{e.from}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-slate-500">{e.to}</span>
                    {e.label && <span className="text-slate-400">· {e.label}</span>}
                    {e.condition && <span className="italic text-slate-400">({e.condition})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "pathway_map": {
        const d = (block as any).data || {};
        const lanes: any[] = d.lanes || [];
        const laneStatus: Record<string, string> = {
          completed: "bg-emerald-100 text-emerald-800",
          current:   "bg-amber-100 text-amber-900",
          upcoming:  "bg-slate-100 text-slate-600",
          blocked:   "bg-rose-100 text-rose-800",
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            {d.goal && <p className="text-xs text-slate-600 font-medium">Goal: {d.goal}</p>}
            <div className="grid grid-cols-1 gap-2.5">
              {lanes.map((lane: any, lIdx: number) => (
                <div key={lane.id || lIdx} className={`p-3.5 rounded-xl border shadow-2xs ${lane.recommended ? "border-sky-400 bg-sky-50/40" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{lane.title}</div>
                      {lane.summary && <p className="text-[11px] text-slate-500 mt-0.5">{lane.summary}</p>}
                    </div>
                    {lane.recommended && (
                      <span className="shrink-0 text-[9px] font-bold text-sky-700 bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Recommended</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {(lane.steps || []).map((step: any, sIdx: number) => (
                      <div key={step.id || sIdx} className="flex items-start gap-2 text-xs">
                        <div className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">{sIdx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-slate-800">{step.label}</span>
                          {step.description && <span className="text-slate-500 ml-1">— {step.description}</span>}
                          {step.status && step.status !== "upcoming" && (
                            <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded font-semibold ${laneStatus[step.status] || "bg-slate-100 text-slate-600"}`}>{step.status}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "scorecard": {
        const d = (block as any).data || {};
        const metrics: any[] = d.metrics || [];
        const trendIcon = (t: string) => {
          if (t === "up") return <TrendingUp className="w-3 h-3 text-emerald-600" />;
          if (t === "down") return <TrendingDown className="w-3 h-3 text-rose-500" />;
          return null;
        };
        const metricStatus: Record<string, string> = {
          excellent: "text-emerald-700",
          good:      "text-sky-700",
          warning:   "text-amber-700",
          critical:  "text-rose-700",
          neutral:   "text-slate-700",
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {metrics.map((m: any, mIdx: number) => (
                <div key={m.id || mIdx} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{m.label}</div>
                  <div className={`flex items-center gap-1 font-bold text-lg tabular-nums ${metricStatus[m.status] || metricStatus.neutral}`}>
                    <span>{m.value_type === "percentage" ? `${m.value}%` : m.value_type === "rating" ? `${m.value}/${m.max ?? 10}` : `${m.value}${m.unit ? ` ${m.unit}` : ""}`}</span>
                    {trendIcon(m.trend)}
                  </div>
                  {m.description && <p className="text-[10px] text-slate-500 leading-relaxed">{m.description}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "chart": {
        const d = (block as any).data || {};
        const categories: string[] = d.categories || [];
        const series: any[] = d.series || [];
        const chartType: string = d.chart_type || "bar";
        const maxVal = Math.max(...series.flatMap((s: any) => s.values || [0]), 1);
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            {block.text && <p className="text-xs text-slate-600">{block.text}</p>}
            <div className={`p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs text-xs ${d.source_status === "estimated" || d.source_status === "to_verify" ? "opacity-90" : ""}`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{chartType} chart</span>
                {d.source_status && d.source_status !== "verified" && (
                  <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">{d.source_status}</span>
                )}
              </div>
              {(chartType === "bar" || chartType === "funnel") && categories.map((cat: string, cIdx: number) => (
                <div key={cIdx} className="mb-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-slate-600 font-medium">{cat}</span>
                    <span className="text-[11px] font-semibold text-slate-800 tabular-nums">{series[0]?.values?.[cIdx] ?? "—"}{series[0]?.unit ? ` ${series[0].unit}` : ""}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.round(((series[0]?.values?.[cIdx] ?? 0) / maxVal) * 100)}%` }} />
                  </div>
                </div>
              ))}
              {(chartType === "line" || chartType === "donut") && (
                <div className="space-y-1">
                  {series.map((s: any, sIdx: number) => (
                    <div key={sIdx} className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-600">{s.label}:</span>
                      <span className="text-[11px] font-semibold text-slate-800 tabular-nums">{s.values?.join(", ")}{s.unit ? ` ${s.unit}` : ""}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-slate-400 mt-1">Categories: {categories.join(" · ")}</div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "progress": {
        const d = (block as any).data || {};
        const stages: any[] = d.stages || [];
        const stageStatus: Record<string, { ring: string; label: string }> = {
          completed: { ring: "border-emerald-500 bg-emerald-500 text-white",  label: "text-emerald-700" },
          current:   { ring: "border-amber-500 bg-amber-500 text-white animate-pulse", label: "text-amber-800 font-bold" },
          upcoming:  { ring: "border-slate-300 bg-white text-slate-400",       label: "text-slate-500" },
          blocked:   { ring: "border-rose-400 bg-rose-400 text-white",          label: "text-rose-700" },
          paused:    { ring: "border-violet-400 bg-violet-400 text-white",      label: "text-violet-700" },
          failed:    { ring: "border-rose-600 bg-rose-600 text-white",          label: "text-rose-800" },
          unknown:   { ring: "border-slate-200 bg-slate-100 text-slate-400",   label: "text-slate-400" },
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{block.title}</h4>}
            <div className="flex items-start gap-0 overflow-x-auto pb-1">
              {stages.map((stage: any, sIdx: number) => {
                const s = stageStatus[stage.status] || stageStatus.unknown;
                return (
                  <React.Fragment key={stage.id || sIdx}>
                    <div className="flex flex-col items-center min-w-[72px] max-w-[100px]">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${s.ring}`}>
                        {stage.status === "completed" ? "✓" : sIdx + 1}
                      </div>
                      <div className={`mt-1.5 text-center text-[10px] font-semibold px-1 leading-tight ${s.label}`}>{stage.label}</div>
                      {stage.description && <div className="text-[9px] text-slate-400 text-center mt-0.5 leading-tight">{stage.description}</div>}
                    </div>
                    {sIdx < stages.length - 1 && (
                      <div className="flex-1 mt-4 h-px min-w-[12px] bg-slate-200" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      }

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
      {(!schemaValid || !semanticValid) && (
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

      {/* Structured Interaction Section — only when there's an actual input type */}
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
                  const isSelected = selectedOption === optId(opt);
                  return (
                    <button
                      key={optId(opt)}
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
                  const isChecked = selectedMultiOptions.includes(optId(opt));
                  return (
                    <div
                      key={optId(opt)}
                      onClick={() => toggleMultiOption(optId(opt))}
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

        </div>
      )}

      {/* Recommended Actions — shown regardless of interaction kind/input_type */}
      {interaction && interaction.recommended_actions && interaction.recommended_actions.length > 0 && !submitted && (
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

      {/* Service Handoff Block */}
      {service && serviceFlow !== "NONE" && service.actions && service.actions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Verified Service Actions</span>
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-mono">
              {serviceFlow}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {service.actions.map((act: ServiceAction) => {
              const actId = act.action_id || act.id || "";
              const currentStatus = actionStatus[actId];
              const isExecuted = currentStatus?.executed;
              const hasAttempted = !!currentStatus;
              const trusted = TRUSTED_SERVICE_ACTIONS[actId];

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
