import React, { useState } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { X, Layers, CheckCircle2, AlertCircle, FileText, Sparkles } from "lucide-react";

export const ContextInspectorModal: React.FC = () => {
  const { isContextInspectorOpen, setContextInspectorOpen, activeTurnTelemetry } = useTokenLab();
  const [activeTab, setActiveTab] = useState<"included" | "excluded">("included");

  if (!isContextInspectorOpen) return null;

  const context = activeTurnTelemetry?.contextMetrics;
  const included = context?.includedSections || [];
  const excluded = context?.excludedSections || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="context-inspector-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Context Inspector</h2>
              <p className="text-xs text-slate-500">Inspect exact prompt components transmitted to Gemini</p>
            </div>
          </div>

          <button
            onClick={() => setContextInspectorOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab("included")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "included"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Included Context ({included.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("excluded")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "excluded"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Excluded by Optimiser ({excluded.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "included" ? (
            included.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No active prompt payload to inspect. Send a turn first.
              </div>
            ) : (
              included.map((sec, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-slate-900">{sec.name}</span>
                      <p className="text-[11px] text-slate-500">{sec.description}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded font-mono text-xs font-bold">
                      {sec.tokens} tokens
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {sec.preview}
                  </div>
                </div>
              ))
            )
          ) : excluded.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No items were excluded in the latest request. (All context fits within budget).
            </div>
          ) : (
            excluded.map((sec, idx) => (
              <div key={idx} className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs text-slate-900">{sec.name}</span>
                    <p className="text-[11px] text-amber-800 font-medium">Reason: {sec.reason}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-mono text-xs font-bold">
                    Saved ~{sec.tokens} tokens
                  </span>
                </div>
                <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/80 font-mono text-[11px] text-slate-600 truncate">
                  {sec.preview}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Total Assembled Request: <strong>{context?.totalAssembledTokens || 0} tokens</strong>
          </span>
          <button
            onClick={() => setContextInspectorOpen(false)}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
