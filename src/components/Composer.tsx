import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { ArrowUp, Square, Mic, MicOff, Plus, Paperclip, X } from "lucide-react";
import {parseOalaMention, addressOala, isOalaSuggestion} from '../oala/invocation';

const MicroRouterStatus = React.lazy(() => import('./MicroRouterStatus').then(m => ({default:m.MicroRouterStatus})));

interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64
  previewUrl?: string; // for images
}

const ACCEPTED = "image/*,application/pdf,text/plain,text/csv,application/json";

export const Composer: React.FC = () => {
  const { sendMessage, isStreaming, stopStreaming, currentConversation } = useTokenLab();
  const draftKey = `yuzee-message-draft:${currentConversation?.id || 'new'}`;
  const readDraft = () => { try { return sessionStorage.getItem(draftKey) || ''; } catch { return ''; } };
  const [text, setText] = useState(readDraft);
  useEffect(() => { if (!isStreaming) setText(readDraft()); }, [draftKey]);
  useEffect(() => { try { if (text) sessionStorage.setItem(draftKey,text); else sessionStorage.removeItem(draftKey); } catch {} }, [text,draftKey]);
  const [listening, setListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const oala = parseOalaMention(text);
  const showOalaSuggestion = !mentionDismissed && isOalaSuggestion(text);
  const selectOala = () => {
    setText(addressOala(text));
    setMentionDismissed(true);
    textareaRef.current?.focus();
  };

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
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    recRef.current = rec; rec.start();
  }, [listening]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (showOalaSuggestion && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault(); selectOala(); return;
    }
    if (showOalaSuggestion && e.key === 'Escape') {
      e.preventDefault(); setMentionDismissed(true); return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;
    const sent = await sendMessage(text, attachments.map(({ mimeType, data }) => ({ mimeType, data })));
    if (!sent) return;
    setText("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setMentionDismissed(false);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        const att: Attachment = {
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          data: base64,
        };
        if (file.type.startsWith("image/")) att.previewUrl = result;
        setAttachments(prev => [...prev, att]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const hasContent = text.trim().length > 0 || attachments.length > 0;

  return (
    <div className="px-3 sm:px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6 pt-2 sm:pt-3 bg-white">
      <div className="max-w-4xl mx-auto">
        {showOalaSuggestion && !isStreaming && (
          <div id="oala-suggestion" className="mb-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <button type="button" onClick={selectOala} className="w-full rounded-xl p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-purple-500">
              <span className="block font-semibold text-slate-800">@Oala · Yuzee guidance</span>
              <span className="block text-sm text-slate-500">Understand our services and find a useful next step.</span>
            </button>
          </div>
        )}
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs text-slate-500">
          {oala.active ? <>
            <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 font-medium text-purple-700">
              @Oala · Yuzee help
              <button type="button" disabled={isStreaming} aria-label="Remove Oala mention" onClick={() => {setText(oala.message);textareaRef.current?.focus();}} className="rounded-full p-1 hover:bg-purple-100"><X className="h-3.5 w-3.5"/></button>
            </span>
            <React.Suspense fallback={<span>Yuzee services and next steps</span>}><MicroRouterStatus/></React.Suspense>
          </> : <button type="button" disabled={isStreaming} onClick={selectOala} className="rounded-lg py-2 text-left hover:text-purple-700 focus-visible:outline-2 focus-visible:outline-purple-500">Ask <span className="font-semibold text-purple-700">@Oala</span> about Yuzee services</button>}
        </div>
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-[var(--accent-8)] border border-[var(--accent-border)] rounded-lg px-2 py-1 text-[12px] text-[var(--accent)] font-medium max-w-[200px]"
              >
                {att.previewUrl ? (
                  <img src={att.previewUrl} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                ) : (
                  <Paperclip className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="ml-0.5 text-[var(--accent)]/60 hover:text-[var(--accent)] shrink-0 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pill-shaped input */}
        <div
          className={`flex items-center gap-1 sm:gap-1.5 bg-white border rounded-[28px] px-2.5 sm:px-3 py-1 sm:py-2.5 transition-all ${
            listening ? "border-red-300" : "border-[#e2e6ed]"
          }`}
          style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.04), 0 2px 6px rgba(0,0,0,.05)" }}
        >
          {/* + attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={handleFiles}
          />
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[#8a929d] hover:text-[var(--accent)] hover:bg-[var(--accent-8)] transition-colors cursor-pointer shrink-0"
            title="Attach file (image, PDF, text)"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Auto-growing textarea */}
          <textarea
            id="composer-input"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            aria-label="Your message"
            aria-describedby={showOalaSuggestion ? 'oala-suggestion' : undefined}
            disabled={isStreaming}
            placeholder="Tell me what you’d like help with…"
            className="flex-1 min-w-0 text-[16px] sm:text-[15px] text-[#1c1f26] placeholder:text-[#a8b0bb] bg-transparent resize-none overflow-hidden focus:outline-none leading-[1.55] sm:leading-[1.68] min-h-[28px] max-h-44 py-0.5"
          />

          {/* Mic */}
          <button
            type="button"
            disabled={isStreaming}
            onClick={toggleMic}
            className={`w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              listening
                ? "bg-red-50 text-red-500 hover:bg-red-100"
                : "text-[#8a929d] hover:text-[var(--accent)] hover:bg-[var(--accent-8)]"
            }`}
            title={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Circular send / stop */}
          {isStreaming ? (
            <button
              id="btn-stop-stream"
              type="button"
              onClick={stopStreaming}
              className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
              title="Stop generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              id="btn-send-message"
              type="button"
              onClick={handleSend}
              disabled={!hasContent}
              className={`w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                hasContent ? "text-white cursor-pointer" : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
              style={hasContent ? { backgroundColor: 'var(--accent)' } : undefined}
              onMouseEnter={e => { if (hasContent) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-hover)'; }}
              onMouseLeave={e => { if (hasContent) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent)'; }}
              title="Send (Enter)"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
