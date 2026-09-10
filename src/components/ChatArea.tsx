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
  return 'bg-blue-50 border-blue-200 text-blue-700';
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

  // Derive suggestions from last non-streaming assistant message
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

  // Trigger clarification modal when last non-streaming assistant message is a counsellor gate.
  // Track the last processed message ID so switching conversations doesn't re-trigger old gates.
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

  const handleInteractionEvent = (event: UserEvent) => {
    sendMessage(event);
  };

  const parseStructuredResponse = (msg: ChatMessage): YuzeeResponseV13 | null => {
    if (msg.structuredResponse) return msg.structuredResponse;
    if (!msg.content) return null;
    const trimmed = msg.content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.schema_version === "1.3" && (parsed.content_blocks || parsed.blocks)) {
          return parsed as YuzeeResponseV13;
        }
      } catch {
        // Not valid JSON yet (e.g. while streaming)
      }
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

  const errorDisplay = (errorCode?: string, errorMsg?: string, onRetry?: () => void) => {
    const configs: Record<string, { icon: React.ReactNode; title: string; detail: string; color: string }> = {
      RATE_LIMIT: {
        icon: <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />,
        title: "Rate limit reached",
        detail: errorMsg || "Gemini rate limit reached. Wait a moment and try again.",
        color: "bg-amber-50 border-amber-200 text-amber-900",
      },
      QUOTA_EXHAUSTED: {
        icon: <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,
        title: "Daily quota reached",
        detail: errorMsg || "The free-tier Gemini quota for today has been used up. The lab will resume when the quota resets at midnight Pacific time.",
        color: "bg-red-50 border-red-200 text-red-900",
      },
      AUTH_ERROR: {
        icon: <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,
        title: "API key error",
        detail: "The GEMINI_API_KEY is missing or invalid. Check your .env file and restart the server.",
        color: "bg-red-50 border-red-200 text-red-900",
      },
      FUNCTION_TIMEOUT: {
        icon: <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />,
        title: "Response timed out (free-tier limit)",
        detail: "The free deployment limit is 10 seconds per request. Switch to Flash Lite for faster responses, or ask a shorter question.",
        color: "bg-amber-50 border-amber-200 text-amber-900",
      },
      PROVIDER_ERROR: {
        icon: <Wifi className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />,
        title: "Provider error",
        detail: errorMsg || "Gemini returned an error. Please try again.",
        color: "bg-slate-50 border-slate-200 text-slate-800",
      },
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
          <button
            type="button"
            onClick={onRetry}
            disabled={isStreaming}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-current opacity-60 hover:opacity-100 disabled:opacity-30 text-xs font-semibold transition-opacity cursor-pointer"
            title="Retry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  };

  return (
    <div id="chat-viewport" className="flex-1 flex flex-col h-full bg-[#f7f8fa] overflow-hidden relative">
      {/* Daily cost threshold warning banner */}
      {dailyCostWarning.level && (
        <div className={`flex items-center justify-between px-4 py-2 text-xs border-b ${
          dailyCostWarning.level === '$15+' ? 'bg-red-50 border-red-300 text-red-900' :
          dailyCostWarning.level === '$10'  ? 'bg-orange-50 border-orange-300 text-orange-900' :
          dailyCostWarning.level === '$5'   ? 'bg-amber-50 border-amber-300 text-amber-900' :
                                              'bg-yellow-50 border-yellow-300 text-yellow-900'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>Daily spend alert:</strong> today's Gemini cost has reached{' '}
              <strong>${dailyCostWarning.totalCostUsd.toFixed(4)}</strong>
              {dailyCostWarning.level === '$15+' ? ' — over $15 threshold' : ` (crossed ${dailyCostWarning.level} mark)`}.
              {dailyCostWarning.level === '$15+' && ' This warning appears on every turn above $15.'}
            </span>
          </div>
          <button onClick={dismissCostWarning} className="ml-4 shrink-0 font-bold opacity-60 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* Notice if API Key not set */}
      {capabilities && !capabilities.geminiApiKeyPresent && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Gemini connection running in preview guidance mode.</strong> Configure <code>GEMINI_API_KEY</code> in Settings for live model execution.
            </span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 space-y-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.length === 0 ? (
            /* Empty State */
            <div id="empty-state-card" className="py-8 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-[#e6e9ee] text-[#2f6fed] shadow-sm mb-2">
                <Sparkles className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h1 className="text-[22px] font-bold text-[#1c1f26] tracking-tight">
                  What are you planning next?
                </h1>
                <p className="text-[16px] text-[#5b6472] max-w-lg mx-auto leading-[1.65]">
                  Test Oala career guidance with Protocol v1.3 JSON validation and context token optimization.
                </p>
              </div>

              {/* Starter Prompts */}
              <div className="grid sm:grid-cols-2 gap-2.5 pt-4 text-left max-w-2xl mx-auto">
                {starterPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    id={`starter-prompt-${idx}`}
                    onClick={() => sendMessage(p.prompt)}
                    className="p-4 bg-white border border-[#e6e9ee] hover:border-[#2f6fed]/40 rounded-xl text-left transition-all group cursor-pointer"
                    style={{ boxShadow: "0 1px 2px rgba(16,24,40,.03), 0 4px 14px rgba(16,24,40,.04)" }}
                  >
                    <div className="font-semibold text-[13px] text-[#1c1f26] mb-1.5 group-hover:text-[#2f6fed]">
                      {p.title}
                    </div>
                    <p className="text-[12px] text-[#8a929d] leading-relaxed line-clamp-2">{p.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Message List */
            messages.map((msg, index) => {
              const structured = msg.role === "assistant" ? parseStructuredResponse(msg) : null;
              // Counsellor gate messages are handled by ClarificationQuestionsModal — skip inline rendering
              const isCounsellorGate = msg.role === "assistant" && !structured && !msg.isStreaming && msg.content?.trim().startsWith("{") && (() => { try { const p = JSON.parse(msg.content!.trim()); return p.question_controller?.ask_questions === true; } catch { return false; } })();

              // User message: hide the structured question answers prefix from display
              const userDisplayContent = msg.role === "user" && msg.content?.startsWith("[QUESTION_ANSWERS:")
                ? msg.content.replace(/^\[QUESTION_ANSWERS:.*?\]\n/, "")
                : msg.content;

              return (
                <div key={msg.id || index} id={`message-${msg.id || index}`} className="space-y-2">
                  {/* Message Bubble */}
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={
                        msg.role === "user"
                          ? "max-w-2xl ml-auto bg-[#2f6fed] text-white border border-[#2f6fed] rounded-2xl rounded-br-sm px-4 py-3 text-[16px] font-normal leading-[1.68]"
                          : "max-w-3xl bg-white text-[#2c333d] border border-[#e6e9ee] rounded-2xl rounded-bl-sm px-5 py-4 text-[16px] leading-[1.68]"
                      }
                      style={{ boxShadow: "0 1px 2px rgba(16,24,40,.03), 0 4px 14px rgba(16,24,40,.04)" }}
                    >
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap">{userDisplayContent}</div>
                      ) : (
                        <div className="space-y-3">
                          {/* Compaction Event Banner if triggered before this turn */}
                          {msg.telemetry?.compactionMetrics && (
                            <div
                              onClick={() => inspectTurnTelemetry(msg.telemetry)}
                              className="flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium cursor-pointer hover:bg-emerald-100/70 transition-colors"
                              title="Click to view memory timeline"
                            >
                              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Context compacted — older turns archived to preserve memory</span>
                            </div>
                          )}

                          {/* Counsellor gate JSON: shown as a subtle pending indicator; modal handles interaction */}
                          {isCounsellorGate ? (
                            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                              <span>Questions ready — see the popup above to answer them.</span>
                            </div>
                          ) : structured && rawJsonIds.has(msg.id) ? (
                            <pre className="text-[11px] leading-relaxed font-mono bg-slate-900 text-emerald-300 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
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
                              <div className="prose prose-slate max-w-none prose-p:text-[16px] prose-p:leading-[1.7] prose-p:text-[#2c333d] prose-p:my-2 prose-li:text-[16px] prose-li:text-[#2c333d] prose-strong:text-[#1c1f26] prose-headings:text-[#1c1f26] prose-headings:font-bold">
                                <Markdown remarkPlugins={[remarkGfm]}>{msg.content || "Generating guidance..."}</Markdown>
                              </div>
                            )
                          )}

                          {/* Error Banner */}
                          {msg.error && !msg.isStreaming && errorDisplay(msg.errorCode, msg.error, retryLastMessage)}

                          {/* Streaming Indicator */}
                          {msg.isStreaming && (
                            <div className="flex items-center gap-2 text-[13px] text-[#2f6fed] font-medium pt-1">
                              <span className="w-2 h-2 rounded-full bg-[#2f6fed] animate-pulse" />
                              <span>Generating & validating Protocol v1.3 response...</span>
                            </div>
                          )}

                          {/* MAX_TOKENS truncation warning */}
                          {msg.telemetry?.usage?.finishReason === 'MAX_TOKENS' && !msg.isStreaming && (
                            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>Response was truncated at the output token limit. Try switching to Detail mode for longer responses.</span>
                            </div>
                          )}

                          {/* Unobtrusive Turn Token Indicator */}
                          {msg.telemetry && !msg.isStreaming && (msg.structuredResponse || msg.content) && !msg.telemetry?.usage?.isMock && (
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                              {/* Left: model chip + latency + token pill */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Model chip */}
                                {msg.telemetry.model && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${modelChipStyle(msg.telemetry.model)}`}>
                                    <Cpu className="w-2.5 h-2.5" />
                                    {modelShortName(msg.telemetry.model)}
                                  </span>
                                )}
                                {/* Thinking level chip */}
                                {msg.telemetry.appliedThinkingLevel && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                                    <Brain className="w-2.5 h-2.5" />
                                    {msg.telemetry.appliedThinkingLevel}
                                  </span>
                                )}
                                {/* Latency */}
                                {(() => {
                                  const ms = msg.telemetry.timeline?.totalLatencyMs ?? msg.telemetry.usage.latencyMs;
                                  return ms ? (
                                    <span className="text-[10px] text-slate-400 font-mono">{(ms / 1000).toFixed(1)}s</span>
                                  ) : null;
                                })()}
                                {/* Token Indicator Pill */}
                                <button
                                  onClick={() => inspectTurnTelemetry(msg.telemetry)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#2f6fed] border border-slate-200 hover:border-[#2f6fed]/30 rounded-md font-mono text-[11px] transition-colors cursor-pointer"
                                  title="Click for full breakdown: User vs Input, Thinking, Cached, and Compaction"
                                >
                                  <Activity className="w-3 h-3 text-[#2f6fed]" />
                                  <span>
                                    {msg.telemetry.usage.cachedTokens !== null && msg.telemetry.usage.cachedTokens > 0 ? (
                                      <>
                                        ⚡ <strong>{msg.telemetry.usage.cachedTokens.toLocaleString()}</strong> cached
                                        {" "}· In <strong>{(msg.telemetry.usage.uncachedInputTokens ?? msg.telemetry.usage.inputTokens - msg.telemetry.usage.cachedTokens).toLocaleString()}</strong> new
                                      </>
                                    ) : (
                                      <>In <strong>{msg.telemetry.usage.inputTokens.toLocaleString()}</strong></>
                                    )}
                                    {" "}· Out <strong>{msg.telemetry.usage.outputTokens.toLocaleString()}</strong>
                                    {msg.telemetry.usage.thinkingTokens != null && msg.telemetry.usage.thinkingTokens > 0 && (
                                      <> · Think <strong>{msg.telemetry.usage.thinkingTokens}</strong></>
                                    )}
                                    {" "}· Total <strong>{msg.telemetry.usage.totalTokens.toLocaleString()}</strong>
                                    {(() => {
                                      const cost = calcTurnCost(msg.telemetry.model || "", msg.telemetry.usage);
                                      return cost !== null ? <> · <span className="text-emerald-700">{formatCost(cost)}</span></> : null;
                                    })()}
                                  </span>
                                </button>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                {msg.structuredResponse && (
                                  <button
                                    onClick={() => setRawJsonIds(prev => {
                                      const next = new Set(prev);
                                      next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
                                      return next;
                                    })}
                                    className={`p-1 rounded hover:bg-slate-100 ${rawJsonIds.has(msg.id) ? 'text-[#2f6fed]' : 'text-slate-400 hover:text-slate-700'}`}
                                    title={rawJsonIds.has(msg.id) ? "Show rendered output" : "Show raw JSON"}
                                    aria-label="Toggle raw JSON"
                                  >
                                    <Code2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => speakMessage(msg.id, msg.content ?? "")}
                                  className={`p-1 rounded hover:bg-slate-100 ${speakingId === msg.id ? "text-violet-500" : "text-slate-400 hover:text-slate-700"}`}
                                  title={speakingId === msg.id ? "Stop speaking" : "Read aloud"}
                                  aria-label="Read aloud"
                                >
                                  {speakingId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => copyMessage(msg.id, msg.content ?? "")}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                  title="Copy Response"
                                  aria-label="Copy Response"
                                >
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Next steps floating popup — visually attached to the composer, not the messages */}
      {hasSuggestions && (
        <div className="px-3 sm:px-4 pb-2">
          <div className="bg-white border border-[#e6e9ee] rounded-xl px-3 py-2.5 flex items-center gap-2 flex-wrap" style={{ boxShadow: "0 1px 2px rgba(16,24,40,.03), 0 4px 14px rgba(16,24,40,.04)" }}>
            <span className="text-[10px] font-bold text-[#8a929d] uppercase tracking-widest shrink-0">Next steps</span>
            {suggestedActions.map((act: RecommendedAction) => (
              <button
                key={act.id}
                type="button"
                onClick={() => sendMessage({
                  type: "action_clicked",
                  action_id: act.id,
                  value: act.message,
                  userEvent: { interaction: { question_id: "recommended_action", selected_option_ids: [act.id], self_input: act.message } },
                  timestamp: Date.now(),
                } as any)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-[#2f6fed]/5 hover:text-[#2f6fed] border border-[#e6e9ee] hover:border-[#2f6fed]/30 text-[#5b6472] rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Composer */}
      <Composer />
    </div>
  );
};
