import React, { useRef, useEffect } from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { ChatMessage, UserEvent, YuzeeResponseV13 } from "../types";
import { Composer } from "./Composer";
import { ProtocolV13Renderer } from "./ProtocolV13Renderer";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GEMINI_MODELS } from "../data/models";
import {
  Sparkles,
  Activity,
  Copy,
  Check,
  ArrowRight,
  TrendingDown,
  Info,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Wifi,
  Cpu,
} from "lucide-react";

function modelShortName(modelId: string): string {
  const found = GEMINI_MODELS.find(m => m.id === modelId);
  return found ? found.name.replace('Gemini ', '') : modelId;
}

function modelChipStyle(modelId: string): string {
  if (modelId.includes('lite')) return 'bg-amber-50 border-amber-200 text-amber-800';
  if (modelId.includes('2.5') || modelId.includes('2.0')) return 'bg-slate-100 border-slate-200 text-slate-600';
  return 'bg-sky-50 border-sky-200 text-sky-800';
}

export const ChatArea: React.FC = () => {
  const {
    currentConversation,
    sendMessage,
    isStreaming,
    inspectTurnTelemetry,
    capabilities,
  } = useTokenLab();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const starterPrompts = [
    { title: "Cybersecurity Pathway", prompt: "Build a realistic pathway from IT support into a junior cybersecurity analyst." },
    { title: "Degree vs Apprenticeship", prompt: "Compare university degree vs degree apprenticeship for software engineering." },
    { title: "Skill Gap Analysis", prompt: "What skills and certifications am I missing for a cloud security architect role?" },
    { title: "Career Switcher Plan", prompt: "Help me transition from digital marketing into product management with no coding background." },
    { title: "6-Month Study Plan", prompt: "Build a structured 6-month study plan for AWS Solutions Architect certification." },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages, isStreaming]);

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const errorDisplay = (errorCode?: string, errorMsg?: string) => {
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
        <div>
          <p className="font-semibold text-[13px]">{cfg.title}</p>
          <p className="text-xs mt-0.5 opacity-80">{cfg.detail}</p>
        </div>
      </div>
    );
  };

  return (
    <div id="chat-viewport" className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden relative">
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
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            /* Empty State */
            <div id="empty-state-card" className="py-8 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-100 border border-sky-200 text-sky-700 shadow-xs mb-2">
                <Sparkles className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  What are you planning next?
                </h1>
                <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                  Test Yuzee career guidance with Protocol v1.3 JSON validation and context token optimization.
                </p>
              </div>

              {/* Starter Prompts */}
              <div className="grid sm:grid-cols-2 gap-2.5 pt-4 text-left max-w-xl mx-auto">
                {starterPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    id={`starter-prompt-${idx}`}
                    onClick={() => sendMessage(p.prompt)}
                    className="p-3 bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 rounded-xl text-left transition-all shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between font-medium text-xs text-slate-900 mb-1 group-hover:text-sky-700">
                      <span>{p.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-sky-600 transition-opacity" />
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">{p.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Message List */
            messages.map((msg, index) => {
              const structured = msg.role === "assistant" ? parseStructuredResponse(msg) : null;

              return (
                <div key={msg.id || index} id={`message-${msg.id || index}`} className="space-y-2">
                  {/* Message Bubble */}
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-2xl w-full sm:w-auto rounded-2xl p-4 text-sm leading-relaxed transition-all shadow-2xs ${
                        msg.role === "user"
                          ? "bg-sky-600 text-white rounded-br-xs font-normal"
                          : "bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
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

                          {/* Protocol v1.3 Structured Renderer or Markdown Fallback */}
                          {structured ? (
                            <ProtocolV13Renderer
                              data={structured}
                              rawJson={msg.content}
                              schemaValid={msg.schemaValid ?? true}
                              semanticValid={msg.semanticValid ?? true}
                              validationErrors={msg.validationErrors || []}
                              onInteract={handleInteractionEvent}
                              readOnly={msg.isStreaming}
                              conversationId={currentConversation?.id}
                            />
                          ) : (
                            !msg.error && !msg.isStreaming && (
                              <div className="prose prose-slate prose-sm max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-800 prose-li:text-slate-800">
                                <Markdown remarkPlugins={[remarkGfm]}>{msg.content || "Generating guidance..."}</Markdown>
                              </div>
                            )
                          )}

                          {/* Error Banner */}
                          {msg.error && !msg.isStreaming && errorDisplay(msg.errorCode, msg.error)}

                          {/* Streaming Indicator */}
                          {msg.isStreaming && (
                            <div className="flex items-center gap-2 text-xs text-sky-600 font-medium pt-1">
                              <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
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
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 hover:border-sky-300 rounded-md font-mono text-[11px] transition-colors cursor-pointer"
                                  title="Click for full breakdown: User vs Input, Thinking, Cached, and Compaction"
                                >
                                  <Activity className="w-3 h-3 text-sky-600" />
                                  <span>
                                    In <strong>{msg.telemetry.usage.inputTokens.toLocaleString()}</strong> · Out{" "}
                                    <strong>{msg.telemetry.usage.outputTokens.toLocaleString()}</strong>
                                    {msg.telemetry.usage.thinkingTokens !== null && (
                                      <> · Think <strong>{msg.telemetry.usage.thinkingTokens}</strong></>
                                    )}
                                    {msg.telemetry.usage.cachedTokens !== null && msg.telemetry.usage.cachedTokens > 0 && (
                                      <> · Cache <strong>{msg.telemetry.usage.cachedTokens.toLocaleString()}</strong></>
                                    )}
                                    {" "}· Total <strong>{msg.telemetry.usage.totalTokens.toLocaleString()}</strong>
                                  </span>
                                </button>
                              </div>

                              {/* Actions */}
                              <button
                                onClick={() => copyMessage(msg.id, msg.content)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                title="Copy Response"
                                aria-label="Copy Response"
                              >
                                {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
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

      {/* Chat Composer */}
      <Composer />
    </div>
  );
};
