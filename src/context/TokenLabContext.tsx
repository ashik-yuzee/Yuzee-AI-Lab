import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  Conversation,
  ChatMessage,
  CapabilitiesResponse,
  SessionCumulativeStats,
  OptimizationMode,
  OptimizationStrategy,
  PresetMode,
  ResponseMode,
  ThinkingLevel,
  QualityFeedbackType,
  CareerContextCapsule,
  TokenUsageMetrics,
  ContextBreakdown,
  CompactionMetrics,
  UserEvent,
} from "../types";
import * as api from "../services/api";

interface TokenLabContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  capabilities: CapabilitiesResponse | null;
  sessionStats: SessionCumulativeStats | null;
  isLoading: boolean;
  isStreaming: boolean;
  activeTurnTelemetry: {
    usage: TokenUsageMetrics;
    contextMetrics: ContextBreakdown;
    compactionMetrics?: CompactionMetrics | null;
    lifecycleTrace?: any;
    timeline?: {
      aiRequestId?: string;
      requestReceivedAt?: number;
      preProviderLatencyMs?: number;
      conversationLoadMs?: number;
      userEventValidationMs?: number;
      memoryAssemblyMs?: number;
      requestAssemblyMs?: number;
      providerTtftMs?: number | null;
      providerGenMs?: number | null;
      validationDurationMs?: number;
      totalLatencyMs?: number;
    };
  } | null;
  
  // Modals & Panels
  isTokenInspectorOpen: boolean;
  setTokenInspectorOpen: (open: boolean) => void;
  isAdvancedLabOpen: boolean;
  setAdvancedLabOpen: (open: boolean) => void;
  activeLabTab: string;
  setActiveLabTab: (tab: string) => void;
  isContextInspectorOpen: boolean;
  setContextInspectorOpen: (open: boolean) => void;
  isCareerContextOpen: boolean;
  setCareerContextOpen: (open: boolean) => void;
  isMemoryTimelineOpen: boolean;
  setMemoryTimelineOpen: (open: boolean) => void;
  isBenchmarkOpen: boolean;
  setBenchmarkOpen: (open: boolean) => void;
  isAnalyticsOpen: boolean;
  setAnalyticsOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  isExportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Actions
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: (title?: string) => Promise<Conversation>;
  loadDemoConversation: () => Promise<Conversation>;
  removeConversation: (id: string) => Promise<void>;
  updateCurrentConversationSettings: (updates: Partial<Conversation>) => Promise<void>;
  applyOptimizationMode: (mode: OptimizationMode) => void;
  applyPreset: (preset: PresetMode) => void;
  sendMessage: (input: string | UserEvent) => Promise<void>;
  stopStreaming: () => void;
  submitFeedback: (messageId: string, type: QualityFeedbackType, comment?: string) => Promise<void>;
  resetMemory: () => Promise<void>;
  refreshStats: () => Promise<void>;
  resetSessionStats: () => Promise<void>;
  inspectTurnTelemetry: (telemetry: any) => void;
}

const TokenLabContext = createContext<TokenLabContextType | null>(null);

