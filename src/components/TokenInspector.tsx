import React from "react";
import { useTokenLab } from "../context/TokenLabContext";
import {
  Activity,
  X,
  Sparkles,
  Zap,
  TrendingDown,
  Cpu,
  Layers,
  Clock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Flame,
} from "lucide-react";

export const TokenInspector: React.FC = () => {
  const {
    isTokenInspectorOpen,
    setTokenInspectorOpen,
    activeTurnTelemetry,
    currentConversation,
    sessionStats,
    setContextInspectorOpen,
    setMemoryTimelineOpen,
  } = useTokenLab();

  if (!isTokenInspectorOpen) return null;

  const usage = activeTurnTelemetry?.usage;
  const context = activeTurnTelemetry?.contextMetrics;
  const compaction = activeTurnTelemetry?.compactionMetrics;

  return (
    <aside
      id="token-inspector-panel"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-sky-100 text-sky-700">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Token Telemetry Inspector</h2>
            <p className="text-[11px] text-slate-500">Live request usage & context diagnostics</p>
          </div>
        </div>

        <button
          onClick={() => setTokenInspectorOpen(false)}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60"
          title="Close Inspector"
          aria-label="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Turn Level vs Session Selector Note */}
        {!usage ? (
          <div className="text-center py-10 text-slate-400 space-y-2">
            <Activity className="w-8 h-8 mx-auto stroke-1" />
            <p>Send a message to view turn-level telemetry.</p>
          </div>
        ) : (
          <>
            {/* 1. LATEST TURN HEADLINE CARDS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider">
                  Latest Turn Consumption
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {usage.latencyMs ? `${usage.latencyMs}ms` : ""}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* User Typed vs Actual Input (Rule #8) */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">User Message Typed</span>
                  <span className="text-sm font-bold text-slate-900">
                    {usage.currentUserTokens !== null ? `${usage.currentUserTokens} tokens` : "N/A"}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200">
                  <span className="text-[10px] text-sky-700 font-medium block">Total Model Input</span>
                  <span className="text-sm font-bold text-sky-900">
                    {usage.inputTokens.toLocaleString()} tokens
                  </span>
                </div>

                {/* Output Tokens */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Visible Output</span>
                  <span className="text-sm font-bold text-slate-900">
                    {usage.outputTokens.toLocaleString()} tokens
                  </span>
                </div>

                {/* Thinking Tokens (Rule #7) */}
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-700 font-medium block">Thinking / Reasoning</span>
                  <span className="text-sm font-bold text-amber-900">
                    {usage.thinkingTokens !== null ? `${usage.thinkingTokens} tokens` : "0 tokens"}
                  </span>
                </div>

                {/* Cached Tokens (Rule #8, #19) */}
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 col-span-2 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-700 font-medium block">Implicit Cache Read</span>
                    <span className="text-sm font-bold text-emerald-900">
                      {usage.cachedTokens !== null ? `${usage.cachedTokens.toLocaleString()} tokens` : "0 tokens"}
                    </span>
                  </div>
                  {usage.cacheHitPercentage !== null && (
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700 block">Hit Rate</span>
                      <span className="text-xs font-bold text-emerald-800">
                        {usage.cacheHitPercentage}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. LATENCY LIFECYCLE BREAKDOWN */}
            {activeTurnTelemetry?.timeline && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Request Lifecycle Latency</span>
                </span>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Pre-Provider Pipeline:</span>
                    <span className="font-medium text-slate-900">{activeTurnTelemetry.timeline.preProviderLatencyMs ?? 0}ms</span>
                  </div>
                  {activeTurnTelemetry.timeline.memoryAssemblyMs !== undefined && (
                    <div className="flex justify-between text-slate-500 pl-2">
                      <span>↳ Memory Assembly:</span>
                      <span>{activeTurnTelemetry.timeline.memoryAssemblyMs}ms</span>
                    </div>
                  )}
                  {activeTurnTelemetry.timeline.requestAssemblyMs !== undefined && (
                    <div className="flex justify-between text-slate-500 pl-2">
                      <span>↳ Request Assembly:</span>
                      <span>{activeTurnTelemetry.timeline.requestAssemblyMs}ms</span>
                    </div>
                  )}
                  {activeTurnTelemetry.timeline.providerTtftMs !== null && (
                    <div className="flex justify-between text-slate-600">
                      <span>Provider TTFT:</span>
                      <span className="font-medium text-emerald-700">{activeTurnTelemetry.timeline.providerTtftMs}ms</span>
                    </div>
                  )}
                  {activeTurnTelemetry.timeline.providerGenMs !== null && (
                    <div className="flex justify-between text-slate-600">
                      <span>Provider Generation:</span>
                      <span className="font-medium text-indigo-700">{activeTurnTelemetry.timeline.providerGenMs}ms</span>
                    </div>
                  )}
                  {activeTurnTelemetry.timeline.validationDurationMs !== undefined && (
                    <div className="flex justify-between text-slate-600">
                      <span>Protocol Validation:</span>
                      <span className="font-medium text-slate-900">{activeTurnTelemetry.timeline.validationDurationMs}ms</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                    <span>Total Latency:</span>
                    <span>{activeTurnTelemetry.timeline.totalLatencyMs ?? usage.latencyMs ?? 0}ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. CONTEXT BREAKDOWN (Rule #7, #28) */}
            {context && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider">
                    Context Breakdown
                  </span>
                  <button
                    onClick={() => setContextInspectorOpen(true)}
                    className="text-[10px] text-sky-600 hover:text-sky-800 font-medium underline"
                  >
                    Open Inspector
                  </button>
                </div>

                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>System Prompt:</span>
                    <span className="font-medium text-slate-900">{context.systemInstructionTokens} tokens</span>
                  </div>
                  {context.careerContextTokens > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Career Capsule:</span>
                      <span className="font-medium text-sky-700">{context.careerContextTokens} tokens</span>
                    </div>
                  )}
                  {context.summaryTokens > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Conversation Summary:</span>
                      <span className="font-medium text-indigo-700">{context.summaryTokens} tokens</span>
                    </div>
                  )}
                  {context.recentTurnsTokens > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Recent Turns:</span>
                      <span className="font-medium text-slate-900">{context.recentTurnsTokens} tokens</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Current Message:</span>
                    <span className="font-medium text-slate-900">{context.currentMessageTokens} tokens</span>
                  </div>
                  {context.removedTokens > 0 && (
                    <div className="flex justify-between text-emerald-700 pt-1 border-t border-slate-200 font-sans">
                      <span>Removed by Optimisation:</span>
                      <span className="font-bold text-emerald-800">-{context.removedTokens} tokens</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. COMPACTION BREAK-EVEN ANALYSIS (Rule #15) */}
            {compaction && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Compaction Break-Even</span>
                  </span>
                  <button
                    onClick={() => setMemoryTimelineOpen(true)}
                    className="text-[10px] text-sky-600 hover:text-sky-800 font-medium underline"
                  >
                    View Timeline
                  </button>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white p-2 rounded border border-amber-200 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block">Compaction Cost</span>
                      <span className="font-bold text-amber-800">{compaction.compactionTotalCost} tokens</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block">Break-Even Point</span>
                      <span className="font-bold text-slate-900">~{compaction.estimatedBreakEvenTurns} turns</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-normal">
                    Compaction consumed {compaction.compactionTotalCost} tokens to compress historical dialogue from {compaction.sourceTokens} tokens to {compaction.summaryTokens} tokens.
                  </p>
                </div>
              </div>
            )}

            {/* 4. SESSION CUMULATIVE STATS (Rule #10) */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider block">
                Session True AI Totals
              </span>

              <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2.5 shadow-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400 text-xs">True AI Consumption</span>
                  <span className="text-base font-bold text-white font-mono">
                    {(sessionStats?.trueTotalConsumption || 0).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-300 font-mono pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">User Chat Tokens:</span>
                    <span>{(sessionStats?.totalUserFacingTokens || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Compaction Calls Cost:</span>
                    <span>{(sessionStats?.compactionTotalTokens || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Baseline Estimate:</span>
                    <span>{(sessionStats?.baselineEstimatedTokens || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-medium">Net Tokens Saved:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    +{(sessionStats?.tokensSaved || 0).toLocaleString()} ({sessionStats?.netSavingsPercentage || 0}%)
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
