import React from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { Clock, X, TrendingDown, RotateCcw, Zap, Layers, CheckCircle2 } from "lucide-react";

export const MemoryTimelineModal: React.FC = () => {
  const { isMemoryTimelineOpen, setMemoryTimelineOpen, currentConversation, resetMemory } = useTokenLab();

  if (!isMemoryTimelineOpen) return null;

  const history = currentConversation?.compactionHistory || [];
  const currentSummary = currentConversation?.summary;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="memory-timeline-modal"
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Memory Timeline & Compaction History</h2>
              <p className="text-xs text-slate-500">Inspect incremental context summarization events and break-even metrics</p>
            </div>
          </div>

          <button
            onClick={() => setMemoryTimelineOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Active Summary Capsule */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Active Conversation Memory State</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Version: {currentConversation?.summaryVersion || 0}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 whitespace-pre-wrap">
              {currentSummary || "No compacted summary yet. Full recent dialogue is retained in context."}
            </div>
          </div>

          {/* Timeline Events List */}
          <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-slate-800 uppercase text-[11px] tracking-wider">
              Compaction Events Log ({history.length})
            </h3>

            {history.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                No compaction events have occurred yet in this conversation.
                <p className="text-[11px] text-slate-400 mt-1">
                  Older dialogue turns will automatically be compacted when context exceeds threshold.
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {history.map((evt, idx) => (
                  <div key={evt.compactionEventId || idx} className="relative flex gap-3 items-start pl-1">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                      <TrendingDown className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900">
                          Compacted {evt.sourceTurnsRange || "Evicted Turns"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 pt-1">
                        Older turns were removed from context and compressed into memory bullets by a background summarisation call. Token counts for this operation are not available synchronously.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={resetMemory}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
            title="Clear compacted summary and restore full recent memory"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Conversation Memory</span>
          </button>

          <button
            onClick={() => setMemoryTimelineOpen(false)}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