export const TokenLabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionCumulativeStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeTurnTelemetry, setActiveTurnTelemetry] = useState<any>(null);

  // Modals & Panels State
  const [isTokenInspectorOpen, setTokenInspectorOpen] = useState<boolean>(false);
  const [isAdvancedLabOpen, setAdvancedLabOpen] = useState<boolean>(false);
  const [activeLabTab, setActiveLabTab] = useState<string>("context");
  const [isContextInspectorOpen, setContextInspectorOpen] = useState<boolean>(false);
  const [isCareerContextOpen, setCareerContextOpen] = useState<boolean>(false);
  const [isMemoryTimelineOpen, setMemoryTimelineOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setBenchmarkOpen] = useState<boolean>(false);
  const [isAnalyticsOpen, setAnalyticsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setExportOpen] = useState<boolean>(false);
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [caps, convs, stats] = await Promise.all([
        api.fetchCapabilities().catch(() => null),
        api.fetchConversations().catch(() => []),
        api.fetchSessionStats().catch(() => null),
      ]);

      if (caps) setCapabilities(caps);
      if (stats) setSessionStats(stats);

      if (convs && convs.length > 0) {
        setConversations(convs);
        setCurrentConversation(convs[0]);
        // Set latest telemetry if exists
        const lastAssistant = convs[0].messages?.filter((m) => m.role === "assistant").pop();
        if (lastAssistant?.telemetry) {
          setActiveTurnTelemetry(lastAssistant.telemetry);
        }
      } else {
        // Zero conversations is a valid initial state (Section 79)
        setConversations([]);
        setCurrentConversation(null);
        setActiveTurnTelemetry(null);
      }
    } catch (e) {
      console.error("Initialization error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await api.fetchSessionStats();
      setSessionStats(stats);
    } catch (e) {
      console.error("Failed to refresh stats:", e);
    }
  }, []);

  const selectConversation = async (id: string) => {
    const found = conversations.find((c) => c.id === id);
    if (found) {
      setCurrentConversation(found);
      const lastAssistant = found.messages?.filter((m) => m.role === "assistant").pop();
      if (lastAssistant?.telemetry) {
        setActiveTurnTelemetry(lastAssistant.telemetry);
      } else {
        setActiveTurnTelemetry(null);
      }
    }
  };

  const startNewConversation = async (title?: string): Promise<Conversation> => {
    const newConv = await api.createConversation(
      title || "New Career Exploration",
      currentConversation?.model || "gemini-3.6-flash",
      "ADAPTIVE_HYBRID"
    );
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversation(newConv);
    setActiveTurnTelemetry(null);
    return newConv;
  };

  const loadDemoConversation = async (): Promise<Conversation> => {
    const demoConv = await api.loadDemoConversation();
    setConversations((prev) => [demoConv, ...prev.filter(c => c.id !== demoConv.id)]);
    setCurrentConversation(demoConv);
    const lastAssistant = demoConv.messages?.filter((m) => m.role === "assistant").pop();
    if (lastAssistant?.telemetry) {
      setActiveTurnTelemetry(lastAssistant.telemetry);
    }
    return demoConv;
  };

  const removeConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (currentConversation?.id === id) {
          if (remaining.length > 0) {
            setCurrentConversation(remaining[0]);
            const lastAssistant = remaining[0].messages?.filter((m) => m.role === "assistant").pop();
            setActiveTurnTelemetry(lastAssistant?.telemetry || null);
          } else {
            setCurrentConversation(null);
            setActiveTurnTelemetry(null);
          }
        }
        return remaining;
      });
    } catch (e) {
      console.error("Failed to delete conversation:", e);
    }
  };

  const updateCurrentConversationSettings = async (updates: Partial<Conversation>) => {
    if (!currentConversation) return;
    const updated = { ...currentConversation, ...updates, updatedAt: Date.now() };
    setCurrentConversation(updated);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    await api.updateConversation(updated.id, updates);
  };

  const applyOptimizationMode = (mode: OptimizationMode) => {
    if (!currentConversation) return;
    let updates: Partial<Conversation> = { mode };

    switch (mode) {
      case "AUTO":
        updates = {
          mode: "AUTO",
          strategy: "ADAPTIVE_HYBRID",
          thinkingLevel: "adaptive",
          recentTurnsToKeep: 4,
          contextBudget: 2000,
          responseMode: "standard",
        };
        break;
      case "SAVE_TOKENS":
        updates = {
          mode: "SAVE_TOKENS",
          strategy: "SUMMARY_RECENT",
          thinkingLevel: "low",
          recentTurnsToKeep: 2,
          contextBudget: 1000,
          responseMode: "quick",
        };
        break;
      case "FULL_CONTEXT":
        updates = {
          mode: "FULL_CONTEXT",
          strategy: "BASELINE",
          thinkingLevel: "medium",
          recentTurnsToKeep: 8,
          contextBudget: 6000,
          responseMode: "standard",
        };
        break;
      case "ADVANCED":
        updates = { mode: "ADVANCED" };
        break;
    }

    updateCurrentConversationSettings(updates);
  };

  const applyPreset = (preset: PresetMode) => {
    if (!currentConversation) return;
    let updates: Partial<Conversation> = { preset };

    switch (preset) {
      case "MAX_QUALITY":
        updates = {
          preset,
          strategy: "SLIDING_WINDOW",
          thinkingLevel: "medium",
          recentTurnsToKeep: 6,
          contextBudget: 4000,
          responseMode: "standard",
        };
        break;
      case "BALANCED":
        updates = {
          preset,
          strategy: "ADAPTIVE_HYBRID",
          thinkingLevel: "adaptive",
          recentTurnsToKeep: 4,
          contextBudget: 2000,
          responseMode: "standard",
        };
        break;
      case "MAX_SAVINGS":
        updates = {
          preset,
          strategy: "SUMMARY_RECENT",
          thinkingLevel: "low",
          recentTurnsToKeep: 2,
          contextBudget: 1000,
          responseMode: "quick",
        };
        break;
      case "ADVANCED":
        updates = { preset };
        break;
    }

    updateCurrentConversationSettings(updates);
  };

  const sendMessage = async (input: string | any) => {
    if (isStreaming) return;

    let textMessage = "";
    let userEventPayload: any = null;

    if (typeof input === "string") {
      textMessage = input.trim();
      if (!textMessage) return;
    } else if (input && typeof input === "object") {
      userEventPayload = input;
      // Synthesize a human readable chat bubble label from the interaction
      if (input.userEvent?.interaction) {
        const inter = input.userEvent.interaction;
        if (inter.self_input) {
          textMessage = inter.self_input;
        } else if (inter.selected_option_ids?.length) {
          textMessage = input.value || `Selected option: ${inter.selected_option_ids.join(", ")}`;
        } else if (inter.ranked_option_ids?.length) {
          textMessage = `Prioritized options: ${inter.ranked_option_ids.join(" > ")}`;
        } else if (inter.fields) {
          textMessage = `Submitted details: ${Object.entries(inter.fields).map(([k, v]) => `${k}: ${v}`).join(", ")}`;
        } else {
          textMessage = "Submitted response";
        }
      } else if (input.value) {
        textMessage = input.value;
      } else if (input.message) {
        textMessage = input.message;
      } else {
        textMessage = "Submitted interaction";
      }
    }

    let activeConv = currentConversation;
    if (!activeConv) {
      activeConv = await startNewConversation(textMessage ? textMessage.substring(0, 30) : "Career Exploration");
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textMessage,
      createdAt: Date.now(),
    };

    const streamingAssistantMsg: ChatMessage = {
      id: `asst-${Date.now()}`,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      isStreaming: true,
    };

    const updatedMessages = [...(activeConv.messages || []), userMsg, streamingAssistantMsg];
    const updatedConv = { ...activeConv, messages: updatedMessages };
    setCurrentConversation(updatedConv);
    setConversations((prev) => prev.map((c) => (c.id === updatedConv.id ? updatedConv : c)));

    setIsStreaming(true);
    const controller = new AbortController();
    setAbortController(controller);

    let accumulatedContent = "";

    api.streamChatMessage(
      activeConv.id,
      {
        message: textMessage,
        userEvent: userEventPayload,
        model: activeConv.model,
        strategy: activeConv.strategy,
        preset: activeConv.preset,
        responseMode: activeConv.responseMode,
        thinkingLevel: activeConv.thinkingLevel,
        contextBudget: activeConv.contextBudget,
        recentTurnsToKeep: activeConv.recentTurnsToKeep,
        careerContext: activeConv.careerContext,
        systemPromptMode: activeConv.systemPromptMode,
        customSystemPrompt: activeConv.customSystemPrompt,
      },
      {
        onDelta: (chunk) => {
          accumulatedContent += chunk;
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, content: accumulatedContent };
            }
            return { ...prev, messages: msgs };
          });
        },
        onStructured: (structData) => {
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              // Preserve schemaValid/semanticValid/validationErrors set by onValidation.
              // structData is the raw protocol response, not a validation envelope.
              msgs[msgs.length - 1] = {
                ...last,
                structuredResponse: structData.structuredResponse || structData,
              };
            }
            return { ...prev, messages: msgs };
          });
        },
        onValidation: (valData) => {
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...last,
                schemaValid: valData.schemaValid,
                semanticValid: valData.semanticValid,
                validationErrors: valData.validationErrors || [],
              };
            }
            return { ...prev, messages: msgs };
          });
        },
        onUsage: (usagePayload) => {
          const telemetry = {
            usage: usagePayload.usage,
            contextMetrics: usagePayload.contextMetrics,
            compactionMetrics: usagePayload.compactionMetrics,
            timeline: usagePayload.timeline,
            model: currentConversation?.model || "gemini-3.6-flash",
            thinkingLevel: currentConversation?.thinkingLevel || "adaptive",
            optimizationMode: currentConversation?.mode || "AUTO",
            optimizationStrategy: currentConversation?.strategy || "ADAPTIVE_HYBRID",
            preset: currentConversation?.preset || "BALANCED",
            responseMode: currentConversation?.responseMode || "standard",
            recentTurnsCount: currentConversation?.recentTurnsToKeep || 4,
            hasSummary: !!usagePayload.contextMetrics?.summaryTokens,
            timestamp: Date.now(),
          };

          setActiveTurnTelemetry(telemetry);

          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...last,
                telemetry,
                isStreaming: false,
              };
            }
            return { ...prev, messages: msgs };
          });

          refreshStats();
        },
        onCompaction: (compaction) => {
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              compactionHistory: [...(prev.compactionHistory || []), compaction],
            };
          });
        },
        onDone: () => {
          setIsStreaming(false);
          setAbortController(null);
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, isStreaming: false };
            }
            return { ...prev, messages: msgs };
          });
        },
        onError: (err) => {
          console.error("Stream failed:", err);
          setIsStreaming(false);
          setAbortController(null);
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...last,
                content: accumulatedContent || "Sorry, an error occurred while streaming response.",
                error: err.message,
                isStreaming: false,
              };
            }
            return { ...prev, messages: msgs };
          });
        },
      },
      controller.signal
    );
  };

  const stopStreaming = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsStreaming(false);
    }
  };

  const submitFeedback = async (messageId: string, type: QualityFeedbackType, comment?: string) => {
    if (!currentConversation) return;
    await api.sendFeedback(currentConversation.id, messageId, { type, comment });
    setCurrentConversation((prev) => {
      if (!prev) return prev;
      const msgs = prev.messages.map((m) =>
        m.id === messageId ? { ...m, feedback: { type, comment, timestamp: Date.now() } } : m
      );
      return { ...prev, messages: msgs };
    });
  };

  const resetMemory = async () => {
    if (!currentConversation) return;
    const res = await api.resetConversationMemory(currentConversation.id);
    setCurrentConversation(res);
    setConversations((prev) => prev.map((c) => (c.id === res.id ? res : c)));
  };

  const resetSessionStatsAction = async () => {
    await api.resetSessionStats();
    await refreshStats();
  };

  const inspectTurnTelemetry = (telemetry: any) => {
    setActiveTurnTelemetry(telemetry);
    setTokenInspectorOpen(true);
  };

  return (
    <TokenLabContext.Provider
      value={{
        conversations,
        currentConversation,
        capabilities,
        sessionStats,
        isLoading,
        isStreaming,
        activeTurnTelemetry,
        isTokenInspectorOpen,
        setTokenInspectorOpen,
        isAdvancedLabOpen,
        setAdvancedLabOpen,
        activeLabTab,
        setActiveLabTab,
        isContextInspectorOpen,
        setContextInspectorOpen,
        isCareerContextOpen,
        setCareerContextOpen,
        isMemoryTimelineOpen,
        setMemoryTimelineOpen,
        isBenchmarkOpen,
        setBenchmarkOpen,
        isAnalyticsOpen,
        setAnalyticsOpen,
        isSettingsOpen,
        setSettingsOpen,
        isExportOpen,
        setExportOpen,
        isSidebarOpen,
        setSidebarOpen,
        selectConversation,
        startNewConversation,
        loadDemoConversation,
        removeConversation,
        updateCurrentConversationSettings,
        applyOptimizationMode,
        applyPreset,
        sendMessage,
        stopStreaming,
        submitFeedback,
        resetMemory,
        refreshStats,
        resetSessionStats: resetSessionStatsAction,
        inspectTurnTelemetry,
      }}
    >
      {children}
    </TokenLabContext.Provider>
  );
};

export function useTokenLab() {
  const context = useContext(TokenLabContext);
  if (!context) {
    throw new Error("useTokenLab must be used within a TokenLabProvider");
  }
  return context;
}
