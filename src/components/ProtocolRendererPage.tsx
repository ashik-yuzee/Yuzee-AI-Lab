import React, { useState } from "react";
import { ArrowLeft, Play, AlertCircle, FileJson } from "lucide-react";
import { YuzeeResponseV13, YuzeeContentBlock, YuzeeItem, YuzeeOption } from "../types";

// ─── Standalone card-style renderer ─────────────────────────────────────────

const CARD_PALETTE = [
  { grad: "bg-gradient-to-br from-indigo-50 to-blue-100",    chip: "bg-indigo-100 text-indigo-600" },
  { grad: "bg-gradient-to-br from-emerald-50 to-teal-100",   chip: "bg-emerald-100 text-emerald-700" },
  { grad: "bg-gradient-to-br from-amber-50 to-orange-100",   chip: "bg-amber-100 text-amber-700" },
  { grad: "bg-gradient-to-br from-violet-50 to-purple-100",  chip: "bg-violet-100 text-violet-700" },
  { grad: "bg-gradient-to-br from-rose-50 to-pink-100",      chip: "bg-rose-100 text-rose-600" },
  { grad: "bg-gradient-to-br from-sky-50 to-cyan-100",       chip: "bg-sky-100 text-sky-700" },
];

const STEP_STATUS_SET = new Set(["current", "next", "complete", "blocked", "warning"]);

