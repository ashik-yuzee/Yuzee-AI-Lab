import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { OptimizationStrategy, ThinkingLevel, ResponseMode } from "../types";
import { Settings, X, Save, Sparkles, Cpu, Layers, Sliders, Info, ShieldCheck, Check } from "lucide-react";

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    currentConversation,
    updateCurrentConversationSettings,
    capabilities,
  } = useTokenLab();

  const [systemMode, setSystemMode] = useState(currentConversation?.systemPromptMode || "default");
  const [customSys, setCustomSys] = useState(currentConversation?.customSystemPrompt || "");
  const [strategy, setStrategy] = useState<OptimizationStrategy>(currentConversation?.strategy || "ADAPTIVE_HYBRID");
  const [thinking, setThinking] = useState<ThinkingLevel>(currentConversation?.thinkingLevel || "adaptive");
  const [budget, setBudget] = useState(currentConversation?.contextBudget || 2000);
  const [recentTurns, setRecentTurns] = useState(currentConversation?.recentTurnsToKeep || 4);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isSettingsOpen) return null;

  const handleSave = () => {
    updateCurrentConversationSettings({
      systemPromptMode: systemMode as any,
      customSystemPrompt: customSys,
      strategy,
      thinkingLevel: thinking,
      contextBudget: budget,
      recentTurnsToKeep: recentTurns,
    });
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      setSettingsOpen(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="settings-developer-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-200 text-slate-800">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Optimization & Developer Settings</h2>
              <p className="text-xs text-slate-500">Fine-tune memory strategies, thinking levels, and context budgets</p>
            </div>
          </div>

          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Context Strategy Selection */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-800 block text-xs uppercase tracking-wider">
              Context Memory Strategy (Rule #12)
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { id: "ADAPTIVE_HYBRID", label: "Adaptive Hybrid (Default)", desc: "Token-budget prioritised dynamic context allocation" },
                { id: "SUMMARY_RECENT", label: "Summary + Recent Turns", desc: "Incremental compaction of evicted turns into summary" },
                { id: "SLIDING_WINDOW", label: "Sliding Window", desc: "Turn-safe window keeping last N complete turns" },
                { id: "BASELINE", label: "Baseline (Full History)", desc: "Sends entire uncompressed transcript (High token cost)" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id as OptimizationStrategy)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    strategy === s.id
                      ? "bg-sky-50 border-sky-300 ring-2 ring-sky-100 font-medium"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-bold text-slate-900 block mb-0.5">{s.label}</span>
                  <span className="text-[11px] text-slate-500">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Thinking Level (Gemini 3) (Rule #5) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 block text-xs uppercase tracking-wider">
                Thinking / Reasoning Level
              </label>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Gemini 3.6 Thinking
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
              {(["adaptive", "minimal", "low", "medium", "high"] as ThinkingLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setThinking(lvl)}
                  className={`py-2 px-1 rounded-lg border text-xs font-semibold capitalize cursor-pointer transition-all ${
                    thinking === lvl
                      ? "bg-amber-100 border-amber-300 text-amber-900 shadow-2xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Budget & Sliding Window Sliders */}
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div>
              <div className="flex justify-between font-semibold text-slate-800 mb-1">
                <span>Context Target Budget</span>
                <span className="text-sky-700">{budget.toLocaleString()} tokens</span>
              </div>
              <input
                type="range"
                min={500}
                max={8000}
                step={500}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full cursor-pointer accent-sky-600"
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                Optimization budget ceiling for memory manager
              </span>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-800 mb-1">
                <span>Recent Turns Retained</span>
                <span className="text-sky-700">{recentTurns} complete turns</span>
              </div>
              <input
                type="range"
                min={2}
                max={10}
                step={2}
                value={recentTurns}
                onChange={(e) => setRecentTurns(Number(e.target.value))}
                className="w-full cursor-pointer accent-sky-600"
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                Verbatim dialogue turns preserved before compaction
              </span>
            </div>
          </div>

          {/* 4. System Instruction Configuration (Rule #18) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="font-semibold text-slate-800 block text-xs uppercase tracking-wider">
              System Instruction Optimization
            </label>

            <div className="flex gap-2">
              {(["default", "compact", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSystemMode(mode)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize cursor-pointer transition-all ${
                    systemMode === mode
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {mode === "default" ? "Standard (~55t)" : mode === "compact" ? "Compact (~22t)" : "Custom"}
                </button>
              ))}
            </div>

            {systemMode === "custom" && (
              <textarea
                rows={3}
                value={customSys}
                onChange={(e) => setCustomSys(e.target.value)}
                placeholder="Enter custom prompt guidance..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono resize-none focus:ring-2 focus:ring-sky-100"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Runtime: <strong>{capabilities?.runtime || "preview-adapter"}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-settings"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{savedNotice ? "Saved!" : "Apply Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
