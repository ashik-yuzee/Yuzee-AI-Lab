import React, { useState, useEffect, useRef } from "react";
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
  Download,
  Info,
  CheckCircle2,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";
import { GEMINI_MODELS, DEFAULT_MODEL_ID } from "../data/models";
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
    sharedSettings,
    updateSharedSettings,
    resetSharedPrompt,
  } = useTokenLab();

  // Local state for benchmark
  const [benchmarkPrompt, setBenchmarkPrompt] = useState(
    "Help me transition into cybersecurity and build a 6-month study roadmap."
  );
  const [benchmarkResults, setBenchmarkResults] = useState<any[] | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isResetMemoryConfirmOpen, setIsResetMemoryConfirmOpen] = useState(false);
  const [isResetStatsConfirmOpen, setIsResetStatsConfirmOpen] = useState(false);
  const [benchmarkModel, setBenchmarkModel] = useState("");
  const [benchmarkStrategies, setBenchmarkStrategies] = useState<string[]>(["BASELINE", "SUMMARY_RECENT", "ADAPTIVE_HYBRID", "SEMANTIC_EVIDENCE"]);
  const [benchmarkIsLive, setBenchmarkIsLive] = useState(false);
  const [defaultPromptContent, setDefaultPromptContent] = useState("");
  const [showPromptContent, setShowPromptContent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdvancedLabOpen || defaultPromptContent) return;
    api.fetchSystemPrompt().then(r => setDefaultPromptContent(r.content)).catch(() => {});
  }, [isAdvancedLabOpen, defaultPromptContent]);

  if (!isAdvancedLabOpen) return null;

  const conv = currentConversation || {
    id: "default",
    title: "Career Exploration",
    model: DEFAULT_MODEL_ID,
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
        model: benchmarkModel || conv.model,
        strategies: benchmarkStrategies as OptimizationStrategy[],
        isLive: benchmarkIsLive,
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
    { id: "prompt", label: "Prompt & Response", icon: FileText },
    { id: "optimization", label: "Optimization & Economics", icon: Sliders },
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
                    <div className="col-span-full">
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                        <span className="font-semibold">Shared defaults</span> — these values apply to all conversations and all users. Mode overrides (SAVE_TOKENS / FULL_CONTEXT) still apply on top.
                      </p>
                    </div>
                    <AppleSlider
                      label="Context Token Budget (Shared)"
                      value={sharedSettings?.contextBudget ?? conv.contextBudget}
                      onChange={(val) => updateSharedSettings({ contextBudget: val })}
                      min={1000}
                      max={270000}
                      step={1000}
                      unit="tokens"
                      minLabel="1k (Aggressive)"
                      helperText="270k (Default)"
                      maxLabel="270k (Max)"
                    />

                    <AppleSlider
                      label="Recent Turns to Retain (Shared)"
                      value={sharedSettings?.recentTurnsToKeep ?? conv.recentTurnsToKeep}
                      onChange={(val) => updateSharedSettings({ recentTurnsToKeep: val })}
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

            {/* TAB: PROMPT & RESPONSE */}
            {effectiveTab === "prompt" && (
              <div className="space-y-6 max-w-4xl">
                {/* System Prompt — read-only view */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Active System Prompt</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-full border border-slate-200">Read-only · v0.12</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1">
                        The Yuzee production prompt is shared across all users and sessions. It is versioned and cache-optimised for Gemini.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPromptContent(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      {showPromptContent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPromptContent ? "Hide" : "View"} Prompt</span>
                    </button>
                  </div>

                  {showPromptContent && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{defaultPromptContent.length.toLocaleString()} chars</span>
                        <span>·</span>
                        <span>hash {sharedSettings?.defaultPromptHash?.slice(0, 8) ?? '—'}</span>
                      </div>
                      <textarea
                        readOnly
                        rows={8}
                        value={defaultPromptContent}
                        className="w-full text-[11px] font-mono p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 resize-y"
                      />
                    </div>
                  )}

                  {/* Response Mode Selector — still per-conversation */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="text-xs font-semibold text-slate-800">Response Mode Directive <span className="text-slate-400 font-normal">(per conversation)</span>:</label>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Test Prompt:</label>
                      <input
                        type="text"
                        value={benchmarkPrompt}
                        onChange={(e) => setBenchmarkPrompt(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Model Override:</label>
                      <select
                        value={benchmarkModel || conv.model}
                        onChange={(e) => setBenchmarkModel(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                      >
                        {GEMINI_MODELS.filter(m => m.selectable).map(m => (
                          <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">Strategies to Include:</label>
                      <div className="space-y-1">
                        {(["BASELINE", "SUMMARY_RECENT", "ADAPTIVE_HYBRID", "SEMANTIC_EVIDENCE"] as const).map(s => (
                          <label key={s} className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={benchmarkStrategies.includes(s)}
                              onChange={(e) => setBenchmarkStrategies(prev =>
                                e.target.checked ? [...prev, s] : prev.filter(x => x !== s)
                              )}
                              className="rounded border-slate-300"
                            />
                            {s.replace(/_/g, " ")}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">Mode:</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="benchmarkMode"
                            checked={!benchmarkIsLive}
                            onChange={() => setBenchmarkIsLive(false)}
                          />
                          <span><strong>Modelled Estimate</strong> — zero API calls, instant</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="benchmarkMode"
                            checked={benchmarkIsLive}
                            onChange={() => setBenchmarkIsLive(true)}
                          />
                          <span><strong>Live Gemini</strong> — real provider calls, uses API quota</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {benchmarkResults && (
                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[11px]">
                            <th className="p-2">Strategy</th>
                            <th className="p-2">Mode</th>
                            <th className="p-2">Input</th>
                            <th className="p-2">Output</th>
                            <th className="p-2">Cached</th>
                            <th className="p-2 font-bold text-slate-900">Total</th>
                            <th className="p-2">Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {benchmarkResults.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2 font-sans font-medium text-slate-900 text-[11px]">{r.strategy}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.mode === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                  {r.mode}
                                </span>
                              </td>
                              <td className="p-2 text-slate-600">{r.inputTokens?.toLocaleString() ?? "—"}</td>
                              <td className="p-2 text-slate-600">{r.outputTokens?.toLocaleString() ?? "—"}</td>
                              <td className="p-2 text-emerald-600">{r.cachedTokens != null ? r.cachedTokens.toLocaleString() : "—"}</td>
                              <td className="p-2 font-bold text-sky-800">{r.totalTokens?.toLocaleString() ?? "—"}</td>
                              <td className="p-2 text-slate-500">{r.latencyMs != null ? `${r.latencyMs}ms` : "—"}</td>
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
