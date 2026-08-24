import React, { useState, useEffect, useRef } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { Zap, ArrowUp, Square, Info, X, Cpu } from "lucide-react";
import { GEMINI_MODELS } from "../data/models";

function modelShortName(modelId: string): string {
  const found = GEMINI_MODELS.find(m => m.id === modelId);
  return found ? found.name.replace('Gemini ', '') : modelId;
}

export const Composer: React.FC = () => {
  const { sendMessage, isStreaming, stopStreaming, currentConversation } = useTokenLab();
  const [text, setText] = useState("");
  const [tokenForecast, setTokenForecast] = useState<{
    userTokens: number;
    estimatedTotal: number;
    exact: boolean;
    breakdown?: any;
  } | null>(null);
  const [showBreakdownPopover, setShowBreakdownPopover] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Local fast heuristic (~4 chars/token)
  const localUserEstimate = text.trim().length === 0 ? 0 : Math.max(1, Math.ceil(text.trim().length * 0.26));

  // Local-only token forecast during typing — no provider countTokens calls.
  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTokenForecast(null);
      return;
    }
    setTokenForecast({
      userTokens: localUserEstimate,
      estimatedTotal: localUserEstimate + 180,
      exact: false,
    });
  }, [text, localUserEstimate]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowBreakdownPopover(false);
      }
    }
    if (showBreakdownPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBreakdownPopover]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    sendMessage(text);
    setText("");
    setTokenForecast(null);
    setShowBreakdownPopover(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const hasContent = text.trim().length > 0;

  return (
    <div id="composer-container" className="p-3 sm:p-4 border-t border-slate-200 bg-white relative">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Token Forecast Indicator Bar */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-1.5 relative">
            <Zap className={`w-3.5 h-3.5 ${hasContent ? "text-sky-600" : "text-slate-400"}`} />
            
            {!hasContent ? (
              <span className="text-slate-500 font-normal">0 message tokens</span>
            ) : tokenForecast ? (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-900 font-medium">
                  {tokenForecast.userTokens} message tokens · ~{tokenForecast.estimatedTotal.toLocaleString()} total request
                </span>
                <button
                  type="button"
                  onClick={() => setShowBreakdownPopover(!showBreakdownPopover)}
                  className="p-0.5 text-slate-400 hover:text-sky-600 rounded transition-colors"
                  title="View context attribution breakdown"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-slate-700">~{localUserEstimate} message tokens</span>
            )}

            {/* Subtle Breakdown Popover */}
            {showBreakdownPopover && tokenForecast?.breakdown && (
              <div
                ref={popoverRef}
                className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-xs z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider font-sans">
                    Request Breakdown
                  </span>
                  <button
                    onClick={() => setShowBreakdownPopover(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>User Message:</span>
                    <span className="font-semibold text-slate-900">{tokenForecast.breakdown.currentMessageTokens} tokens</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>System Instruction:</span>
                    <span>{tokenForecast.breakdown.systemInstructionTokens} tokens</span>
                  </div>
                  {tokenForecast.breakdown.careerContextTokens > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Structured Memory:</span>
                      <span className="text-sky-700">{tokenForecast.breakdown.careerContextTokens} tokens</span>
                    </div>
                  )}
                  {tokenForecast.breakdown.summaryTokens > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Summary:</span>
                      <span className="text-indigo-700">{tokenForecast.breakdown.summaryTokens} tokens</span>
                    </div>
                  )}
                  {tokenForecast.breakdown.recentTurnsTokens > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Recent Turns:</span>
                      <span>{tokenForecast.breakdown.recentTurnsTokens} tokens</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                    <span>Total Estimated:</span>
                    <span>{tokenForecast.estimatedTotal} tokens</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
            {currentConversation?.model && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                currentConversation.model.includes('lite')
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : currentConversation.model.includes('2.5') || currentConversation.model.includes('2.0')
                  ? 'bg-slate-100 border-slate-200 text-slate-600'
                  : 'bg-sky-50 border-sky-200 text-sky-700'
              }`}>
                <Cpu className="w-2.5 h-2.5" />
                {modelShortName(currentConversation.model)}
              </span>
            )}
            <span>{text.length > 0 ? `${text.length} chars` : "Shift+Enter for new line"}</span>
          </div>
        </div>

        {/* Input Textarea & Action Button */}
        <div className="relative flex items-center bg-white border border-slate-300 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 rounded-xl transition-all shadow-xs p-1.5 gap-2">
          <textarea
            id="composer-input"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask Yuzee about career pathways, certification roadmaps, or skill requirements..."
            className="flex-1 max-h-44 min-h-[38px] px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-hidden leading-relaxed"
          />

          {isStreaming ? (
            <button
              id="btn-stop-stream"
              onClick={stopStreaming}
              className="w-9 h-9 shrink-0 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Stop Generation"
              aria-label="Stop Generation"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              id="btn-send-message"
              onClick={handleSend}
              disabled={!hasContent}
              className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all ${
                hasContent
                  ? "bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer"
                  : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
              title="Send Message (Enter)"
              aria-label="Send Message"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
