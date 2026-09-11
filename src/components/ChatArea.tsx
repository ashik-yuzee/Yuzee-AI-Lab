import React, { useRef, useEffect } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { ChatMessage, UserEvent, YuzeeResponseV13 } from "../types";
import { RecommendedAction } from "../protocol/v1.3/Yuzee_Response_Protocol_v1.3";
import { Composer } from "./Composer";
import { ProtocolV13Renderer } from "./ProtocolV13Renderer";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GEMINI_MODELS, calcTurnCost, formatCost } from "../data/models";
import {
  Sparkles,
  Activity,
  Copy,
  Check,
  TrendingDown,
  Info,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Wifi,
  Cpu,
  Code2,
  Brain,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";

function modelShortName(modelId: string): string {
  const found = GEMINI_MODELS.find(m => m.id === modelId);
  return found ? found.name.replace('Gemini ', '') : modelId;
}

function modelChipStyle(modelId: string): string {
  if (modelId.includes('lite')) return 'bg-amber-50 border-amber-200 text-amber-800';
  if (modelId.includes('2.5') || modelId.includes('2.0')) return 'bg-slate-100 border-slate-200 text-slate-600';
  return 'bg-violet-50 border-violet-200 text-violet-700';
}

export const ChatArea: React.FC = () => {
  const {
    currentConversation,
    sendMessage,
    isStreaming,
    inspectTurnTelemetry,
    capabilities,
    setPendingClarificationQuestions,
    dailyCostWarning,
    dismissCostWarning,
    setWhiteboardOpen,
    setTokenInspectorOpen,
  } = useTokenLab();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [rawJsonIds, setRawJsonIds] = React.useState<Set<string>>(new Set());
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);

  const allMessages = currentConversation?.messages || [];
  const lastAssistant = [...allMessages].reverse().find(m => m.role === 'assistant' && !m.isStreaming);
  const lastStructured = lastAssistant?.structuredResponse as YuzeeResponseV13 | undefined;
  const suggestedActions = (!isStreaming && lastStructured?.interaction?.kind === 'none')
    ? (lastStructured.interaction.recommended_actions || [])
    : [];
  const hasSuggestions = suggestedActions.length > 0;
  const isLastAssistantMsg = (msgId: string) => lastAssistant?.id === msgId;

  const speakMessage = React.useCallback((id: string, text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speakingId === id) { synth.cancel(); setSpeakingId(null); return; }
    synth.cancel();
    const plain = text.replace(/[#*`_~[\]()>]/g, "").replace(/\n+/g, " ").trim();
    const utter = new SpeechSynthesisUtterance(plain.slice(0, 3000));
    const setVoice = () => {
      const v = synth.getVoices().find(v => v.name.includes("Google") && v.lang === "en-US")
             || synth.getVoices().find(v => !v.localService && v.lang.startsWith("en"))
             || synth.getVoices().find(v => v.lang.startsWith("en"));
      if (v) utter.voice = v;
      utter.rate = 0.93; utter.pitch = 1.05;
      utter.onstart = () => setSpeakingId(id);
      utter.onend = utter.onerror = () => setSpeakingId(null);
      synth.speak(utter);
    };
    synth.getVoices().length === 0
      ? synth.addEventListener("voiceschanged", setVoice, { once: true })
      : setVoice();
  }, [speakingId]);

  useEffect(() => { return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }; }, []);

  const starterPrompts = [
    { title: "Cybersecurity Pathway", prompt: "Build a realistic pathway from IT support into a junior cybersecurity analyst." },
    { title: "Degree vs Apprenticeship", prompt: "Compare university degree vs degree apprenticeship for software engineering." },
    { title: "Skill Gap Analysis", prompt: "What skills and certifications am I missing for a cloud security architect role?" },
    { title: "Career Switcher Plan", prompt: "Help me transition from digital marketing into product management with no coding background." },
    { title: "6-Month Study Plan", prompt: "Build a structured 6-month study plan for AWS Solutions Architect certification." },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages, isStreaming, hasSuggestions]);

  const lastCounsellorGateIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    const msgs = currentConversation?.messages || [];
    if (msgs.length === 0 || isStreaming) return;
    const last = msgs[msgs.length - 1];
    if (last.role !== "assistant" || last.isStreaming || !last.content) return;
    if (last.id === lastCounsellorGateIdRef.current) return;
    const trimmed = last.content.trim();
    if (!trimmed.startsWith("{")) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.question_controller?.ask_questions === true && Array.isArray(parsed.clarification_questions) && parsed.clarification_questions.length > 0) {
        lastCounsellorGateIdRef.current = last.id;
        setPendingClarificationQuestions({ questions: parsed.clarification_questions, bridgeMessage: parsed.frontend?.bridge_message });
      }
    } catch { /* not counsellor gate */ }
  }, [currentConversation?.messages, isStreaming, setPendingClarificationQuestions]);

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInteractionEvent = (event: UserEvent) => { sendMessage(event); };

  const parseStructuredResponse = (msg: ChatMessage): YuzeeResponseV13 | null => {
    if (msg.structuredResponse) return msg.structuredResponse;
    if (!msg.content) return null;
    const trimmed = msg.content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.schema_version === "1.3" && (parsed.content_blocks || parsed.blocks)) return parsed as YuzeeResponseV13;
      } catch { /* streaming */ }
    }
    return null;
  };

  const messages = currentConversation?.messages || [];

  const retryLastMessage = () => {
    const msgs = currentConversation?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") { sendMessage(msgs[i].content); break; }
    }
  };

  // Group flat messages into turns: { turnNum, userMsg?, assistantMsgs[] }
  type TurnGroup = { turnNum: number; userMsg?: ChatMessage; assistantMsgs: ChatMessage[] };
  const turnGroups = React.useMemo<TurnGroup[]>(() => {
    const groups: TurnGroup[] = [];
    let turnCount = 0;
    messages.forEach(msg => {
      if (msg.role === 'user') {
        turnCount++;
        groups.push({ turnNum: turnCount, userMsg: msg, assistantMsgs: [] });
      } else {
        if (groups.length > 0) {
          groups[groups.length - 1].assistantMsgs.push(msg);
        } else {
          groups.push({ turnNum: 0, assistantMsgs: [msg] });
        }
      }
    });
    return groups;
  }, [messages]);

  const errorDisplay = (errorCode?: string, errorMsg?: string, onRetry?: () => void) => {
    const configs: Record<string, { icon: React.ReactNode; title: string; detail: string; color: string }> = {
      RATE_LIMIT: { icon: <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />, title: "Rate limit reached", detail: errorMsg || "Gemini rate limit reached. Wait a moment and try again.", color: "bg-amber-50 border-amber-200 text-amber-900" },
      QUOTA_EXHAUSTED: { icon: <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />, title: "Daily quota reached", detail: errorMsg || "The free-tier Gemini quota for today has been used up.", color: "bg-red-50 border-red-200 text-red-900" },
      AUTH_ERROR: { icon: <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />, title: "API key error", detail: "The GEMINI_API_KEY is missing or invalid. Check your .env file and restart the server.", color: "bg-red-50 border-red-200 text-red-900" },
      FUNCTION_TIMEOUT: { icon: <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />, title: "Response timed out (free-tier limit)", detail: "Switch to Flash Lite for faster responses, or ask a shorter question.", color: "bg-amber-50 border-amber-200 text-amber-900" },
      PROVIDER_ERROR: { icon: <Wifi className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />, title: "Provider error", detail: errorMsg || "Gemini returned an error. Please try again.", color: "bg-slate-50 border-slate-200 text-slate-800" },
    };
    const cfg = configs[errorCode || 'PROVIDER_ERROR'] || configs['PROVIDER_ERROR'];
    return (
      <div className={`flex items-start gap-2.5 p-3 border rounded-lg text-sm ${cfg.color}`}>
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px]">{cfg.title}</p>
          <p className="text-xs mt-0.5 opacity-80">{cfg.detail}</p>
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry} disabled={isStreaming} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-current opacity-60 hover:opacity-100 disabled:opacity-30 text-xs font-semibold transition-opacity cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        )}
      </div>
    );
  };

  return (
    <div id="chat-viewport" className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden relative">
      {/* Cost warning banner */}
      {dailyCostWarning.level && (
        <div className={`flex items-center justify-between px-4 py-2 text-xs border-b ${
          dailyCostWarning.level === '$15+' ? 'bg-red-50 border-red-300 text-red-900' :
          dailyCostWarning.level === '$10'  ? 'bg-orange-50 border-orange-300 text-orange-900' :
          dailyCostWarning.level === '$5'   ? 'bg-amber-50 border-amber-300 text-amber-900' :
                                              'bg-yellow-50 border-yellow-300 text-yellow-900'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span><strong>Daily spend alert:</strong> {dailyCostWarning.totalCostUsd.toFixed(4)} USD{dailyCostWarning.level === '$15+' ? ' — over $15 threshold' : ` (crossed ${dailyCostWarning.level})`}.</span>
          </div>
          <button onClick={dismissCostWarning} className="ml-4 shrink-0 font-bold opacity-60 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* API key notice */}
      {capabilities && !capabilities.geminiApiKeyPresent && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span><strong>Preview mode.</strong> Configure <code>GEMINI_API_KEY</code> in Settings for live model execution.</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-5 py-5 sm:py-8">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="py-16 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-light)] text-[var(--accent)]">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-[22px] font-bold text-[#0d0d0d] tracking-tight">What are you planning next?</h1>
                  <p className="text-[15px] text-[#8a929d] max-w-md mx-auto leading-relaxed">
                    Test Oala career guidance with Protocol v1.3 JSON validation and context token optimization.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5 pt-2 text-left max-w-2xl mx-auto">
                  {starterPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(p.prompt)}
                      className="p-4 bg-white border border-[#e5e5e5] hover:border-[var(--accent-40)] rounded-xl text-left transition-all group cursor-pointer"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
                    >
                      <div className="font-semibold text-[13px] text-[#0d0d0d] mb-1.5 group-hover:text-[var(--accent)]">{p.title}</div>
                      <p className="text-[12px] text-[#8a929d] leading-relaxed line-clamp-2">{p.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation turns — timeline layout */
              <div className="relative">
                {/* Vertical timeline line — desktop only */}
                <div className="hidden sm:block absolute sm:left-[27px] top-0 bottom-0 w-px bg-[#e5e8ec] pointer-events-none" />

                <div className="space-y-8 sm:space-y-12">
                  {turnGroups.map((turn, tIdx) => (
                    <div key={turn.userMsg?.id || `t-${tIdx}`} className="grid gap-x-6 grid-cols-1 sm:[grid-template-columns:56px_1fr]">
                      {/* Left col — sticky turn number (desktop only) */}
                      <div className="hidden sm:flex sticky top-6 self-start justify-center pt-0.5">
                        <div className="w-9 h-9 rounded-full bg-white border border-[#e5e8ec] flex items-center justify-center text-[13px] font-bold text-[#6d7782] shadow-sm z-10 shrink-0">
                          {turn.turnNum || "·"}
                        </div>
                      </div>

                      {/* Right col — student + oala */}
                      <div className="min-w-0 space-y-4 sm:space-y-5">
                        {/* Student message */}
                        {turn.userMsg && (() => {
                          const msg = turn.userMsg!;
                          const userDisplayContent = msg.content?.startsWith("[QUESTION_ANSWERS:")
                            ? msg.content.replace(/^\[QUESTION_ANSWERS:.*?\]\n/, "")
                            : msg.content;
                          return (
                            <div id={`message-${msg.id}`}>
                              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6d7782] mb-2.5">Student</div>
                              <div
                                className="inline-block text-[16px] sm:text-[15px] leading-[1.6] max-w-full sm:max-w-[85%] whitespace-pre-wrap px-3.5 sm:px-4 py-3"
                                style={{ backgroundColor: 'var(--bubble-bg)', color: 'var(--bubble-text)', borderRadius: '18px 18px 6px 18px' }}
                              >
                                {userDisplayContent}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Assistant messages */}
                        {turn.assistantMsgs.map((msg, aIdx) => {
                          const structured = parseStructuredResponse(msg);
                          const isCounsellorGate = !structured && !msg.isStreaming && msg.content?.trim().startsWith("{") && (() => {
                            try { const p = JSON.parse(msg.content!.trim()); return p.question_controller?.ask_questions === true; } catch { return false; }
                          })();

                          return (
                            <div key={msg.id || `a-${aIdx}`} id={`message-${msg.id}`} className="space-y-3">
                              {/* Oala label */}
                              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#38596b] mb-2.5">Oala</div>

                              {/* Compaction banner */}
                              {msg.telemetry?.compactionMetrics && (
                                <div onClick={() => inspectTurnTelemetry(msg.telemetry)} className="flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium cursor-pointer hover:bg-emerald-100/70 transition-colors">
                                  <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Context compacted — older turns archived to preserve memory</span>
                                </div>
                              )}

                              {isCounsellorGate ? (
                                <div className="flex items-center gap-2 p-3 bg-[var(--accent-8)] border border-[var(--accent-border)] rounded-xl text-xs text-[var(--accent)]">
                                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                                  <span>Questions ready — see the popup above to answer them.</span>
                                </div>
                              ) : structured && rawJsonIds.has(msg.id) ? (
                                <pre className="text-[11px] leading-relaxed font-mono bg-[#1e1e1e] text-[#4ec9b0] p-4 rounded-xl overflow-x-auto whitespace-pre-wrap break-all">
                                  {msg.content}
                                </pre>
                              ) : structured ? (
                                <ProtocolV13Renderer
                                  data={structured}
                                  rawJson={msg.content}
                                  schemaValid={msg.schemaValid ?? true}
                                  semanticValid={msg.semanticValid ?? true}
                                  validationErrors={msg.validationErrors || []}
                                  onInteract={handleInteractionEvent}
                                  readOnly={msg.isStreaming}
                                  conversationId={currentConversation?.id}
                                  hideRecommendedActions={isLastAssistantMsg(msg.id)}
                                  onOpenPathway={isLastAssistantMsg(msg.id) ? () => { setWhiteboardOpen(true); setTokenInspectorOpen(false); } : undefined}
                                />
                              ) : (
                                !msg.error && (!msg.isStreaming || (msg.content && !msg.content.trimStart().startsWith("{"))) && (
                                  <div className="prose prose-slate max-w-none text-[16px] sm:text-[15px] leading-[1.7] sm:leading-[1.65] text-[#0d0d0d]
                                    prose-p:text-[16px] sm:prose-p:text-[15px] prose-p:leading-[1.7] sm:prose-p:leading-[1.65] prose-p:text-[#0d0d0d] prose-p:my-3
                                    prose-li:text-[16px] sm:prose-li:text-[15px] prose-li:text-[#0d0d0d]
                                    prose-strong:text-[#0d0d0d] prose-strong:font-semibold
                                    prose-headings:text-[#0d0d0d] prose-headings:font-bold
                                    prose-code:bg-[#f4f4f4] prose-code:text-[#c7254e] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px]
                                    prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-pre:rounded-xl prose-pre:p-4">
                                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content || "Generating guidance..."}</Markdown>
                                  </div>
                                )
                              )}

                              {msg.error && !msg.isStreaming && errorDisplay(msg.errorCode, msg.error, retryLastMessage)}

                              {/* Streaming shimmer */}
                              {msg.isStreaming && (
                                <div className="space-y-3">
                                  {!structured && (
                                    <div className="space-y-2.5 py-1">
                                      <div className="h-3 bg-[#f4f4f4] rounded-full w-4/5 animate-pulse" />
                                      <div className="h-3 bg-[#f4f4f4] rounded-full w-3/5 animate-pulse" />
                                      <div className="h-3 bg-[#f4f4f4] rounded-full w-11/12 animate-pulse" />
                                      <div className="h-3 bg-[#f4f4f4] rounded-full w-1/2 animate-pulse" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--accent-70)' }}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                                    <span>Generating response…</span>
                                  </div>
                                </div>
                              )}

                              {msg.telemetry?.usage?.finishReason === 'MAX_TOKENS' && !msg.isStreaming && (
                                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                  <span>Response was truncated at the output token limit. Try switching to Detail mode for longer responses.</span>
                                </div>
                              )}

                              {/* Telemetry footer */}
                              {msg.telemetry && !msg.isStreaming && (msg.structuredResponse || msg.content) && !msg.telemetry?.usage?.isMock && (
                                <div className="pt-2 border-t border-[#f0f0f0] flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-y-1.5 gap-x-2 text-[11px] text-slate-400">
                                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                    {msg.telemetry.model && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${modelChipStyle(msg.telemetry.model)}`}>
                                        <Cpu className="w-2.5 h-2.5" />
                                        {modelShortName(msg.telemetry.model)}
                                      </span>
                                    )}
                                    {msg.telemetry.appliedThinkingLevel && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-[var(--accent-8)] text-[var(--accent)] border-[var(--accent-border)]">
                                        <Brain className="w-2.5 h-2.5" />
                                        {msg.telemetry.appliedThinkingLevel}
                                      </span>
                                    )}
                                    {(() => {
                                      const ms = msg.telemetry.timeline?.totalLatencyMs ?? msg.telemetry.usage.latencyMs;
                                      return ms ? <span className="text-[10px] text-slate-400 font-mono">{(ms / 1000).toFixed(1)}s</span> : null;
                                    })()}
                                    <button
                                      onClick={() => inspectTurnTelemetry(msg.telemetry)}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#f4f4f4] hover:bg-[var(--accent-8)] text-slate-500 hover:text-[var(--accent)] border border-[#e5e5e5] hover:border-[var(--accent-30)] rounded font-mono text-[11px] transition-colors cursor-pointer min-w-0 max-w-full"
                                      title="Click for full breakdown"
                                    >
                                      <Activity className="w-3 h-3 shrink-0" />
                                      {/* Mobile: compact token summary */}
                                      <span className="sm:hidden truncate">
                                        {msg.telemetry.usage.totalTokens > 1000
                                          ? `${(msg.telemetry.usage.totalTokens / 1000).toFixed(1)}k`
                                          : msg.telemetry.usage.totalTokens} tok
                                        {(() => { const cost = calcTurnCost(msg.telemetry.model || "", msg.telemetry.usage); return cost !== null ? ` · ${formatCost(cost)}` : null; })()}
                                      </span>
                                      {/* Desktop: full breakdown */}
                                      <span className="hidden sm:inline">
                                        {msg.telemetry.usage.cachedTokens !== null && msg.telemetry.usage.cachedTokens > 0 ? (
                                          <>⚡ <strong>{msg.telemetry.usage.cachedTokens.toLocaleString()}</strong> cached · In <strong>{(msg.telemetry.usage.uncachedInputTokens ?? msg.telemetry.usage.inputTokens - msg.telemetry.usage.cachedTokens).toLocaleString()}</strong> new</>
                                        ) : (
                                          <>In <strong>{msg.telemetry.usage.inputTokens.toLocaleString()}</strong></>
                                        )}
                                        {" "}· Out <strong>{msg.telemetry.usage.outputTokens.toLocaleString()}</strong>
                                        {msg.telemetry.usage.thinkingTokens != null && msg.telemetry.usage.thinkingTokens > 0 && <> · Think <strong>{msg.telemetry.usage.thinkingTokens}</strong></>}
                                        {" "}· <strong>{msg.telemetry.usage.totalTokens.toLocaleString()}</strong>
                                        {(() => { const cost = calcTurnCost(msg.telemetry.model || "", msg.telemetry.usage); return cost !== null ? <> · <span className="text-emerald-600">{formatCost(cost)}</span></> : null; })()}
                                      </span>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1 self-end sm:self-auto">
                                    {msg.structuredResponse && (
                                      <button
                                        onClick={() => setRawJsonIds(prev => { const next = new Set(prev); next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id); return next; })}
                                        className={`p-1 rounded hover:bg-[#f4f4f4] ${rawJsonIds.has(msg.id) ? 'text-[var(--accent)]' : 'text-slate-400 hover:text-slate-600'}`}
                                        title={rawJsonIds.has(msg.id) ? "Show rendered output" : "Show raw JSON"}
                                      >
                                        <Code2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button onClick={() => speakMessage(msg.id, msg.content ?? "")} className={`p-1 rounded hover:bg-[#f4f4f4] ${speakingId === msg.id ? "text-[var(--accent)]" : "text-slate-400 hover:text-slate-600"}`} title={speakingId === msg.id ? "Stop speaking" : "Read aloud"}>
                                      {speakingId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => copyMessage(msg.id, msg.content ?? "")} className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-[#f4f4f4]" title="Copy">
                                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

      {/* Next-steps suggestions */}
      {hasSuggestions && (
        <div className="px-5 sm:px-4 pb-4">
          <div className="max-w-4xl mx-auto">
            <div
              className="rounded-2xl px-5 py-4"
              style={{
                background: 'linear-gradient(145deg, #f3eeff 0%, #ece4fc 100%)',
                border: '1px solid #d4b8f5',
                boxShadow: '0 2px 0 #fff inset, 0 6px 24px rgba(114,68,198,0.13)',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full" style={{ background: '#7244c6' }} />
                  <span className="w-1 h-1 rounded-full" style={{ background: '#a278e0' }} />
                  <span className="w-1 h-1 rounded-full" style={{ background: '#c8aaf0' }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#7244c6' }}>Continue with</span>
              </div>

              {/* Button tray — recessed inset */}
              <div
                className="rounded-xl px-3 py-3 flex flex-wrap gap-2"
                style={{
                  background: 'rgba(255,255,255,0.5)',
                  boxShadow: 'inset 0 1px 4px rgba(114,68,198,0.14), inset 0 0 0 1px rgba(114,68,198,0.08)',
                }}
              >
                {suggestedActions.map((act: RecommendedAction) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => sendMessage({ type: "action_clicked", action_id: act.id, value: act.message, userEvent: { interaction: { question_id: "recommended_action", selected_option_ids: [act.id], self_input: act.message } }, timestamp: Date.now() } as any)}
                    className="px-4 py-2 rounded-full text-[13px] font-semibold text-white cursor-pointer select-none"
                    style={{
                      backgroundColor: '#7244c6',
                      boxShadow: '0 1px 0 rgba(255,255,255,0.22) inset, 0 3px 10px rgba(114,68,198,0.4)',
                      transition: 'background-color 100ms, box-shadow 100ms, transform 80ms',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#5d33b0';
                      e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.22) inset, 0 5px 18px rgba(114,68,198,0.55)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#7244c6';
                      e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.22) inset, 0 3px 10px rgba(114,68,198,0.4)';
                    }}
                    onMouseDown={e => {
                      e.currentTarget.style.transform = 'translateY(1px) scale(0.97)';
                      e.currentTarget.style.boxShadow = '0 0 0 rgba(114,68,198,0) inset, 0 1px 4px rgba(114,68,198,0.3)';
                    }}
                    onMouseUp={e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.22) inset, 0 3px 10px rgba(114,68,198,0.4)';
                    }}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Composer />
    </div>
  );
};
