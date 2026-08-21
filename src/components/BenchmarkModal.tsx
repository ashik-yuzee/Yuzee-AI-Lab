import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { BenchmarkResult, OptimizationStrategy } from "../types";
import * as api from "../services/api";
import { Gauge, X, Play, AlertTriangle, Check, Layers, ArrowRight, Zap } from "lucide-react";

export const BenchmarkModal: React.FC = () => {
  const { isBenchmarkOpen, setBenchmarkOpen, currentConversation } = useTokenLab();
  const [prompt, setPrompt] = useState(
    "Help me transition into cybersecurity and build a 6-month study roadmap."
  );
  const [isLive, setIsLive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[] | null>(null);

  const scenarioSteps = [
    "1. User wants to become a cybersecurity analyst.",
    "2. User describes existing IT skills.",
    "3. User asks for required skills.",
    "4. User asks for courses.",
    "5. User changes timeline.",
    "6. User adds a budget constraint.",
    "7. User compares two routes.",
    "8. User asks which previous recommendation still applies.",
    "9. User changes one constraint.",
    "10. User asks for the final pathway.",
  ];

  if (!isBenchmarkOpen) return null;

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    try {
      const res = await api.runBenchmark({
        conversationId: currentConversation?.id,
        prompt,
        model: currentConversation?.model || "gemini-3.6-flash",
        strategies: ["BASELINE", "SLIDING_WINDOW", "SUMMARY_RECENT", "ADAPTIVE_HYBRID"],
        isLive,
      });
      setResults(res.results);
    } catch (e) {
      console.error("Benchmark failed:", e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="benchmark-matrix-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Benchmark Context Strategies Matrix</h2>
              <p className="text-xs text-slate-500">Side-by-side comparison across 4 memory optimization modes</p>
            </div>
          </div>

          <button
            onClick={() => setBenchmarkOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quota Warning (Rule #30) */}
        <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Quota Notice:</strong> This benchmark simulates and evaluates multiple context strategies side-by-side.
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Prompt & Scenario Control */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <label className="font-semibold text-slate-700 block">Benchmark Test Prompt</label>
              
              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsLive(false)}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    !isLive ? "bg-slate-800 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Modelled Estimate (0 Calls)
                </button>
                <button
                  type="button"
                  onClick={() => setIsLive(true)}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    isLive ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Live Gemini 3.6 API
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-sky-100"
              />
              <button
                id="btn-execute-benchmark"
                onClick={handleRunBenchmark}
                disabled={isRunning || !prompt.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-semibold cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunning ? (isLive ? "Executing Gemini..." : "Evaluating...") : (isLive ? "Run Live Benchmark" : "Run Modelled Matrix")}</span>
              </button>
            </div>

            {/* Built-in Scenario Progression Accordion (Rule #49) */}
            <details className="text-[11px] text-slate-600 cursor-pointer">
              <summary className="font-medium text-sky-700 hover:text-sky-900">
                View 10-Step Cybersecurity Transition Scenario Reference
              </summary>
              <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 grid sm:grid-cols-2 gap-1 font-mono text-[10px]">
                {scenarioSteps.map((step, i) => (
                  <div key={i} className="text-slate-700">
                    {step}
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Results Comparison Grid */}
          {results && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider">
                  Benchmark Results ({results.length} Strategies)
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  results[0]?.mode === "live" ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"
                }`}>
                  {results[0]?.mode === "live" ? "Real Gemini Provider Telemetry" : "Modelled Context Estimation"}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {results.map((res, idx) => {
                  const isAdaptive = res.strategy === "ADAPTIVE_HYBRID";
                  const isBaseline = res.strategy === "BASELINE";

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border space-y-3 transition-all ${
                        isAdaptive
                          ? "bg-sky-50/50 border-sky-300 shadow-xs"
                          : isBaseline
                          ? "bg-rose-50/30 border-rose-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs">{res.label}</span>
                            {res.mode === "live" && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-emerald-100 text-emerald-800 rounded font-semibold">LIVE</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block">{res.notes}</span>
                        </div>
                        {isAdaptive && (
                          <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-semibold text-[10px]">
                            Recommended
                          </span>
                        )}
                        {isBaseline && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[10px]">
                            High Overhead
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                        <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                          <span className="text-[9px] text-slate-500 block">Total</span>
                          <span className="font-bold text-slate-900">{res.totalTokens.toLocaleString()}</span>
                        </div>

                        <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                          <span className="text-[9px] text-slate-500 block">Input</span>
                          <span className="font-bold text-sky-800">{res.inputTokens.toLocaleString()}</span>
                        </div>

                        <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                          <span className="text-[9px] text-slate-500 block">Output</span>
                          <span className="font-bold text-indigo-700">{res.outputTokens.toLocaleString()}</span>
                        </div>

                        <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                          <span className="text-[9px] text-slate-500 block">Latency</span>
                          <span className="font-bold text-slate-800">{res.latencyMs ? `${res.latencyMs}ms` : "-"}</span>
                        </div>
                      </div>

                      {res.mode === "live" && res.ttftMs && (
                        <div className="flex items-center justify-between px-2.5 py-1 bg-emerald-50/60 rounded border border-emerald-200 text-[10px] text-emerald-900">
                          <span>TTFT: <strong>{res.ttftMs}ms</strong></span>
                          <span>Generation: <strong>{res.generationMs}ms</strong></span>
                          {res.thinkingTokens !== null && <span>Thinking: <strong>{res.thinkingTokens}t</strong></span>}
                          {res.cachedTokens !== null && <span>Cache: <strong>{res.cachedTokens}t</strong></span>}
                        </div>
                      )}

                      <div className="p-2 bg-white/90 rounded border border-slate-200 text-[11px] text-slate-600">
                        <span className="font-medium text-slate-800 block mb-0.5">Response Preview:</span>
                        <p className="line-clamp-2">{res.responsePreview}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={() => setBenchmarkOpen(false)}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
