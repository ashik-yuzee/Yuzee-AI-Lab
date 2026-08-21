import React from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { BarChart3, X, Zap, TrendingDown, Cpu, Sparkles, Activity, Layers } from "lucide-react";

export const AnalyticsDashboardModal: React.FC = () => {
  const { isAnalyticsOpen, setAnalyticsOpen, sessionStats } = useTokenLab();

  if (!isAnalyticsOpen) return null;

  const totalCalls = sessionStats?.userFacingChatCalls || 0;
  const trueTotal = sessionStats?.trueTotalConsumption || 0;
  const promptTokens = sessionStats?.totalModelInputTokens || 0;
  const outputTokens = sessionStats?.totalModelOutputTokens || 0;
  const thinkingTokens = sessionStats?.totalThinkingTokens || 0;
  const cachedTokens = sessionStats?.totalCachedTokens || 0;
  const compactionCost = sessionStats?.compactionTotalTokens || 0;
  const tokensSaved = sessionStats?.tokensSaved || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="analytics-dashboard-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-800">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Token Lab Telemetry Analytics</h2>
              <p className="text-xs text-slate-500">Cumulative session performance and optimization efficiencies</p>
            </div>
          </div>

          <button
            onClick={() => setAnalyticsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Headline Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block mb-1">Conversational Turns</span>
              <span className="text-xl font-bold text-slate-900">{totalCalls}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200">
              <span className="text-[11px] text-sky-700 block mb-1">True AI Tokens</span>
              <span className="text-xl font-bold text-sky-900">{trueTotal.toLocaleString()}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] text-emerald-700 block mb-1">Net Tokens Saved</span>
              <span className="text-xl font-bold text-emerald-800">
                +{tokensSaved.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] text-amber-800 block mb-1">Compaction Cost</span>
              <span className="text-xl font-bold text-amber-900">{compactionCost.toLocaleString()}</span>
            </div>
          </div>

          {/* Token Distribution Breakdown */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider">
              Token Allocation Profile
            </h3>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>Model Input Prompts</span>
                  <span>{promptTokens.toLocaleString()} tokens</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-600 h-full rounded-full"
                    style={{ width: `${trueTotal > 0 ? (promptTokens / trueTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>Model Output Generation</span>
                  <span>{outputTokens.toLocaleString()} tokens</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${trueTotal > 0 ? (outputTokens / trueTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>Thinking / Reasoning Tokens</span>
                  <span>{thinkingTokens.toLocaleString()} tokens</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${trueTotal > 0 ? (thinkingTokens / trueTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 mb-1 font-medium">
                  <span>Implicit Cached Tokens</span>
                  <span>{cachedTokens.toLocaleString()} tokens</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${promptTokens > 0 ? (cachedTokens / promptTokens) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Efficiency Metrics */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 text-[11px] block">Avg Tokens / Turn</span>
              <span className="text-base font-bold text-slate-900">
                {sessionStats?.averageTokensPerTurn || 0} tokens
              </span>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 text-[11px] block">Cache Hit Percentage</span>
              <span className="text-base font-bold text-emerald-700">
                {sessionStats?.cacheHitRatio || 0}%
              </span>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 text-[11px] block">Net Savings Rate</span>
              <span className="text-base font-bold text-sky-700">
                {sessionStats?.netSavingsPercentage || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={() => setAnalyticsOpen(false)}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 cursor-pointer"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
