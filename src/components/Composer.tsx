import React, { useState, useRef, useCallback } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { ArrowUp, Square, Cpu, Mic, MicOff } from "lucide-react";
import { GEMINI_MODELS } from "../data/models";

function modelShortName(modelId: string): string {
  const found = GEMINI_MODELS.find(m => m.id === modelId);
  return found ? found.name.replace('Gemini ', '') : modelId;
}

export const Composer: React.FC = () => {
  const { sendMessage, isStreaming, stopStreaming, currentConversation } = useTokenLab();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<any>(null);

  const toggleMic = useCallback(() => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome or Edge."); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onstart  = () => setListening(true);
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setText(t);
      if (textareaRef.current) { textareaRef.current.style.height = "auto"; textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`; }
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    recRef.current = rec; rec.start();
  }, [listening]);

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
        {/* Composer Footer Bar */}
        <div className="flex items-center justify-end px-1 text-xs text-slate-500 font-mono">
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
        <div className={`relative flex items-center bg-white border focus-within:ring-2 focus-within:ring-sky-100 rounded-xl transition-all shadow-xs p-1.5 gap-2 ${listening ? "border-red-400 ring-2 ring-red-100" : "border-slate-300 focus-within:border-sky-500"}`}>
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

          <button
            onClick={toggleMic}
            className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-all cursor-pointer ${listening ? "bg-red-50 text-red-500 hover:bg-red-100" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
            title={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

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
