import React, { useState, useEffect } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import {
  OptimizationStrategy,
  ThinkingLevel,
  ResponseMode,
  StructuredMemoryCapsule,
} from "../types";
import {
  X,
  Layers,
  Brain,
  FileText,
  Sliders,
  Play,
  BarChart3,
  RotateCcw,
  Sparkles,
  Activity,
  Download,
  Info,
  CheckCircle2,
  Code2,
  ShieldCheck,
  Check,
  ExternalLink,
} from "lucide-react";
import * as api from "../services/api";
import { AppleSlider } from "./ui/AppleSlider";
import { AppleToggle } from "./ui/AppleToggle";
import { AppleConfirmDialog } from "./ui/AppleConfirmDialog";

export const AdvancedLabModal: React.FC = () => {
  const {
    isAdvancedLabOpen,
    setAdvancedLabOpen,
    activeLabTab,
    setActiveLabTab,
    currentConversation,
    updateCurrentConversationSettings,
    resetMemory,
    sessionStats,
    resetSessionStats,
    activeTurnTelemetry,
  } = useTokenLab();

  // Local state for benchmark
  const [benchmarkPrompt, setBenchmarkPrompt] = useState(
    "Help me transition into cybersecurity and build a 6-month study roadmap."
  );
  const [benchmarkResults, setBenchmarkResults] = useState<any[] | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isResetMemoryConfirmOpen, setIsResetMemoryConfirmOpen] = useState(false);
  const [isResetStatsConfirmOpen, setIsResetStatsConfirmOpen] = useState(false);

  // Protocol tab state
  const [protocolMeta, setProtocolMeta] = useState<any>(null);
  const [loadingProtocol, setLoadingProtocol] = useState(false);

  useEffect(() => {
    if (activeLabTab !== "protocol" || protocolMeta) return;
    const controller = new AbortController();
    setLoadingProtocol(true);
    fetch("/api/protocol/info", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setProtocolMeta(data))
      .catch((err) => { if (err.name !== "AbortError") console.error("Failed to load protocol info", err); })
      .finally(() => setLoadingProtocol(false));
    return () => controller.abort();
  }, [activeLabTab, protocolMeta]);

  if (!isAdvancedLabOpen) return null;

  const conv = currentConversation || {
    id: "default",
    title: "Career Exploration",
    model: "gemini-3.5-flash-lite",
    strategy: "ADAPTIVE_HYBRID" as OptimizationStrategy,
    contextBudget: 270000,
    recentTurnsToKeep: 100,
    thinkingLevel: "adaptive" as ThinkingLevel,
    responseMode: "standard" as ResponseMode,
    careerContext: { facts: "", goals: "", constraints: "", decisions: "", openThreads: "" },
    systemPromptMode: "default",
    useInteractionsApi: false,
    useFlashLiteUtility: true,
  };

  const handleCareerFieldChange = (field: keyof StructuredMemoryCapsule, value: string) => {
    const updated = {
      ...(conv.careerContext || {
        facts: "",
        goals: "",
        constraints: "",
        decisions: "",
        openThreads: "",
      }),
      [field]: value,
    };
    updateCurrentConversationSettings({ careerContext: updated });
  };

  const runBenchmarkTest = async () => {
    try {
      setIsBenchmarking(true);
      const res = await api.runBenchmark({
        conversationId: conv.id,
        prompt: benchmarkPrompt,
        model: conv.model,
      });
      setBenchmarkResults(res.results);
    } catch (e) {
      console.error("Benchmark failed:", e);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const exportConversationJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conv, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `yuzee-token-lab-${conv.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const navTabs = [
    { id: "context", label: "Context & Memory", icon: Layers },
    { id: "reasoning", label: "Thinking & Reasoning", icon: Brain },
    { id: "protocol", label: "Protocol v1.3 (JSON)", icon: ShieldCheck },
    { id: "prompt", label: "Prompt & Response", icon: FileText },
    { id: "optimization", label: "Optimization & Economics", icon: Sliders },
    { id: "trace", label: "Lifecycle Trace", icon: Activity },
    { id: "benchmark", label: "Benchmark Matrix", icon: Play },
    { id: "analytics", label: "Session Analytics", icon: BarChart3 },
  ];

  const effectiveTab = navTabs.some((t) => t.id === activeLabTab) ? activeLabTab : "context";

  const currentCapsule: StructuredMemoryCapsule = conv.careerContext || {
    facts: "",
    goals: "",
    constraints: "",
    decisions: "",
    openThreads: "",
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] max-h-[780px] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Advanced Research Lab</h2>
                <p className="text-[11px] text-slate-500">Fine-tune memory architecture, token economics, and Protocol v1.3 compliance</p>
              </div>
            </div>

            <button
              onClick={() => setAdvancedLabOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors"
              title="Close Lab"
              aria-label="Close Lab"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-white px-4 overflow-x-auto gap-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeLabTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveLabTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? "border-indigo-600 text-indigo-900 bg-indigo-50/40"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#FBFBFC]">
            {/* TAB: CONTEXT & MEMORY */}
            {effectiveTab === "context" && (
              <div className="space-y-6 max-w-4xl">
                {/* Strategy & Budget */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sky-600" />
                    <span>Memory Management Strategy</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "ADAPTIVE_HYBRID", title: "Adaptive Hybrid (Recommended)", desc: "Prioritized budget + stable prefix caching + incremental compaction." },
                      { id: "SEMANTIC_EVIDENCE", title: "Semantic Evidence (Experimental)", desc: "Episodic memory with typed temporal records. Retrieves relevant evidence from past episodes instead of compacting." },
                      { id: "SUMMARY_RECENT", title: "Summary + Recent Turns", desc: "Compacts older turns into a semantic summary while retaining last N turns." },
                      { id: "SLIDING_WINDOW", title: "Turn-safe Sliding Window", desc: "Strictly evicts turns exceeding window limit without background summary." },
                      { id: "BASELINE", title: "Baseline (Full History)", desc: "Sends full historical transcript without compaction (unbounded token growth)." },
                    ].map((s) => (
                      <div
                        key={s.id}
                        onClick={() => updateCurrentConversationSettings({ strategy: s.id as OptimizationStrategy })}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          conv.strategy === s.id
                            ? "border-sky-500 bg-sky-50/50 text-sky-950 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <div className="font-semibold text-xs text-slate-900">{s.title}</div>
                        <div className="text-[11px] text-slate-500 mt-1 leading-normal">{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                    <AppleSlider
                      label="Context Token Budget"
                      value={conv.contextBudget}
                      onChange={(val) => updateCurrentConversationSettings({ contextBudget: val })}
                      min={1000}
                      max={270000}
                      step={1000}
                      unit="tokens"
                      minLabel="1k (Aggressive)"
                      helperText="270k (Default)"
                      maxLabel="270k (Max)"
                    />

                    <AppleSlider
                      label="Recent Turns to Retain"
                      value={conv.recentTurnsToKeep}
                      onChange={(val) => updateCurrentConversationSettings({ recentTurnsToKeep: val })}
                      min={2}
                      max={100}
                      step={2}
                      unit="turns"
                      minLabel="2 turns"
                      helperText="100 turns (Default)"
                      maxLabel="100 turns"
                    />
                  </div>
                </div>

                {/* Structured Memory Capsule */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>Structured Memory Capsule</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Extracted facts & constraints injected as stable prefixes to maximize caching hits.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsResetMemoryConfirmOpen(true)}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded cursor-pointer"
                      title="Clear summary and compaction history"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Memory</span>
                    </button>
                  </div>

                  <div className="space-y-3 pt-1">
                    {[
                      { key: "facts", label: "Facts & Background", placeholder: "e.g. 2 years IT support, Linux CLI, CompTIA Network+" },
                      { key: "goals", label: "Target Roles & Goals", placeholder: "e.g. Junior SOC Analyst within 6-9 months" },
                      { key: "constraints", label: "Constraints (Budget & Time)", placeholder: "e.g. Under $1,000 learning budget, 12 hrs/week" },
                      { key: "decisions", label: "Agreed Decisions", placeholder: "e.g. Prioritizing CompTIA Security+ over CySA+ first" },
                      { key: "openThreads", label: "Open Threads & Questions", placeholder: "e.g. Evaluating TryHackMe SOC Level 1 vs BTL1" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={(currentCapsule as any)[field.key] || ""}
                          onChange={(e) => handleCareerFieldChange(field.key as any, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: REASONING & THINKING */}
            {effectiveTab === "reasoning" && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <span>Dynamic Thinking & Reasoning Budget</span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: "minimal", label: "Minimal", tokens: "0 tokens", desc: "Direct response" },
                      { id: "low", label: "Low", tokens: "128 tokens", desc: "Light validation" },
                      { id: "medium", label: "Medium", tokens: "512 tokens", desc: "Structured trade-offs" },
                      { id: "high", label: "High", tokens: "1,024 tokens", desc: "Deep multi-step logic" },
                      { id: "adaptive", label: "Adaptive (Auto)", tokens: "Dynamic", desc: "Zero-cost classifier" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => updateCurrentConversationSettings({ thinkingLevel: t.id as ThinkingLevel })}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          conv.thinkingLevel === t.id
                            ? "border-purple-500 bg-purple-50/50 text-purple-950 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <div className="font-semibold text-xs text-slate-900">{t.label}</div>
                        <div className="text-[10px] font-mono text-purple-700 mt-0.5">{t.tokens}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{t.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Adaptive Classifier Heuristic Explanation Table */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-sky-600" />
                      <span>How Adaptive Heuristic Reasoning Works:</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      To avoid charging an extra Gemini token-counting call, Yuzee runs a deterministic local classifier before dispatching requests:
                    </p>
                    <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1 pl-1">
                      <li><strong>Comparison / Roadmaps (512 budget)</strong>: Triggers on keywords like <em>compare, trade-off, pathway, plan, roadmap</em>.</li>
                      <li><strong>Simple Inquiries (0 budget)</strong>: Triggers on short definitions, greetings, formatting prompts.</li>
                      <li><strong>General Guidance (128 budget)</strong>: Default safe budget for general career and skill questions.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PROTOCOL V1.3 */}
            {effectiveTab === "protocol" && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Yuzee Response Protocol v1.3 Specification</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Guarantees JSON-only streaming, strict schema conformance, semantic validation, and interactive UI blocks.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs font-semibold">
                      Protocol v1.3 Active
                    </span>
                  </div>

                  {/* Protocol Core Directives */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Strict JSON Envelope</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        No Markdown headers, HTML, or preamble outside the root JSON object. Enforces pure structured data.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Content Block Hierarchy</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        First block is plain text (level="none", title=""). Subsequent blocks support nested lists, tables, and sections.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Interactive UI Elements</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        Single select, ranked priorities, text intake fields, and service hand-off cards.
                      </p>
                    </div>
                  </div>

                  {/* Hashes & Version Verification */}
                  {protocolMeta && (
                    <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-lg space-y-2 text-xs">
                      <div className="font-semibold text-sky-950 flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-sky-600" />
                        <span>Verified Hash Signatures</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-white p-2 rounded border border-sky-100">
                          <span className="text-slate-500 block text-[10px]">SYSTEM PROMPT HASH (v0.12)</span>
                          <span className="text-sky-900 font-bold break-all">{protocolMeta.promptHash}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-sky-100">
                          <span className="text-slate-500 block text-[10px]">JSON SCHEMA HASH (v1.3)</span>
                          <span className="text-emerald-900 font-bold break-all">{protocolMeta.schemaHash}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active JSON Schema Preview */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800">Protocol v1.3 JSON Schema Definition:</label>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono max-h-56 overflow-y-auto leading-relaxed">
                      {protocolMeta ? JSON.stringify(protocolMeta.schema, null, 2) : "Loading protocol schema..."}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PROMPT & RESPONSE */}
            {effectiveTab === "prompt" && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>System Instruction & Framing</span>
                  </h3>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "compact", label: "Compact (~25 tokens)", desc: "Ultra-lean role instructions" },
                      { id: "default", label: "Standard (~65 tokens)", desc: "Balanced guidance & boundaries" },
                      { id: "custom", label: "Custom System Prompt", desc: "User-defined prompt rules" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => updateCurrentConversationSettings({ systemPromptMode: p.id as any })}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          conv.systemPromptMode === p.id
                            ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <div className="font-semibold text-xs text-slate-900">{p.label}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{p.desc}</div>
                      </button>
                    ))}
                  </div>

                  {conv.systemPromptMode === "custom" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-800">Custom System Instruction:</label>
                      <textarea
                        rows={3}
                        value={conv.customSystemPrompt || ""}
                        onChange={(e) => updateCurrentConversationSettings({ customSystemPrompt: e.target.value })}
                        placeholder="Define specific instructions, response styles, or tone rules..."
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                      />
                    </div>
                  )}

                  {/* Response Mode Selector */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="text-xs font-semibold text-slate-800">Response Mode Directive:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: "standard", label: "Standard", desc: "Balanced steps & advice" },
                        { id: "quick", label: "Quick / Concise", desc: "High-density bullet points" },
                        { id: "explain", label: "Explain Deeply", desc: "Prerequisites & concepts" },
                        { id: "explore", label: "Explore Paths", desc: "Comparative pathways" },
                        { id: "decide", label: "Decision Matrix", desc: "Pros, cons & costs" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => updateCurrentConversationSettings({ responseMode: m.id as ResponseMode })}
                          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                            conv.responseMode === m.id
                              ? "border-sky-500 bg-sky-50 text-sky-950 font-semibold"
                              : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                          }`}
                        >
                          <div className="text-xs">{m.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: OPTIMIZATION ENGINE & ECONOMICS */}
            {effectiveTab === "optimization" && (
              <div className="space-y-6 max-w-4xl">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-600" />
                    <span>Advanced Optimization Engine</span>
                  </h3>

                  <div className="space-y-4">
                    <AppleToggle
                      label="Interactions API Server-Side Continuation"
                      description="Uses server-side interaction IDs to reuse KV-cache context and eliminate repetitive round-trip history transmission."
                      checked={!!conv.useInteractionsApi}
                      onChange={(checked) => updateCurrentConversationSettings({ useInteractionsApi: checked })}
                    />

                    <AppleToggle
                      label="Flash-Lite Utility Routing"
                      description="Routes summarization, compaction, and classification tasks to Gemini 3.5 Flash-Lite for minimum cost."
                      checked={conv.useFlashLiteUtility ?? true}
                      onChange={(checked) => updateCurrentConversationSettings({ useFlashLiteUtility: checked })}
                    />
                  </div>

                  {/* Economics Break-Even Calculator */}
                  <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs space-y-2">
                    <div className="font-semibold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Compaction Break-Even Formula</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-normal">
                      When older dialogue turns are compacted into a structured summary, a one-off compaction token cost is incurred.
                      Because each subsequent turn no longer transmits those evicted turns, net savings break-even occurs within:
                    </p>
                    <div className="font-mono text-xs bg-white p-2 rounded border border-emerald-200 text-emerald-950 font-bold">
                      Break-Even Turns = Compaction Token Cost / Net Saved Tokens Per Turn (~1.8 turns)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: LIFECYCLE TRACE */}
            {effectiveTab === "trace" && (
              <div className="space-y-4 max-w-4xl">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-sky-600" />
                    <span>Request Lifecycle Debug Trace</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Step-by-step pipeline waterfall executing token budgeting, prefix caching assembly, and execution telemetry.
                  </p>

                  {activeTurnTelemetry?.lifecycleTrace ? (
                    <div className="space-y-2 pt-2">
                      {activeTurnTelemetry.lifecycleTrace.steps.map((step: any) => (
                        <div
                          key={step.step}
                          className="flex items-start justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {step.step}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 font-sans text-xs">{step.name}</div>
                              <div className="text-[11px] text-slate-600 font-sans mt-0.5">{step.details}</div>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                              step.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : step.status === "optimized"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-8">
                      Send a message to generate a detailed lifecycle debug trace.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: BENCHMARK MATRIX */}
            {effectiveTab === "benchmark" && (
              <div className="space-y-4 max-w-4xl">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Play className="w-4 h-4 text-indigo-600" />
                        <span>Strategy Benchmark Matrix</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Compare token usage, latency, and cache hit efficiency across all 4 memory management strategies.
                      </p>
                    </div>

                    <button
                      onClick={runBenchmarkTest}
                      disabled={isBenchmarking}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:bg-slate-300"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isBenchmarking ? "Running..." : "Run Matrix Test"}</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Test Prompt:</label>
                    <input
                      type="text"
                      value={benchmarkPrompt}
                      onChange={(e) => setBenchmarkPrompt(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>

                  {benchmarkResults && (
                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                            <th className="p-2">Strategy</th>
                            <th className="p-2">Input</th>
                            <th className="p-2">Output</th>
                            <th className="p-2">Cached</th>
                            <th className="p-2 font-bold text-slate-900">Total Tokens</th>
                            <th className="p-2">Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {benchmarkResults.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2 font-sans font-medium text-slate-900">{r.label}</td>
                              <td className="p-2 text-slate-600">{r.inputTokens}</td>
                              <td className="p-2 text-slate-600">{r.outputTokens}</td>
                              <td className="p-2 text-emerald-600">{r.cachedTokens}</td>
                              <td className="p-2 font-bold text-sky-800">{r.totalTokens}</td>
                              <td className="p-2 text-slate-500">{r.latencyMs}ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: SESSION ANALYTICS */}
            {effectiveTab === "analytics" && (
              <div className="space-y-4 max-w-4xl">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                      <span>Cumulative Session Telemetry</span>
                    </h3>
                    <button
                      onClick={() => setIsResetStatsConfirmOpen(true)}
                      className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Counters</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">User Chat Turns</div>
                      <div className="text-base font-bold text-slate-900 font-mono mt-0.5">{sessionStats?.userFacingChatCalls || 0}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Tokens Saved</div>
                      <div className="text-base font-bold text-emerald-600 font-mono mt-0.5">{sessionStats?.tokensSaved?.toLocaleString() || 0}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Net Savings Ratio</div>
                      <div className="text-base font-bold text-sky-600 font-mono mt-0.5">{sessionStats?.netSavingsPercentage || 0}%</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Cache Hit Ratio</div>
                      <div className="text-base font-bold text-indigo-600 font-mono mt-0.5">{sessionStats?.cacheHitRatio || 0}%</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={exportConversationJSON}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Telemetry (JSON)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <AppleConfirmDialog
        isOpen={isResetMemoryConfirmOpen}
        onCancel={() => setIsResetMemoryConfirmOpen(false)}
        onConfirm={() => {
          resetMemory();
          setIsResetMemoryConfirmOpen(false);
        }}
        title="Reset Conversation Memory?"
        description="This will clear the semantic conversation summary and historical compaction logs for this session. Your career context facts will remain intact."
        confirmLabel="Reset Memory"
        isDestructive
      />

      <AppleConfirmDialog
        isOpen={isResetStatsConfirmOpen}
        onCancel={() => setIsResetStatsConfirmOpen(false)}
        onConfirm={() => {
          resetSessionStats();
          setIsResetStatsConfirmOpen(false);
        }}
        title="Reset Cumulative Counters?"
        description="This will reset all session telemetry counters (user tokens, model tokens, cache hits, and net savings) back to zero."
        confirmLabel="Reset Counters"
        isDestructive
      />
    </>
  );
};
