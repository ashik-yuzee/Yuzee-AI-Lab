import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { Settings, X, Database, Trash2, FlaskConical, ShieldCheck, Info, Check, Wifi } from "lucide-react";

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    setAdvancedLabOpen,
    setActiveLabTab,
    capabilities,
    localStorageStats,
    clearLocalData,
  } = useTokenLab();
  const [clearConfirm, setClearConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);

  if (!isSettingsOpen) return null;

  const handleClear = () => {
    clearLocalData();
    setClearConfirm(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  const openLab = (tab: string) => {
    setSettingsOpen(false);
    setActiveLabTab(tab);
    setAdvancedLabOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="settings-developer-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-200 text-slate-800">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">App Settings</h2>
              <p className="text-xs text-slate-500">Storage, API status, and lab shortcuts</p>
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">

          {/* API & Runtime Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Connection & Runtime</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Gemini API Key</span>
                {capabilities?.geminiApiKeyPresent ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-700 font-semibold">
                    <Info className="w-3.5 h-3.5" /> Not configured
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Runtime</span>
                <span className="font-mono font-medium">{capabilities?.runtime || "preview-adapter"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Context Caching</span>
                <span className={`font-semibold ${capabilities?.supportsExplicitCache ? "text-emerald-700" : "text-slate-500"}`}>
                  {capabilities?.supportsExplicitCache ? "Enabled" : "Disabled"}
                </span>
              </div>
              {!capabilities?.geminiApiKeyPresent && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                  Set <code className="font-mono">GEMINI_API_KEY</code> in your <code>.env</code> file and restart the server to enable live Gemini calls.
                </p>
              )}
            </div>
          </div>

          {/* Local Data Storage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Local Data Storage</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div className="text-xs text-slate-600 space-y-0.5">
                <div>
                  <span className="font-semibold text-slate-800">{localStorageStats.conversationCount}</span>{" "}
                  conversation{localStorageStats.conversationCount !== 1 ? "s" : ""} stored locally
                </div>
                <div className="text-slate-400">
                  {localStorageStats.bytes < 1024
                    ? `${localStorageStats.bytes} B`
                    : localStorageStats.bytes < 1048576
                    ? `${(localStorageStats.bytes / 1024).toFixed(1)} KB`
                    : `${(localStorageStats.bytes / 1048576).toFixed(2)} MB`}
                  {" "}· survives page refresh &amp; server restarts
                </div>
              </div>
              {cleared ? (
                <span className="flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                  <Check className="w-3.5 h-3.5" /> Cleared
                </span>
              ) : clearConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-red-600 font-medium">Delete all?</span>
                  <button onClick={handleClear} className="px-2 py-1 bg-red-600 text-white text-[11px] font-semibold rounded-lg cursor-pointer hover:bg-red-700">
                    Yes
                  </button>
                  <button onClick={() => setClearConfirm(false)} className="px-2 py-1 border border-slate-300 text-slate-600 text-[11px] rounded-lg cursor-pointer hover:bg-slate-100">
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setClearConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-600 text-[11px] font-semibold rounded-lg cursor-pointer hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Lab Shortcuts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Advanced Lab Shortcuts</span>
            </div>
            <p className="text-[11px] text-slate-500">
              AI model configuration (strategy, thinking, budget, prompts) lives in the Lab to keep it all in one place.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { tab: "context", label: "Memory Strategy", desc: "Context budget & memory" },
                { tab: "reasoning", label: "Thinking Level", desc: "Reasoning depth control" },
                { tab: "prompt", label: "System Prompt", desc: "Instruction mode & API" },
                { tab: "optimization", label: "Optimization", desc: "Token economics" },
                { tab: "benchmark", label: "Benchmark", desc: "Strategy comparison" },
                { tab: "analytics", label: "Analytics", desc: "Session usage charts" },
              ].map((s) => (
                <button
                  key={s.tab}
                  onClick={() => openLab(s.tab)}
                  className="p-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <div className="font-semibold text-[11px] text-slate-900 group-hover:text-indigo-800">{s.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            AI config lives in <span className="font-semibold text-indigo-600">Lab →</span>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
