import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import { GEMINI_MODELS } from "../data/models";

const DEFAULT_MODEL_ID = GEMINI_MODELS.find(m => m.isDefault)?.id ?? "gemini-3.5-flash";

interface TokenLabContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  selectedModel: string;
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
  isProfileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  userProfile: { id: string; text: string; addedAt: number }[];
  setUserProfile: (facts: { id: string; text: string; addedAt: number }[]) => void;
  userLocation: string;
  setUserLocation: (loc: string) => void;

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
  localStorageStats: { bytes: number; conversationCount: number; storageAvailable: boolean };
  clearLocalData: () => void;
}

const TokenLabContext = createContext<TokenLabContextType | null>(null);

const LS_KEY = "yuzee-token-lab-v1";

function lsLoad(): Conversation[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch { return []; }
}

function lsSave(convs: Conversation[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(convs));
  } catch (e: any) {
    if (e?.name === "QuotaExceededError") {
      // Drop oldest conversation and retry once
      const trimmed = convs.slice(0, Math.max(1, convs.length - 1));
      try { localStorage.setItem(LS_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
    }
  }
}

function lsBytes(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Blob([raw]).size : 0;
  } catch { return 0; }
}

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
  const [isProfileOpen, setProfileOpen] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<{ id: string; text: string; addedAt: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem("yuzee_user_profile") || "[]"); } catch { return []; }
  });
  const [userLocation, setUserLocation] = useState<string>(() =>
    localStorage.getItem("yuzee_user_location") || ""
  );

  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const pendingModel = useRef<string>(DEFAULT_MODEL_ID);

  // Load initial data — falls back to localStorage when server has no conversations (e.g. restart)
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
        // Sync latest versions to localStorage
        lsSave(convs);
        setCurrentConversation(convs[0]);
        const lastAssistant = convs[0].messages?.filter((m) => m.role === "assistant").pop();
        if (lastAssistant?.telemetry) setActiveTurnTelemetry(lastAssistant.telemetry);
      } else {
        // Server is empty — restore from localStorage (covers server restarts)
        const saved = lsLoad();
        if (saved.length > 0) {
          // Restore all conversations to server in parallel (non-blocking on failure)
          await Promise.allSettled(saved.map((c) => api.restoreConversation(c).catch(() => {})));
          setConversations(saved);
          setCurrentConversation(saved[0]);
          const lastAssistant = saved[0].messages?.filter((m) => m.role === "assistant").pop();
          if (lastAssistant?.telemetry) setActiveTurnTelemetry(lastAssistant.telemetry);
        } else {
          setConversations([]);
          setCurrentConversation(null);
          setActiveTurnTelemetry(null);
        }
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

  // Persist to localStorage on every conversation change (but not during initial load)
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    lsSave(conversations); // save even empty array so deleted conversations don't resurrect on refresh
  }, [conversations]);

  // Sync currentConversation (which has live telemetry) back to conversations when streaming ends.
  // Without this, the most-recent turn's telemetry never reaches localStorage/export/navigation.
  useEffect(() => {
    if (isStreaming || !currentConversation) return;
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === currentConversation.id);
      if (idx === -1 || prev[idx] === currentConversation) return prev;
      const next = [...prev];
      next[idx] = currentConversation;
      return next;
    });
  }, [isStreaming, currentConversation]);

  const localStorageStats = useMemo(() => {
    const bytes = lsBytes();
    const saved = lsLoad();
    return { bytes, conversationCount: saved.length, storageAvailable: typeof localStorage !== "undefined" };
  }, [conversations]); // recompute when conversations change

  const clearLocalData = useCallback(() => {
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }, []);

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
      if (found.model) { setSelectedModel(found.model); pendingModel.current = found.model; }
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
      currentConversation?.model || pendingModel.current,
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
    if (updates.model) { pendingModel.current = updates.model; setSelectedModel(updates.model); }
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
          recentTurnsToKeep: 100,
          contextBudget: 270000,
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
          recentTurnsToKeep: 100,
          contextBudget: 270000,
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
          recentTurnsToKeep: 100,
          contextBudget: 270000,
          responseMode: "standard",
        };
        break;
      case "BALANCED":
        updates = {
          preset,
          strategy: "ADAPTIVE_HYBRID",
          thinkingLevel: "adaptive",
          recentTurnsToKeep: 100,
          contextBudget: 270000,
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
    performance.mark('yuzee_send_clicked');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = "";

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayStr = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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
        userContext: { date: todayStr, timezone: tz, location: userLocation || undefined },
        userProfileFacts: userProfile.map(f => f.text),
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
          performance.mark('yuzee_first_structured');
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
            model: activeConv.model || DEFAULT_MODEL_ID,
            thinkingLevel: activeConv.thinkingLevel || "adaptive",
            optimizationMode: activeConv.mode || "AUTO",
            optimizationStrategy: activeConv.strategy || "ADAPTIVE_HYBRID",
            preset: activeConv.preset || "BALANCED",
            responseMode: activeConv.responseMode || "standard",
            recentTurnsCount: activeConv.recentTurnsToKeep || 100,
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
                // isStreaming stays true — onDone clears it so chip only shows when content is ready
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
          performance.mark('yuzee_response_complete');
          try {
            performance.measure('yuzee_e2e_latency', 'yuzee_send_clicked', 'yuzee_response_complete');
          } catch { /* marks may be cleared between calls */ }
          setIsStreaming(false);
          abortControllerRef.current = null;
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, isStreaming: false };
            }
            return { ...prev, messages: msgs };
          });
          // Auto-rename after first response if title is still generic
          const isFirstTurn = (activeConv.messages || []).filter((m: any) => m.role === "assistant").length === 0;
          if (isFirstTurn) {
            api.generateConversationTitle(activeConv.id).then((title) => {
              setCurrentConversation((prev) => prev && prev.id === activeConv.id ? { ...prev, title } : prev);
              setConversations((prev) => prev.map((c) => (c.id === activeConv.id ? { ...c, title } : c)));
            }).catch(() => {});
          }
          // Extract new user profile facts from this turn (fire-and-forget)
          if (textMessage && accumulatedContent) {
            api.extractProfileFacts(textMessage, accumulatedContent, userProfile.map(f => f.text))
              .then(({ facts }) => {
                if (facts.length > 0) {
                  setUserProfile(prev => {
                    const newFacts = facts.map((text: string, i: number) => ({
                      id: `fact-${Date.now()}-${i}`,
                      text,
                      addedAt: Date.now(),
                    }));
                    const updated = [...prev, ...newFacts];
                    try { localStorage.setItem("yuzee_user_profile", JSON.stringify(updated)); } catch {}
                    return updated;
                  });
                }
              })
              .catch(() => {});
          }
        },
        onProtocolValidationError: (data) => {
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...last,
                content: accumulatedContent || last.content,
                schemaValid: false,
                semanticValid: false,
                validationErrors: data.errors || [],
              };
            }
            return { ...prev, messages: msgs };
          });
        },
        onError: (err) => {
          console.error("Stream failed:", err);
          setIsStreaming(false);
          abortControllerRef.current = null;
          setCurrentConversation((prev) => {
            if (!prev) return prev;
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...last,
                content: accumulatedContent || "",
                error: err.message,
                errorCode: (err as any).errorCode,
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      // Clear the per-message streaming flag so the spinner doesn't stay stuck
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        const msgs = [...prev.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && last.isStreaming) {
          msgs[msgs.length - 1] = { ...last, isStreaming: false };
          return { ...prev, messages: msgs };
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

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
        selectedModel,
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
        isProfileOpen,
        setProfileOpen,
        userProfile,
        setUserProfile,
        userLocation,
        setUserLocation,
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
        localStorageStats,
        clearLocalData,
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
