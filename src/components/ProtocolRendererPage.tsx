import React, { useState } from "react";
import { ArrowLeft, Play, AlertCircle, FileJson } from "lucide-react";
import { YuzeeResponseV13 } from "../types";
import { ProtocolV13Renderer } from "./ProtocolV13Renderer";

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
          <p className="text-[11px] text-slate-500 mt-0.5">Paste JSON → see exactly how Oala renders it in chat</p>
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer" style={{ backgroundColor: 'var(--accent)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
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
        <div className="flex-1 overflow-y-auto px-6 py-8 bg-white">
          {parsed ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[17px] font-bold text-[#0d0d0d]">Oala</span>
              </div>
              <div className="text-[15px] leading-[1.65] text-[#0d0d0d]">
                <ProtocolV13Renderer data={parsed} readOnly={true} />
              </div>
            </div>
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
