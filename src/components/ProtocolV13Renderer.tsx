import React, { useState, useEffect, useId } from "react";
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
  Info,
  AlertTriangle,
  XCircle,
  Minus,
  Pencil,
  ChevronRight,
  Code2,
  FileText,
  Share2,
  Zap,
  Globe,
  Database,
  LayoutGrid,
  Target,
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
import { ProtocolInteraction } from "./ProtocolInteraction";

interface ProtocolV13RendererProps {
  data: YuzeeResponseV13;
  initialFields?: Record<string,string>;
  rawJson?: string;
  schemaValid?: boolean;
  semanticValid?: boolean;
  validationErrors?: string[];
  onInteract?: (event: UserEvent) => Promise<boolean | void> | void;
  readOnly?: boolean;
  conversationId?: string;
  hideRecommendedActions?: boolean;
  onOpenPathway?: () => void;
  pathwayLearningCues?: boolean;
}

export const ProtocolV13Renderer: React.FC<ProtocolV13RendererProps> = ({
  data,
  initialFields,
  schemaValid = true,
  semanticValid = true,
  validationErrors = [],
  onInteract,
  readOnly = false,
  conversationId,
  hideRecommendedActions = false,
  onOpenPathway,
}) => {
  const outputAnchor = useId().replace(/:/g, "");
  // Service Action Confirmation
  const [pendingAction, setPendingAction] = useState<ServiceAction | null>(null);
  const [executedActions, setExecutedActions] = useState<Record<string, boolean>>({});

  // Must be declared before any early return to satisfy Rules of Hooks
  const [actionStatus, setActionStatus] = useState<Record<string, { executed: boolean; message: string }>>({});

  // Safe failure: show error state when semantic invariants fail
  if (!data) return null;
  if (semanticValid === false && validationErrors.length > 0) {
    return (
      <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-xs space-y-1.5" role="alert">
        <p className="font-semibold text-rose-900">Response validation failed — content not rendered.</p>
        <ul className="text-rose-800 space-y-0.5 list-disc list-inside">
          {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    );
  }

  // Model may omit id or leave it empty — fall back to value so it matches the server's trusted list
  const optId = (opt: YuzeeOption): string => opt.id || opt.value;

  const interaction = data.interaction;
  const blocks = data.content_blocks || (data as any).blocks || [];
  const readableSections = blocks.map((block, index) => ({title: block.title, index})).filter(section => section.title?.trim());
  const service = data.service_trigger;
  const serviceFlow: string = service?.primary_requested_service || 'NONE';
  const followups = data.followups;
  const visibleStatus: Record<string,string> = {current: "Start here", next: "Next step", blocked: "Needs attention", warning: "Check this"};

  const handleActionClick = (actionId: string, message: string) => {
    if (!readOnly) onInteract?.({ type: 'action_clicked', action_id: actionId, value: message, timestamp: Date.now() });
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
        const eyebrow = block.text && block.title ? block.text : null;
        const headingText = block.title || block.text || "";
        return (
          <div key={block.id || index} className="space-y-1.5 pt-1">
            {eyebrow && (
              <span className="block text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d] leading-none">{eyebrow}</span>
            )}
            {isH2 ? (
              <h2 className="text-[19px] font-bold text-[#1c1f26] leading-[1.4] tracking-[-0.01em]">{headingText}</h2>
            ) : (
              <h3 className="text-[16px] font-semibold text-[#1c1f26] leading-snug">{headingText}</h3>
            )}
          </div>
        );
      }

      case "text":
        return (
          <div key={block.id || index} className="space-y-1.5">
            {block.title && <h3 className="text-[16px] font-semibold text-[#1c1f26] leading-snug">{block.title}</h3>}
            <div className="prose prose-slate max-w-none prose-p:text-[16px] prose-p:leading-[1.7] prose-p:text-[#2c333d] prose-p:my-2 prose-li:text-[16px] prose-li:leading-[1.7] prose-li:text-[#2c333d] prose-strong:text-[#1c1f26] prose-headings:text-[#1c1f26]">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="response-table-scroll my-4 rounded-xl" style={{ border: '1px solid #e5ddd5' }}>
                      <table className="w-full border-collapse text-[13.5px]">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead style={{ background: '#faf8f5' }}>{children}</thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody>{children}</tbody>
                  ),
                  tr: ({ children }) => (
                    <tr
                      style={{ borderBottom: '1px solid #e5ddd5' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#f5f0eb'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                    >{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap" style={{ color: '#000000', borderRight: '1px solid #e5ddd5' }}>{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-2.5 align-top" style={{ color: '#000000', borderRight: '1px solid #e5ddd5' }}>{children}</td>
                  ),
                }}
              >{block.text || (block as any).content || (block as any).body || ""}</Markdown>
            </div>
          </div>
        );

      case "list": {
        const WORKFLOW_STATUSES = new Set(["current", "next", "complete", "blocked", "warning"]);
        const isWorkflow = block.items?.some((i: YuzeeItem) => WORKFLOW_STATUSES.has(i.status || ""));

        if (isWorkflow) {
          const statusColor: Record<string, string> = {
            current:  "text-blue-600",
            next:     "text-purple-600",
            complete: "text-emerald-600",
            blocked:  "text-rose-600",
            warning:  "text-amber-600",
          };
          return (
            <div key={block.id || index} className="space-y-2">
              {(block.title || block.text) && (
                <div className="mb-1">
                  {block.title && <h4 className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d]">{block.title}</h4>}
                  {block.text && <p className="text-[16px] text-[#5b6472] mt-0.5 leading-[1.7]">{block.text}</p>}
                </div>
              )}
              <ul className="border-t border-slate-100">
                {block.items?.map((item: YuzeeItem, iIdx: number) => {
                  const s = item.status || "";
                  const scls = statusColor[s] || "text-[#8a929d]";
                  return (
                    <li key={item.id || iIdx} className="py-6 border-b border-slate-100">
                      <div className="flex items-baseline justify-between gap-4 mb-1">
                        <p className="text-[17px] font-semibold text-[#1c1f26] leading-snug">{item.title}</p>
                        {visibleStatus[s] && <span className={`shrink-0 text-[11px] font-bold tracking-[0.12em] uppercase ${scls}`}>{visibleStatus[s]}</span>}
                      </div>
                      {(item.text || item.value) && (
                        <p className="text-[16px] text-[#5b6472] leading-[1.7]">{item.text || item.value}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }

        // Evidence row layout: items with side_label on LEFT in fixed 72px col (HAVE/NEED/GAP/PROOF pattern)
        const hasSidePanel = block.items?.some((i: YuzeeItem) => i.side_label || i.side_text || (i as any).icon);
        if (hasSidePanel) {
          const sideLabelColor = (status: string | undefined, label: string | undefined): string => {
            const s = (status || label || "").toLowerCase();
            if (s === "have" || s === "positive" || s === "complete" || s === "completed") return "text-emerald-700";
            if (s === "need" || s === "warning" || s === "gap") return "text-amber-700";
            if (s === "neutral" || s === "muted") return "text-[#5b6472]";
            if (s === "current" || s === "next" || s === "proof") return "text-blue-600";
          };
          const sideLabelIcon = (status: string | undefined, label: string | undefined): React.ReactNode => {
            const s = (status || label || "").toLowerCase();
            if (s === "have" || s === "positive" || s === "complete" || s === "completed") return <Check className="w-3 h-3" />;
            if (s === "need" || s === "warning") return <AlertCircle className="w-3 h-3" />;
            if (s === "gap") return <Minus className="w-3 h-3" />;
            if (s === "proof") return <FileCheck className="w-3 h-3" />;
            return null;
          };
          return (
            <div key={block.id || index} className="space-y-2">
              {block.title && <h4 className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d]">{block.title}</h4>}
              <ul className="border-t border-slate-100">
                {block.items?.map((item: YuzeeItem, iIdx: number) => {
                  const icon = (item as any).icon as string | undefined;
                  const sideLabel = item.side_label || (item as any).side_label;
                  const sideText = item.side_text || (item as any).side_text;
                  const labelColor = sideLabelColor(item.status, sideLabel);
                  const labelIcon = sideLabelIcon(item.status, sideLabel);
                  return (
                    <li key={item.id || iIdx} className="py-5 border-b border-slate-100 grid gap-[22px]" style={{ gridTemplateColumns: "72px 1fr" }}>
                      <div className="shrink-0 pt-0.5">
                        {sideLabel && (
                          <div className={`flex items-center gap-1 ${labelColor}`}>
                            {labelIcon}
                            <p className="text-[11px] font-bold tracking-[0.12em] uppercase leading-none">{sideLabel}</p>
                          </div>
                        )}
                        {icon && <span className="text-lg leading-none">{icon}</span>}
                        {sideText && !sideLabel && <p className="text-[12px] text-[#5b6472] leading-snug">{sideText}</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[16px] font-semibold text-[#1c1f26] leading-snug mb-0.5">{item.title}</p>
                        {item.text && <p className="text-[16px] text-[#5b6472] leading-[1.7]">{item.text}</p>}
                        {sideText && sideLabel && <p className="text-[13px] text-[#8a929d] mt-1">{sideText}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }

        // Default: numbered ruled rows
        const items = block.items || [];
        return (
          <div key={block.id || index} className="space-y-2">
            {(block.title || block.text) && (
              <div className="mb-1">
                {block.title && <h4 className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d]">{block.title}</h4>}
                {block.text && <p className="text-[16px] text-[#5b6472] mt-0.5 leading-[1.7]">{block.text}</p>}
              </div>
            )}
            <ul className="border-t border-slate-100">
              {items.map((item: YuzeeItem, iIdx: number) => {
                const emoji = (item as any).icon as string | undefined;
                const tag = emoji || String(iIdx + 1).padStart(2, "0");
                const tagCls = item.status === "negative" ? "text-rose-500" : item.status === "positive" ? "text-emerald-600" : "text-[#8a929d]";
                return (
                  <li key={item.id || iIdx} className="py-5 border-b border-slate-100 grid gap-[22px]" style={{ gridTemplateColumns: "72px 1fr" }}>
                    <span className={`text-[11px] font-bold tracking-[0.13em] uppercase pt-0.5 ${tagCls}`}>{tag}</span>
                    <div>
                      <p className="text-[16px] font-semibold text-[#1c1f26] leading-snug mb-0.5">{item.title}</p>
                      {(item.text || item.value) && (
                        <p className="text-[16px] text-[#5b6472] leading-[1.7]">{item.text || item.value}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }

      case "steps": {
        const WORKFLOW_STEP_STATUSES = new Set(["current", "next", "complete", "blocked", "warning"]);
        const hasStepStatuses = block.items?.some((i: YuzeeItem) => WORKFLOW_STEP_STATUSES.has(i.status || ""));

        // Numbered ruled rows — when no workflow statuses are present
        if (!hasStepStatuses) {
          const stepItems = block.items || [];
          return (
            <div key={block.id || index} className="space-y-2">
              {block.title && <h4 className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d]">{block.title}</h4>}
              <ul className="border-t border-slate-100">
                {stepItems.map((item: YuzeeItem, sIdx: number) => (
                  <li key={item.id || sIdx} className="py-5 border-b border-slate-100 grid gap-[22px]" style={{ gridTemplateColumns: "72px 1fr" }}>
                    <span className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d] pt-0.5">{String(sIdx + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="text-[16px] font-semibold text-[#1c1f26] leading-snug mb-0.5">{item.title}</p>
                      {(item.text || item.value) && (
                        <p className="text-[16px] text-[#5b6472] leading-[1.7]">{item.text || item.value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // Status-driven ruled rows (route/pathway style — title left, status badge right)
        const stepStatusColor: Record<string, string> = {
          current:  "text-blue-600",
          next:     "text-purple-600",
          complete: "text-emerald-600",
          blocked:  "text-rose-600",
          warning:  "text-amber-600",
        };
        const stepStatusIcon: Record<string, React.ReactNode> = {
          current:  null,
          next:     null,
          complete: <Check className="w-3 h-3" />,
          blocked:  <XCircle className="w-3 h-3" />,
          warning:  <AlertTriangle className="w-3 h-3" />,
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d]">{block.title}</h4>}
            <ul className="border-t border-slate-100">
              {block.items?.map((item: YuzeeItem, sIdx: number) => {
                const s = item.status || "";
                const scls = stepStatusColor[s] || "text-[#8a929d]";
                const sIcon = stepStatusIcon[s];
                return (
                  <li key={item.id || sIdx} className="py-6 border-b border-slate-100">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <p className="text-[17px] font-semibold text-[#1c1f26] leading-snug">{item.title}</p>
                      {visibleStatus[s] && (
                        <span className={`shrink-0 flex items-center gap-1 text-[11px] font-bold tracking-[0.12em] uppercase ${scls}`}>
                          {sIcon}
                          {visibleStatus[s]}
                        </span>
                      )}
                    </div>
                    {(item.text || item.value) && (
                      <p className="text-[16px] text-[#5b6472] leading-[1.7]">{item.text || item.value}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }

      case "table": {
        const columns = block.columns || [];
        const rows = block.rows || [];

        return (
          <div key={block.id || index} className="space-y-3">
            {block.title && (
              <h4 className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d]">{block.title}</h4>
            )}
            <div className="response-table-scroll rounded-lg" style={{ border: "1px solid #e5ddd5", background: "#faf8f5" }}>
              <table className="response-data-table w-full text-left border-collapse" style={{ minWidth: "680px", fontSize: "0.95rem", lineHeight: "1.55", color: "#000000" }}>
                <thead>
                  <tr style={{ background: "#faf8f5", borderBottom: "1px solid #e5ddd5" }}>
                    {columns.map((col) => (
                      <th key={col.key} scope="col" style={{ padding: "12px 16px", fontWeight: 650, fontSize: "0.8125rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "#000000" }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={row.id || rIdx} style={{ borderBottom: "1px solid #e5ddd5" }}>
                      {columns.map((col, cIdx) => {
                        const cell = row.cells?.find((c) => c.key === col.key);
                        return (
                          <td key={col.key} data-label={col.label} style={{ padding: "14px 16px", verticalAlign: "top", color: "#000000", fontWeight: cIdx === 0 ? 600 : 400, background: "#fffdfb" }}>
                            {cell?.value || "Not provided"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case "comparison": {
        const cmpCols: Array<{ key: string; label: string }> = block.columns || [];
        const cmpRows: Array<{ id?: string; criteria?: string; cells?: Array<{ key: string; value: string }> }> = block.rows || [];
        // Avoid duplicating the row label when Gemini also supplies it as an explicit criteria column.
        const criteriaAlreadyInColumns = cmpRows.length > 0 && cmpCols.some(col => /^(decision\s+)?(criteria|criterion|factor)$/i.test(col.label.trim()) && cmpRows.every(row => row.criteria?.trim() && row.cells?.find(cell => cell.key === col.key)?.value?.trim().toLowerCase() === row.criteria.trim().toLowerCase()));
        const hasCriteria = cmpRows.some((r) => r.criteria) && !criteriaAlreadyInColumns;
        return (
          <div key={block.id || index} className="space-y-3">
            {block.title && (
              <h4 className="text-[11px] font-bold tracking-[0.13em] uppercase text-[#8a929d]">{block.title}</h4>
            )}
            <div className="response-table-scroll rounded-lg" style={{ border: "1px solid #e5ddd5", background: "#faf8f5" }}>
              <table className="response-data-table w-full text-left border-collapse" style={{ minWidth: "760px", fontSize: "0.95rem", lineHeight: "1.55", color: "#000000" }}>
                <thead>
                  <tr style={{ background: "#faf8f5", borderBottom: "1px solid #e5ddd5" }}>
                  {hasCriteria && (
                      <th scope="col" style={{ padding: "12px 16px", fontWeight: 650, fontSize: "0.8125rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "#000000", width: "28%" }}>
                        Factor
                      </th>
                    )}
                    {cmpCols.map((col) => (
                      <th key={col.key} scope="col" style={{ padding: "12px 16px", fontWeight: 650, fontSize: "0.8125rem", letterSpacing: "0.04em", textTransform: "uppercase", color: "#000000" }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cmpRows.map((row, rIdx) => (
                    <tr key={row.id || rIdx} style={{ borderBottom: rIdx < cmpRows.length - 1 ? "1px solid #e5ddd5" : "none" }}>
                      {hasCriteria && (
                        <td data-label="Factor" style={{ padding: "14px 16px", verticalAlign: "top", fontWeight: 600, color: "#000000", background: "#fffdfb" }}>{row.criteria || row.id}</td>
                      )}
                      {cmpCols.map((col, cIdx) => {
                        const cell = row.cells?.find((c) => c.key === col.key);
                        return (
                          <td key={col.key} data-label={col.label} style={{ padding: "14px 16px", verticalAlign: "top", color: "#000000", background: "#fffdfb" }}>
                            {cell?.value || "Not provided"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case "callout": {
        const calloutBorder: Record<string, string> = {
          info:    "border-blue-500",
          default: "border-blue-500",
          success: "border-emerald-500",
          warning: "border-amber-500",
          danger:  "border-rose-500",
          muted:   "border-slate-300",
        };
        const calloutLabel: Record<string, string> = {
          info:    "text-blue-600",
          default: "text-blue-600",
          success: "text-emerald-600",
          warning: "text-amber-600",
          danger:  "text-rose-600",
          muted:   "text-[#5b6472]",
        };
        const calloutIcon: Record<string, React.ReactNode> = {
          info:    <Info className="w-3.5 h-3.5 shrink-0" />,
          default: <Info className="w-3.5 h-3.5 shrink-0" />,
          success: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
          warning: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
          danger:  <XCircle className="w-3.5 h-3.5 shrink-0" />,
          muted:   <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
        };
        const v = block.variant || "default";
        const bc = calloutBorder[v] || calloutBorder.default;
        const lc = calloutLabel[v] || calloutLabel.default;
        const icon = calloutIcon[v] || calloutIcon.default;
        return (
          <div
            key={block.id || index}
            className={`border-l-[3px] ${bc}`}
            style={{ padding: "20px 0 20px 22px" }}
            role={v === "danger" || v === "warning" ? "alert" : undefined}
          >
            {block.title && (
              <div className={`flex items-center gap-1.5 mb-2 ${lc}`}>
                {icon}
                <span className="text-[11px] font-bold tracking-[0.13em] uppercase">{block.title}</span>
              </div>
            )}
            <p className="text-[16px] leading-[1.7] text-[#2c333d]">{block.text}</p>
          </div>
        );
      }

      case "key_value":
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {block.items?.map((item: YuzeeItem) => (
                <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm flex flex-col items-start gap-1">
                  <span className="text-[#5b6472] font-medium">{item.title}</span>
                  <span className="font-semibold text-[#1c1f26]">{item.value || item.text}</span>
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
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
            {block.text && <p className="text-xs text-[#5b6472]">{block.text}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {cards.map((card: any, cIdx: number) => (
                <div key={card.id || cIdx} className={`p-3.5 rounded-xl border shadow-2xs space-y-1.5 ${statusColors[card.status] || statusColors.neutral}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-[#1c1f26]">{card.title}</div>
                      {card.subtitle && <div className="text-[11px] text-[#5b6472]">{card.subtitle}</div>}
                    </div>
                    {card.badge && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[#2c333d]">{card.badge}</span>
                    )}
                  </div>
                  {card.description && <p className="text-xs text-[#5b6472] leading-relaxed">{card.description}</p>}
                  {card.facts?.length > 0 && (
                    <div className="pt-1 border-t border-slate-200/80 grid grid-cols-2 gap-x-3 gap-y-1">
                      {card.facts.map((f: any, fIdx: number) => (
                        <div key={fIdx} className="flex flex-col">
                          <span className="text-[10px] text-[#8a929d] font-medium uppercase tracking-wide">{f.label}</span>
                          <span className="text-[11px] font-semibold text-[#2c333d]">{f.value}</span>
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
          current:   { dot: "bg-amber-500 animate-pulse motion-reduce:animate-none", label: "bg-amber-100 text-amber-900" },
          upcoming:  { dot: "bg-slate-300", label: "bg-slate-100 text-[#5b6472]" },
          blocked:   { dot: "bg-rose-400", label: "bg-rose-100 text-rose-800" },
          paused:    { dot: "bg-violet-400", label: "bg-violet-100 text-violet-800" },
          unknown:   { dot: "bg-slate-200", label: "bg-slate-100 text-[#5b6472]" },
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
            <div className="relative pl-5 space-y-3">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" />
              {milestones.map((m: any, mIdx: number) => {
                const s = msStatus[m.status] || msStatus.unknown;
                return (
                  <div key={m.id || mIdx} className="relative flex items-start gap-3">
                    <div className={`absolute -left-5 mt-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${s.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[#1c1f26]">{m.label}</span>
                        {m.time_label && <span className="text-[10px] text-[#8a929d] font-medium">{m.time_label}</span>}
                        {m.optional && <span className="text-[9px] text-[#8a929d] italic">optional</span>}
                        <span className={`text-[9px] font-semibold uppercase px-1 py-0.5 rounded tracking-wide ${s.label}`}>{m.status}</span>
                      </div>
                      {m.description && <p className="text-[11px] text-[#5b6472] mt-0.5 leading-relaxed">{m.description}</p>}
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
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
            {block.text && <p className="text-xs text-[#5b6472]">{block.text}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {nodes.map((node: any, nIdx: number) => (
                <div key={node.id || nIdx} className={`p-3 rounded-xl border text-xs shadow-2xs ${nodeStatus[node.status] || nodeStatus.neutral}`}>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-bold text-[#1c1f26]">{node.label}</span>
                    <span className="shrink-0 text-[9px] font-semibold text-[#8a929d] uppercase tracking-wider">{node.node_type}</span>
                  </div>
                  {node.description && <p className="text-[11px] text-[#5b6472] leading-relaxed">{node.description}</p>}
                </div>
              ))}
            </div>
            {edges.length > 0 && (
              <div className="text-[10px] text-[#8a929d] space-y-0.5 pt-1">
                {edges.map((e: any, eIdx: number) => (
                  <div key={eIdx} className="flex items-center gap-1">
                    <span className="font-medium text-[#5b6472]">{nodes.find((n:any)=>n.id===e.from)?.label || 'Unknown step'}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-[#5b6472]">{nodes.find((n:any)=>n.id===e.to)?.label || 'Unknown step'}</span>
                    {e.label && <span className="text-[#8a929d]">· {e.label}</span>}
                    {e.condition && <span className="italic text-[#8a929d]">({e.condition})</span>}
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
          upcoming:  "bg-slate-100 text-[#5b6472]",
          blocked:   "bg-rose-100 text-rose-800",
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
            {d.goal && <p className="text-xs text-[#5b6472] font-medium">Goal: {d.goal}</p>}
            <div className="grid grid-cols-1 gap-2.5">
              {lanes.map((lane: any, lIdx: number) => (
                <div key={lane.id || lIdx} className={`p-3.5 rounded-xl border shadow-2xs ${lane.recommended ? "border-sky-400 bg-sky-50/40" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-bold text-xs text-[#1c1f26]">{lane.title}</div>
                      {lane.summary && <p className="text-[11px] text-[#5b6472] mt-0.5">{lane.summary}</p>}
                    </div>
                    {lane.recommended && (
                      <span className="shrink-0 text-[9px] font-bold text-sky-700 bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Recommended</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {(lane.steps || []).map((step: any, sIdx: number) => (
                      <div key={step.id || sIdx} className="flex items-start gap-2 text-xs">
                        <div className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-[#5b6472]">{sIdx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-[#2c333d]">{step.label}</span>
                          {step.description && <span className="text-[#5b6472] ml-1">— {step.description}</span>}
                          {step.status && step.status !== "upcoming" && (
                            <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded font-semibold ${laneStatus[step.status] || "bg-slate-100 text-[#5b6472]"}`}>{step.status}</span>
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
          neutral:   "text-[#2c333d]",
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {metrics.map((m: any, mIdx: number) => (
                <div key={m.id || mIdx} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <div className="text-[10px] text-[#8a929d] font-semibold uppercase tracking-wide">{m.label}</div>
                  <div className={`flex items-center gap-1 font-bold text-lg tabular-nums ${metricStatus[m.status] || metricStatus.neutral}`}>
                    <span>{m.value_type === "percentage" ? `${m.value}%` : m.value_type === "rating" ? `${m.value}/${m.max ?? 10}` : `${m.value}${m.unit ? ` ${m.unit}` : ""}`}</span>
                    {trendIcon(m.trend)}
                  </div>
                  {m.description && <p className="text-[10px] text-[#5b6472] leading-relaxed">{m.description}</p>}
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
        const sourceLabel: Record<string,string> = {provided:'Provided figures',estimated:'Estimate',to_verify:'Needs checking',verified:'Marked verified in the response'};
        return <section key={block.id || index} className="space-y-3">
          {block.title && <h4 className="font-semibold">{block.title}</h4>}
          {block.text && <p className="text-sm text-slate-600">{block.text}</p>}
          <p className="text-sm text-slate-600">{sourceLabel[d.source_status] || 'Source not specified'} · Values shown as a table so every series can be compared.</p>
          <div className="response-table-scroll rounded-xl border border-slate-200">
            <table className="response-data-table w-full text-left text-sm">
              <caption className="sr-only">{block.title || 'Data comparison'}</caption>
              <thead><tr><th scope="col" className="p-3">Category</th>{series.map((s:any)=><th scope="col" className="p-3" key={s.id}>{s.label}{s.unit ? ' ('+s.unit+')' : ''}</th>)}</tr></thead>
              <tbody>{categories.map((category,i)=><tr className="border-t border-slate-200" key={i}><td className="p-3 font-medium" data-label="Category">{category}</td>{series.map((s:any)=><td className="p-3 tabular-nums" key={s.id} data-label={s.label+(s.unit?' ('+s.unit+')':'')}>{s.values?.[i] ?? 'Not provided'}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>;
      }

      case "progress": {
        const d = (block as any).data || {};
        const stages: any[] = d.stages || [];
        const stageStatus: Record<string, { ring: string; label: string }> = {
          completed: { ring: "border-emerald-500 bg-emerald-500 text-white",  label: "text-emerald-700" },
          current:   { ring: "border-amber-500 bg-amber-500 text-white animate-pulse motion-reduce:animate-none", label: "text-amber-800 font-bold" },
          upcoming:  { ring: "border-slate-300 bg-white text-[#8a929d]",       label: "text-[#5b6472]" },
          blocked:   { ring: "border-rose-400 bg-rose-400 text-white",          label: "text-rose-700" },
          paused:    { ring: "border-violet-400 bg-violet-400 text-white",      label: "text-violet-700" },
          failed:    { ring: "border-rose-600 bg-rose-600 text-white",          label: "text-rose-800" },
          unknown:   { ring: "border-slate-200 bg-slate-100 text-[#8a929d]",   label: "text-[#8a929d]" },
        };
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
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
                      {stage.description && <div className="text-[9px] text-[#8a929d] text-center mt-0.5 leading-tight">{stage.description}</div>}
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

      case "checklist":
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6472]">{block.title}</h4>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {block.items?.map((item: YuzeeItem, iIdx: number) => (
                <div key={item.id || iIdx} className="flex items-start gap-2 p-2 rounded-lg border text-xs bg-white border-slate-200">
                  <span className="shrink-0 w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center mt-0.5">
                    {['complete','completed'].includes(item.status) ? '✓' : '○'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1c1f26] leading-snug">{item.title}</p>
                    {(item.text || item.value) && (
                      <p className="text-[11px] text-[#5b6472] leading-snug mt-0.5">{item.text || item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default: {
        // AI sometimes uses the type string as title (e.g. "row_primary_stack") — strip it
        const isTypeAsTitle = block.title === block.type || /^row_/.test(block.title || "");
        const rows: any[] = block.rows || [];
        // If rows exist, use the first row's value as the card heading (e.g. "Primary Tech Stack")
        const cardHeading = isTypeAsTitle ? (rows[0]?.value || rows[0]?.text || "") : (block.title || "");
        const bodyRows = isTypeAsTitle && rows.length > 0 ? rows.slice(1) : rows;
        return (
          <div key={block.id || index} className="rounded-xl overflow-hidden text-sm" style={{ border: "1px solid #e5ddd5" }}>
            {cardHeading && (
              <div className="px-4 py-2.5 font-semibold text-[14px]" style={{ background: "#f5f0ea", color: "#3d2f26", borderBottom: "1px solid #e5ddd5" }}>
                {cardHeading}
              </div>
            )}
            {block.text && <p className="px-4 py-3 text-[#5b6472] leading-relaxed border-b border-[#e5ddd5]">{block.text}</p>}
            {block.items?.length > 0 && (
              <ul className="px-4 py-3 space-y-1.5">
                {block.items.map((item: any, i: number) => (
                  <li key={item.id || i} className="flex items-start gap-2 text-[13px]">
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      {item.title && <span className="font-medium text-[#1c1f26]">{item.title}</span>}
                      {item.text && <span className="text-[#5b6472]">{item.title ? ` — ${item.text}` : item.text}</span>}
                      {!item.title && !item.text && item.value && <span>{item.value}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {bodyRows.length > 0 && (
              <div>
                {bodyRows.map((row: any, i: number) => {
                  const label = row.label || row.key || row.criteria || "";
                  const value = row.value || row.text || "";
                  return (
                    <div key={row.id || i} className="px-4 py-3 border-t border-[#e5ddd5]">
                      {label && <div className="text-[10px] font-bold uppercase tracking-widest text-[#a89080] mb-1">{label}</div>}
                      <div className="text-[13px] text-[#4a3828] leading-relaxed">{value}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
    }
  };

  // Care text: the empathetic opening from response_intent (Oala HTML pattern)
  // Suppress internal protocol labels like SOCRATIC_DIRECTION, ACTION_PLAN, EXPLORE_OPTIONS
  const rawCareText = data.response_intent?.trim();
  const isProtocolLabel = rawCareText ? /^[A-Z][A-Z_]{2,}$/.test(rawCareText) : false;
  const careText = isProtocolLabel ? "" : rawCareText;

  // Pathway button: show when response has workflow/action-plan character
  const hasWorkflowBlocks = blocks.some((b: YuzeeContentBlock) =>
    (b.type === "list" || b.type === "steps") &&
    b.items?.some((i: YuzeeItem) => i.status === "current" || i.status === "next")
  );
  const responseIntentStr = (data.response_intent || "") + (data as any).response_direction || "";
  const suggestPathway = onOpenPathway && (
    hasWorkflowBlocks ||
    /ACTION_PLAN|GOAL|PATHWAY|ROADMAP|PLAN/i.test(responseIntentStr)
  );

  return (
    <div className="counselling-output space-y-4">

      {/* Care text — warm opening sentence reflecting user's situation */}
      {careText && careText !== "none" && (
        <p className="text-[15px] text-[#0d0d0d] leading-[1.65] font-normal">{careText}</p>
      )}

      {blocks[0] && <div id={`${outputAnchor}-section-0`} className="scroll-mt-6" data-output-type={blocks[0].type}>{renderBlock(blocks[0], 0)}</div>}

      {readableSections.length >= 5 && (
        <nav aria-label="In this answer" className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700 mb-2">In this answer</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {readableSections.map(section => <li key={section.index}><a className="text-sky-800 underline decoration-sky-200 underline-offset-4 hover:decoration-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" href={`#${outputAnchor}-section-${section.index}`}>{section.title}</a></li>)}
          </ul>
        </nav>
      )}
      {/* All explanations remain visible; links help readers move through longer answers. */}
      <div className="space-y-3">
        {blocks.slice(1).map((block, offset) => { const idx=offset+1; return <div key={block.id || idx} id={`${outputAnchor}-section-${idx}`} className="scroll-mt-6" data-output-type={block.type}>{renderBlock(block, idx)}</div>; })}
      </div>

      {/* Pathway CTA — show when response maps a journey */}
      {suggestPathway && !readOnly && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onOpenPathway}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-semibold shadow-sm shadow-indigo-200 hover:from-indigo-600 hover:to-violet-600 transition-all cursor-pointer"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Build my pathway →
          </button>
        </div>
      )}

      {(data.current_mode === 'S_SERVICE_HANDOFF' || data.rmo_readiness?.ready_to_generate && service?.service_intent_detected) && <p className="mt-4 text-sm font-medium text-slate-600" title="This is a draft in the conversation. Provider requests are not connected.">Draft only · Not sent</p>}
      <ProtocolInteraction key={interaction.question_id} interaction={interaction} initialFields={initialFields} readOnly={readOnly} onInteract={onInteract} />

      {/* Recommended Actions — suppressed when ChatArea renders them in the floating bar */}
      {!hideRecommendedActions && interaction && interaction.kind === "none" && interaction.recommended_actions && interaction.recommended_actions.length > 0 && !readOnly && (
        <div className="pt-1 flex flex-wrap gap-1.5">
          {interaction.recommended_actions.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => handleActionClick(act.id, act.message)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-800 border border-slate-200 hover:border-sky-300 text-[#2c333d] rounded-lg text-xs transition-colors cursor-pointer"
            >
              {act.label}
            </button>
          ))}
        </div>
      )}

      {/* Service Handoff Block */}
      {service && serviceFlow !== "NONE" && service.trigger_now !== false && service.actions && service.actions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Request options</span>
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-mono">
              Draft only
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
                  <div className="flex items-center justify-between font-semibold text-xs text-[#1c1f26]">
                    <span>{act.title || trusted?.title || "Service Action"}</span>
                    {act.requires_confirmation && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Confirm
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5b6472] leading-normal">
                    {act.description || trusted?.description || "Connect with authorized pathway providers."}
                  </p>

                  <button
                    type="button"
                    disabled={!trusted?.isConnectedInLab || hasAttempted || readOnly}
                    onClick={() => triggerServiceAction(act)}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      isExecuted
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : hasAttempted
                        ? "bg-slate-100 text-[#2c333d] border border-slate-300"
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
                        <span>{trusted?.isConnectedInLab ? "Continue" : "Not connected — nothing will be sent"}</span>
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
        message={`Are you sure you want to initiate "${pendingAction?.title || "Service Action"}"? Review the details before continuing.`}
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
