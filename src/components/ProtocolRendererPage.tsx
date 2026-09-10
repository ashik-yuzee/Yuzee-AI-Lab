import React, { useState } from "react";
import { ArrowLeft, Play, AlertCircle, FileJson } from "lucide-react";
import { YuzeeResponseV13, YuzeeContentBlock, YuzeeItem, YuzeeOption } from "../types";

// ─── Standalone minimalistic renderer ────────────────────────────────────────

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
              <p className="text-[16px] font-semibold text-slate-900 leading-snug">{block.title}</p>
            )}
            <p className="text-[15px] text-slate-800 leading-[1.7]">
              {block.text || (block as any).body || (block as any).content || ""}
            </p>
          </div>
        );

      case "list": {
        const items: YuzeeItem[] = block.items || [];
        const hasWorkflow = items.some(i => i.status && STEP_STATUS_SET.has(i.status));
        const hasSidePanel = !hasWorkflow && items.some(i => i.side_label || i.side_text || (i as any).icon);

        const sectionHeader = (block.title || block.text) && (
          <div className="mb-1">
            {block.title && (
              <span className="block text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400 mb-1.5">{block.title}</span>
            )}
            {block.text && <p className="text-[15px] text-slate-500 leading-[1.7]">{block.text}</p>}
          </div>
        );

        const workflowStatusColor: Record<string, string> = {
          current:  "text-blue-600",
          next:     "text-purple-600",
          complete: "text-emerald-600",
          blocked:  "text-rose-600",
          warning:  "text-amber-600",
        };

        if (hasWorkflow) {
          return (
            <section key={block.id || idx} className="space-y-1">
              {sectionHeader}
              <ul className="border-t border-slate-100">
                {items.map((item, iIdx) => {
                  const s = item.status || "";
                  const scls = workflowStatusColor[s] || "text-slate-400";
                  return (
                    <li key={item.id || iIdx} className="py-6 border-b border-slate-100">
                      <div className="flex items-baseline justify-between gap-4 mb-1">
                        <p className="text-[17px] font-semibold text-slate-900">{item.title}</p>
                        {s && <span className={`shrink-0 text-[11px] font-bold tracking-[0.12em] uppercase ${scls}`}>{s}</span>}
                      </div>
                      {(item.text || item.value) && (
                        <p className="text-[15px] text-slate-500 leading-[1.7]">{item.text || item.value}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }

        if (hasSidePanel) {
          const sideLabelColor = (status: string | undefined, label: string | undefined): string => {
            const s = (status || label || "").toLowerCase();
            if (s === "have" || s === "positive" || s === "complete" || s === "completed") return "text-emerald-700";
            if (s === "need" || s === "warning" || s === "gap") return "text-amber-700";
            if (s === "neutral" || s === "muted") return "text-slate-500";
            if (s === "current" || s === "next" || s === "proof") return "text-blue-600";
            return "text-slate-400";
          };
          return (
            <section key={block.id || idx} className="space-y-1">
              {sectionHeader}
              <ul className="border-t border-slate-100">
                {items.map((item, iIdx) => {
                  const emoji = (item as any).icon as string | undefined;
                  const sideLabel = item.side_label;
                  const sideText = item.side_text;
                  const labelColor = sideLabelColor(item.status, sideLabel);
                  return (
                    <li key={item.id || iIdx} className="py-5 border-b border-slate-100 grid gap-[22px]" style={{ gridTemplateColumns: "72px 1fr" }}>
                      <div className="shrink-0 pt-0.5">
                        {sideLabel && <p className={`text-[11px] font-bold tracking-[0.12em] uppercase leading-none ${labelColor}`}>{sideLabel}</p>}
                        {emoji && <span className="text-lg leading-none">{emoji}</span>}
                        {sideText && !sideLabel && <p className="text-[12px] text-slate-500 leading-snug">{sideText}</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[16px] font-semibold text-slate-900 leading-snug mb-0.5">{item.title}</p>
                        {item.text && <p className="text-[15px] text-slate-500 leading-[1.7]">{item.text}</p>}
                        {sideText && sideLabel && <p className="text-[13px] text-slate-400 mt-1">{sideText}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }

        // Default: numbered ruled rows
        return (
          <section key={block.id || idx} className="space-y-1">
            {sectionHeader}
            <ul className="border-t border-slate-100">
              {items.map((item, iIdx) => (
                <li key={item.id || iIdx} className="py-5 border-b border-slate-100 grid gap-[22px]" style={{ gridTemplateColumns: "72px 1fr" }}>
                  <span className="text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400 pt-0.5">
                    {String(iIdx + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold text-slate-900 leading-snug mb-0.5">{item.title}</p>
                    {(item.text || item.value) && (
                      <p className="text-[15px] text-slate-500 leading-[1.7]">{item.text || item.value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      }

      case "steps": {
        const items: YuzeeItem[] = block.items || [];
        const hasStatus = items.some(i => i.status && STEP_STATUS_SET.has(i.status));
        const stepStatusColor: Record<string, string> = {
          current:  "text-blue-600",
          next:     "text-purple-600",
          complete: "text-emerald-600",
          blocked:  "text-rose-600",
          warning:  "text-amber-600",
        };
        return (
          <section key={block.id || idx} className="space-y-1">
            {(block.title || block.text) && (
              <div className="mb-1">
                {block.title && (
                  <span className="block text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400 mb-1.5">{block.title}</span>
                )}
                {block.text && <p className="text-[15px] text-slate-500 leading-[1.7]">{block.text}</p>}
              </div>
            )}
            <ul className="border-t border-slate-100">
              {items.map((item, sIdx) => {
                const s = item.status || "";
                if (hasStatus) {
                  const scls = stepStatusColor[s] || "text-slate-400";
                  return (
                    <li key={item.id || sIdx} className="py-6 border-b border-slate-100">
                      <div className="flex items-baseline justify-between gap-4 mb-1">
                        <p className="text-[17px] font-semibold text-slate-900">{item.title}</p>
                        {s && <span className={`shrink-0 text-[11px] font-bold tracking-[0.12em] uppercase ${scls}`}>{s}</span>}
                      </div>
                      {(item.text || item.value) && (
                        <p className="text-[15px] text-slate-500 leading-[1.7]">{item.text || item.value}</p>
                      )}
                    </li>
                  );
                }
                const tag = String(sIdx + 1).padStart(2, "0");
                return (
                  <li key={item.id || sIdx} className="py-5 border-b border-slate-100 grid gap-[22px]" style={{ gridTemplateColumns: "72px 1fr" }}>
                    <span className="text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400 pt-0.5">{tag}</span>
                    <div>
                      <p className="text-[16px] font-semibold text-slate-900 leading-snug mb-0.5">{item.title}</p>
                      {(item.text || item.value) && (
                        <p className="text-[15px] text-slate-500 leading-[1.7]">{item.text || item.value}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
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
          muted:   "text-slate-500",
        };
        const v = block.variant || "default";
        const bc = calloutBorder[v] || calloutBorder.default;
        const lc = calloutLabel[v] || calloutLabel.default;
        return (
          <div
            key={block.id || idx}
            className={`border-l-[3px] ${bc}`}
            style={{ padding: "20px 0 20px 22px" }}
            role={v === "danger" || v === "warning" ? "alert" : undefined}
          >
            {block.title && (
              <span className={`block text-[11px] font-bold tracking-[0.13em] uppercase mb-2 ${lc}`}>{block.title}</span>
            )}
            <p className="text-[16px] leading-[1.7] text-slate-700">{block.text}</p>
          </div>
        );
      }

      case "heading": {
        const isH2 = block.level === "h2";
        const eyebrow = block.text && block.title ? block.text : null;
        const headingText = block.title || block.text || "";
        return (
          <div key={block.id || idx} className="space-y-1.5 pt-1">
            {eyebrow && (
              <span className="block text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400 leading-none">{eyebrow}</span>
            )}
            {isH2 ? (
              <h2 className="text-[19px] font-bold text-slate-900 leading-[1.4] tracking-[-0.01em]">{headingText}</h2>
            ) : (
              <h3 className="text-[15px] font-semibold text-slate-900 leading-snug">{headingText}</h3>
            )}
          </div>
        );
      }

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

            {/* Interaction — white card matching reference HTML */}
            {hasInteraction && (
              <section className="bg-white border border-slate-200 rounded-xl p-7 space-y-5" style={{ boxShadow: "0 1px 2px rgba(16,24,40,.03), 0 4px 14px rgba(16,24,40,.045)" }}>
                <span className="block text-[11px] font-bold tracking-[0.13em] uppercase text-blue-500">
                  {interaction!.kind === "question" ? "Your turn" : "Tailor your pathway"}
                </span>
                <p className="text-[17px] font-medium leading-[1.6] text-slate-900">
                  {interaction!.question}
                </p>

                {interaction!.options && interaction!.options.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {interaction!.options.map((opt: YuzeeOption) => (
                      <label
                        key={opt.id || opt.value}
                        className="flex items-start gap-3 px-4 py-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-white transition-colors cursor-pointer"
                      >
                        <input type="radio" name="interaction_opt" value={opt.value || opt.id} className="mt-1 shrink-0 accent-blue-600" />
                        <div>
                          <p className="text-[15px] font-semibold text-slate-900">{opt.label}</p>
                          {opt.description && (
                            <p className="text-[13px] text-slate-500 mt-0.5 leading-relaxed">{opt.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Type your response…"
                      className="w-full border border-slate-200 rounded-lg px-4 py-3.5 text-[15px] text-slate-900 bg-slate-50 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-slate-400">Take your time — this helps narrow down your pathway.</span>
                      <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[15px] font-semibold transition-colors cursor-pointer whitespace-nowrap">
                        Send
                      </button>
                    </div>
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