const StandaloneRenderer: React.FC<{ data: YuzeeResponseV13 }> = ({ data }) => {
  const [answer, setAnswer] = useState("");
  const blocks: YuzeeContentBlock[] = data.content_blocks || (data as any).blocks || [];
  const interaction = data.interaction;

  // Separate heading + first text block into the hero
  const headingBlock = blocks.find(b => b.type === "heading");
  const firstTextBlock = blocks.find(b => b.type === "text");
  const bodyBlocks = blocks.filter(b => b !== headingBlock && b !== firstTextBlock);

  const rawIntent = (data.response_intent || "").trim();
  const isProtocolLabel = rawIntent ? /^[A-Z][A-Z_]{2,}$/.test(rawIntent) : false;
  const eyebrow = isProtocolLabel ? "Oala Counsellor" : rawIntent;

  const heroTitle =
    headingBlock?.title ||
    headingBlock?.text ||
    firstTextBlock?.title ||
    "Here's what I found for you";

  const heroBody = firstTextBlock?.text ||
    (firstTextBlock as any)?.body ||
    (firstTextBlock as any)?.content ||
    "";

  const hasInteraction =
    interaction &&
    interaction.kind !== "none" &&
    interaction.input_type !== "none" &&
    interaction.question;

  const renderBlock = (block: YuzeeContentBlock, idx: number) => {
    switch (block.type) {
      case "text":
        return (
          <div key={block.id || idx} className="space-y-1.5">
            {block.title && (
              <h3 className="text-base font-bold text-slate-900">{block.title}</h3>
            )}
            <p className="text-sm text-slate-500 leading-relaxed">
              {block.text || (block as any).body || (block as any).content || ""}
            </p>
          </div>
        );

      case "list": {
        const items: YuzeeItem[] = block.items || [];
        const hasSidePanel = items.some(i => i.side_label || i.side_text || (i as any).icon);

        const sectionHeader = (block.title || block.text) && (
          <div>
            {block.title && (
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{block.title}</h2>
            )}
            {block.text && <p className="text-sm text-slate-500 mt-1">{block.text}</p>}
          </div>
        );

        // Icon + side-panel rows (screenshot style 2)
        if (hasSidePanel) {
          const iconBgs = ["bg-indigo-100", "bg-emerald-100", "bg-amber-100", "bg-rose-100", "bg-violet-100", "bg-sky-100"];
          return (
            <section key={block.id || idx} className="space-y-4">
              {sectionHeader}
              <div className="space-y-3">
                {items.map((item, iIdx) => {
                  const emoji = (item as any).icon as string | undefined;
                  const sideLabel = item.side_label;
                  const sideText = item.side_text;
                  return (
                    <div key={item.id || iIdx} className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-2xl">
                      <div className={`shrink-0 w-10 h-10 rounded-xl ${iconBgs[iIdx % iconBgs.length]} flex items-center justify-center text-lg`}>
                        {emoji || <span className="text-xs font-bold text-slate-500">{String(iIdx + 1).padStart(2, "0")}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug mb-1">{item.title}</h3>
                        {item.text && <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>}
                      </div>
                      {(sideLabel || sideText) && (
                        <div className="shrink-0 w-40 text-right">
                          {sideLabel && (
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">{sideLabel}</p>
                          )}
                          {sideText && (
                            <p className="text-xs text-slate-500 leading-relaxed">{sideText}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        }

        // Default: numbered card grid (screenshot style 1)
        const cols =
          items.length === 1 ? "grid-cols-1" :
          items.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
          items.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
          "grid-cols-1 sm:grid-cols-2";
        return (
          <section key={block.id || idx} className="space-y-4">
            {sectionHeader}
            <div className={`grid gap-3.5 ${cols}`}>
              {items.map((item, iIdx) => {
                const c = CARD_PALETTE[iIdx % CARD_PALETTE.length];
                const emoji = (item as any).icon as string | undefined;
                return (
                  <div key={item.id || iIdx} className={`${c.grad} rounded-2xl p-5 min-h-[160px] flex flex-col gap-3 shadow-sm border border-white/80`}>
                    <div className={`self-start px-2 py-0.5 rounded-lg text-[11px] font-bold tracking-wide ${c.chip}`}>
                      {emoji ? <span className="text-base">{emoji}</span> : String(iIdx + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">{item.title}</h3>
                      {(item.text || item.value) && (
                        <p className="text-sm text-slate-500 leading-relaxed">{item.text || item.value}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      case "steps": {
        const items: YuzeeItem[] = block.items || [];
        const stepRowStyle: Record<string, { bg: string; numBg: string; border: string; shadow?: string }> = {
          current:  { bg: "bg-gradient-to-r from-amber-50 to-orange-50/60",  numBg: "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm",  border: "border-amber-200", shadow: "shadow-[0_0_0_3px_rgba(251,146,60,0.14)] shadow-sm" },
          next:     { bg: "bg-gradient-to-r from-sky-50/60 to-indigo-50/40", numBg: "bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-sm",    border: "border-slate-200/80" },
          complete: { bg: "bg-gradient-to-r from-emerald-50 to-teal-50/60",  numBg: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm",  border: "border-emerald-200" },
          blocked:  { bg: "bg-gradient-to-r from-rose-50 to-pink-50/60",     numBg: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm",     border: "border-rose-200" },
          warning:  { bg: "bg-gradient-to-r from-amber-50/40 to-slate-50",   numBg: "bg-slate-200 text-slate-600",                                          border: "border-slate-200" },
        };
        const stepPillStyle: Record<string, string> = {
          current:  "bg-amber-100 text-amber-800",
          next:     "bg-sky-100 text-sky-700",
          complete: "bg-emerald-100 text-emerald-800",
          blocked:  "bg-rose-100 text-rose-700",
          warning:  "bg-slate-100 text-slate-600",
        };
        return (
          <section key={block.id || idx} className="space-y-4">
            {(block.title || block.text) && (
              <div>
                {block.title && (
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{block.title}</h2>
                )}
                {block.text && <p className="text-sm text-slate-500 mt-1">{block.text}</p>}
              </div>
            )}
            <div className="space-y-2.5">
              {items.map((item, sIdx) => {
                const s = item.status || "";
                const r = stepRowStyle[s] || { bg: "bg-white", numBg: "bg-slate-100 text-slate-700", border: "border-slate-200" };
                const pillCls = stepPillStyle[s];
                const statusLabel = s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
                return (
                  <div
                    key={item.id || sIdx}
                    className={`flex items-start gap-4 border rounded-2xl p-5 ${r.bg} ${r.border} ${r.shadow ?? ""}`}
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${r.numBg}`}>
                      {s === "complete" ? "✓" : sIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5 mb-1.5 leading-snug">{item.title}</h3>
                      {(item.text || item.value) && (
                        <p className="text-sm text-slate-500 leading-relaxed">{item.text || item.value}</p>
                      )}
                    </div>
                    {statusLabel && pillCls && (
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${pillCls}`}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      case "callout": {
        const calloutStyles: Record<string, { grad: string; icon: string; symbol: string }> = {
          success: { grad: "bg-gradient-to-br from-emerald-50 to-teal-100",  icon: "bg-emerald-100 text-emerald-700", symbol: "✓" },
          warning: { grad: "bg-gradient-to-br from-amber-50 to-orange-100",  icon: "bg-amber-100 text-amber-700",   symbol: "!" },
          danger:  { grad: "bg-gradient-to-br from-rose-50 to-pink-100",     icon: "bg-rose-100 text-rose-700",     symbol: "✕" },
          muted:   { grad: "bg-gradient-to-br from-slate-50 to-slate-100",   icon: "bg-slate-200 text-slate-600",   symbol: "·" },
          default: { grad: "bg-gradient-to-br from-indigo-50 to-blue-100",   icon: "bg-indigo-100 text-indigo-600", symbol: "→" },
          info:    { grad: "bg-gradient-to-br from-indigo-50 to-blue-100",   icon: "bg-indigo-100 text-indigo-600", symbol: "→" },
        };
        const cv = calloutStyles[block.variant || "default"] || calloutStyles.default;
        const customIcon = (block as any).icon as string | undefined;
        return (
          <div key={block.id || idx} className={`rounded-2xl p-4 flex gap-3 shadow-sm border border-white/80 ${cv.grad}`}>
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${cv.icon}`}
            >
              {customIcon || cv.symbol}
            </div>
            <div className="flex-1 min-w-0">
              {block.title && (
                <p className="font-bold text-sm text-slate-900 mb-1 leading-snug">{block.title}</p>
              )}
              <p className="text-sm text-slate-600 leading-relaxed">{block.text}</p>
            </div>
          </div>
        );
      }

      case "heading":
        return (
          <div key={block.id || idx} className="pt-2">
            {block.level === "h2" ? (
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {block.title || block.text}
              </h2>
            ) : (
              <h3 className="text-base font-bold text-slate-900">
                {block.title || block.text}
              </h3>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-[#f6f7fb] min-h-full p-6 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200/90 rounded-[28px] shadow-[0_18px_50px_rgba(20,24,40,0.08)] overflow-hidden">

          {/* Hero */}
          <header className="px-8 sm:px-10 pt-10 pb-8 border-b border-slate-200">
            {eyebrow && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-extrabold uppercase tracking-widest mb-4">
                {eyebrow}
              </div>
            )}
            <h1 className="text-2xl sm:text-[32px] font-extrabold text-slate-900 leading-tight tracking-tight mb-4 max-w-2xl">
              {heroTitle}
            </h1>
            {heroBody && (
              <p className="text-base text-slate-500 leading-relaxed max-w-2xl">{heroBody}</p>
            )}
          </header>

          {/* Body sections */}
          <div className="px-8 sm:px-10 py-8 space-y-10">
            {bodyBlocks.map((block, idx) => renderBlock(block, idx))}

            {/* Interaction — dark box */}
            {hasInteraction && (
              <section className="bg-[#17181c] text-white rounded-[22px] p-7 space-y-5">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                  {interaction!.kind === "question"
                    ? "Clarifying Question"
                    : "Tailor your pathway"}
                </p>
                <h2 className="text-lg font-bold leading-snug text-white max-w-xl">
                  {interaction!.question}
                </h2>

                {interaction!.options && interaction!.options.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {interaction!.options.map((opt: YuzeeOption) => (
                      <button
                        key={opt.id || opt.value}
                        className="text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-white font-medium transition-colors cursor-pointer border border-white/10"
                      >
                        {opt.label}
                        {opt.description && (
                          <span className="block text-xs text-slate-400 mt-0.5 font-normal">
                            {opt.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Type your response..."
                      className="flex-1 bg-white/10 border border-white/20 text-white rounded-[14px] px-4 py-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:bg-white/15"
                    />
                    <button className="px-5 py-3.5 bg-white text-slate-900 rounded-[14px] text-sm font-bold hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap">
                      Continue
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Placeholder JSON shown in the textarea by default ───────────────────────

const PLACEHOLDER = `{
  "schema_version": "1.3",
  "response_intent": "AI Automation Pathway",
  "content_blocks": [
    {
      "id": "h1",
      "type": "heading",
      "level": "h1",
      "title": "From software engineering to AI automation"
    },
    {
      "id": "t1",
      "type": "text",
      "text": "Transitioning from software engineering to AI automation is a natural and highly achievable step. Because you already understand programming, data flow, APIs, and system architecture, you do not need to restart your education."
    },
    {
      "id": "l1",
      "type": "list",
      "title": "What changes, and what carries over",
      "text": "Your software engineering foundation remains highly relevant.",
      "items": [
        { "id": "i1", "title": "Transferable Strengths", "text": "Your existing backend logic, API integration, debugging, and Git skills remain directly relevant.", "status": "" },
        { "id": "i2", "title": "New Core Focus", "text": "AI automation centres on agentic workflows, LLM orchestration, function calling, and structured outputs.", "status": "" },
        { "id": "i3", "title": "Operational Realities", "text": "Unlike deterministic code, AI workflows require handling non-deterministic outputs, prompt evaluation, and guardrails.", "status": "" }
      ]
    },
    {
      "id": "s1",
      "type": "steps",
      "title": "Your transition pathway",
      "text": "A practical sequence from foundations to portfolio-ready systems.",
      "items": [
        { "id": "s1a", "title": "Master LLM APIs & Prompt Architecture", "text": "Gain hands-on familiarity with provider APIs including OpenAI and Anthropic. Practice system prompting, schema validation, and tool-use mechanics.", "status": "current" },
        { "id": "s1b", "title": "Learn AI Frameworks & Orchestration", "text": "Build stateful multi-step agents with frameworks such as LangGraph or CrewAI.", "status": "next" },
        { "id": "s1c", "title": "Develop and Deploy Proof-of-Concept Projects", "text": "Create end-to-end automations such as document parsing pipelines or customer support agents with RAG.", "status": "next" }
      ]
    }
  ],
  "interaction": {
    "kind": "question",
    "active": true,
    "input_type": "text",
    "question": "What tech stack do you currently use, and are you leaning more toward code-first AI agent development or business workflow automation?"
  },
  "service_trigger": { "trigger_now": false, "needs_more_clarity": true, "rmo_readiness": "NOT_READY", "service": null, "actions": [] },
  "followups": []
}`;

// ─── Page ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export const ProtocolRendererPage: React.FC<Props> = ({ onBack }) => {
  const [jsonText, setJsonText] = useState("");
  const [parsed, setParsed] = useState<YuzeeResponseV13 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRender = () => {
    const text = jsonText.trim() || PLACEHOLDER;
    try {
      setParsed(JSON.parse(text) as YuzeeResponseV13);
      setError(null);
      return;
    } catch (_) {}
    try {
      const cleaned = text.replace(/[\r\n]+/g, " ");
      setParsed(JSON.parse(cleaned) as YuzeeResponseV13);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setParsed(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB]">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 flex items-center gap-3 shadow-xs shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Back to Chat"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <FileJson className="w-5 h-5 text-indigo-600" />
        <div>
          <p className="font-semibold text-slate-900 text-sm leading-none">Protocol v1.3 Renderer</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Paste JSON → see how Oala renders it</p>
        </div>
      </div>

      {/* Two-pane body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: JSON input */}
        <div className="w-[42%] min-w-[280px] flex flex-col border-r border-slate-200 bg-white">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-700">JSON Input</span>
            <button
              onClick={handleRender}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Render</span>
            </button>
          </div>

          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="flex-1 resize-none font-mono text-[11px] leading-relaxed p-4 text-slate-800 bg-white outline-none placeholder:text-slate-300"
          />

          {error && (
            <div className="px-4 py-3 border-t border-red-100 bg-red-50 flex items-start gap-2 text-red-700 text-xs shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span className="font-mono break-all">{error}</span>
            </div>
          )}
        </div>

        {/* Right: rendered output */}
        <div className="flex-1 overflow-y-auto">
          {parsed ? (
            <StandaloneRenderer data={parsed} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <FileJson className="w-10 h-10" />
              <p className="text-sm">
                Paste JSON on the left and click{" "}
                <strong className="text-slate-600">Render</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
