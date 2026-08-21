import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import { YuzeeRequestAssembler } from "./src/services/YuzeeRequestAssembler";
import {
  TokenBudgetMemoryManager,
  estimateTokens,
  getTokenCacheKey,
  getCachedTokenCount,
  setExactCachedTokenCount,
  setEstimatedCachedTokenCount,
} from "./src/services/TokenBudgetMemoryManager";
import {
  validateProtocolV13,
  validateUserEventAgainstActiveInteraction,
  TRUSTED_SERVICE_ACTIONS,
} from "./src/protocol/validator";
import { YuzeeResponseV13 } from "./src/protocol/v1.3/Yuzee_Response_Protocol_v1.3";
import { UserEvent } from "./src/types/UserEvent";
import { GEMINI_MODELS } from "./src/data/models";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Authoritative Request Assembler & Memory Manager
const requestAssembler = YuzeeRequestAssembler.getInstance();
const memoryManager = new TokenBudgetMemoryManager();

// Lazy-initialized Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// In-Memory Storage for Conversations & Telemetry
interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  structuredResponse?: YuzeeResponseV13;
  userEvent?: UserEvent;
  telemetry?: any;
  feedback?: any;
  createdAt: number;
}

interface ConversationItem {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  mode: string;
  strategy: string;
  preset: string;
  responseMode: string;
  thinkingLevel: string;
  contextBudget: number;
  recentTurnsToKeep: number;
  careerContext: {
    facts?: string;
    goals?: string;
    constraints?: string;
    decisions?: string;
    openThreads?: string;
    [key: string]: string | undefined;
  };
  summary: string;
  summaryVersion: number;
  systemPromptMode: string;
  customSystemPrompt?: string;
  useInteractionsApi?: boolean;
  useFlashLiteUtility?: boolean;
  activeInteraction?: any;
  messages: MessageItem[];
  compactionHistory: any[];
}

const conversations: Map<string, ConversationItem> = new Map();

// Session Cumulative Counters
const sessionStats = {
  userFacingChatCalls: 0,
  totalUserInputTokens: 0,
  totalModelInputTokens: 0,
  totalModelOutputTokens: 0,
  totalThinkingTokens: 0,
  totalCachedTokens: 0,
  totalUserFacingTokens: 0,

  compactionCalls: 0,
  compactionInputTokens: 0,
  compactionOutputTokens: 0,
  compactionTotalTokens: 0,

  baselineEstimatedTokens: 0,
};

async function countExactTokens(
  text: string,
  model: string = "gemini-3.6-flash"
): Promise<{ count: number; source: "provider" | "estimate" | "countTokens" }> {
  if (!text || text.trim().length === 0) return { count: 0, source: "estimate" };
  
  // Check pure cache
  const cached = getCachedTokenCount(model, text);
  if (cached) {
    return { count: cached.count, source: cached.source as any };
  }

  const ai = getGemini();
  if (ai) {
    try {
      const resp = await ai.models.countTokens({
        model,
        contents: text,
      });
      if (typeof resp.totalTokens === "number") {
        setExactCachedTokenCount(model, text, resp.totalTokens);
        return { count: resp.totalTokens, source: "countTokens" };
      }
    } catch {
      // Fallback to estimation on error
    }
  }

  const est = estimateTokens(text);
  setEstimatedCachedTokenCount(model, text, est);
  return { count: est, source: "estimate" };
}

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

// Protocol Information Endpoint (Authoritative Prompt & Schema Identity)
app.get("/api/protocol/info", (req, res) => {
  const info = requestAssembler.getProtocolInfo(!!process.env.GEMINI_API_KEY, 4);
  res.json(info);
});

// Capabilities Endpoint (Authoritative Model Registry Parity)
app.get("/api/config/capabilities", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    configured: hasKey,
    availableModels: GEMINI_MODELS.filter((m) => m.selectable).map((m) => m.id),
    modelsList: GEMINI_MODELS,
    defaultModel: "gemini-3.6-flash",
    supportsThinking: true,
    supportsCachedTokens: true,
    supportsInteractionsApi: true,
    supportsExplicitCache: false,
    geminiApiKeyPresent: hasKey,
    runtime: "preview-adapter",
  });
});

// List Conversations
app.get("/api/conversations", (req, res) => {
  const list = Array.from(conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  res.json(list);
});

// Create Clean Conversation
app.post("/api/conversations", (req, res) => {
  const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const title = req.body?.title || "New Career Exploration";
  const model = req.body?.model || "gemini-3.6-flash";
  const mode = req.body?.mode || "AUTO";
  const strategy = req.body?.strategy || "ADAPTIVE_HYBRID";
  const preset = req.body?.preset || "BALANCED";

  const conv: ConversationItem = {
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model,
    mode,
    strategy,
    preset,
    responseMode: req.body?.responseMode || "standard",
    thinkingLevel: req.body?.thinkingLevel || "adaptive",
    contextBudget: req.body?.contextBudget || 2000,
    recentTurnsToKeep: req.body?.recentTurnsToKeep || 4,
    careerContext: req.body?.careerContext || {
      facts: "",
      goals: "",
      constraints: "",
      decisions: "",
      openThreads: "",
    },
    summary: "",
    summaryVersion: 0,
    systemPromptMode: req.body?.systemPromptMode || "default",
    customSystemPrompt: req.body?.customSystemPrompt || "",
    useInteractionsApi: req.body?.useInteractionsApi || false,
    useFlashLiteUtility: req.body?.useFlashLiteUtility ?? true,
    messages: [],
    compactionHistory: [],
  };

  conversations.set(id, conv);
  res.json(conv);
});

// Load Demo Conversation Endpoint
app.post("/api/conversations/load-demo", (req, res) => {
  const demoId = `conv-demo-${Date.now()}`;
  const demoConv: ConversationItem = {
    id: demoId,
    title: "Cybersecurity Analyst Pathway (Demo)",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: "gemini-3.6-flash",
    mode: "AUTO",
    strategy: "ADAPTIVE_HYBRID",
    preset: "BALANCED",
    responseMode: "standard",
    thinkingLevel: "adaptive",
    contextBudget: 2000,
    recentTurnsToKeep: 4,
    careerContext: {
      facts: "2 years IT Support, CompTIA Network+ certified, hands-on Linux experience",
      goals: "Transition into Junior SOC Analyst / Tier 1 Security Analyst within 6-9 months",
      constraints: "Under $1,000 learning budget, 12 hrs/week study time",
      decisions: "Will pursue CompTIA Security+ first before CySA+",
      openThreads: "Evaluating TryHackMe SOC Level 1 vs BTL1 certification",
    },
    summary: "",
    summaryVersion: 1,
    systemPromptMode: "default",
    customSystemPrompt: "",
    useInteractionsApi: false,
    useFlashLiteUtility: true,
    activeInteraction: {
      kind: "question",
      input_type: "single_select",
      question_id: "q_priority_focus",
      question: "Which milestone would you like to plan out first?",
      options: [
        { id: "opt_siem", label: "SIEM & Practical Lab Setup", description: "Configuring free local lab environments", value: "siem_lab" },
        { id: "opt_cert", label: "Security+ Study Schedule", description: "Budget-friendly prep resources and exam tips", value: "sec_plus" },
        { id: "opt_portfolio", label: "Incident Walkthrough Portfolio", description: "Structuring public GitHub investigation reports", value: "portfolio" }
      ],
      allow_other_input: false,
      other_input_label: "",
      fields: [],
      recommended_actions: []
    },
    messages: [
      {
        id: `user-demo-1`,
        role: "user",
        content: "What are the essential skills and certifications I need to transition from IT support to a junior SOC analyst?",
        createdAt: Date.now() - 120000,
      },
      {
        id: `asst-demo-1`,
        role: "assistant",
        content: JSON.stringify({
          schema_version: "1.3",
          current_mode: "A_CONVERSATION",
          response_intent: "ACTION_PLAN",
          content_blocks: [
            {
              id: "b1",
              type: "text",
              level: "none",
              variant: "default",
              title: "",
              text: "Your 2 years in IT support and Network+ foundation give you an immediate advantage in packet analysis and system diagnostics. Here is your targeted transition plan.",
              items: [],
              columns: [],
              rows: [],
            },
            {
              id: "b2",
              type: "steps",
              level: "h2",
              variant: "info",
              title: "SOC Analyst Transition Blueprint",
              text: "Key milestones to reach Tier-1 SOC readiness within 6 months:",
              items: [
                { id: "s1", title: "Month 1-2: SIEM & Log Interpretation", text: "Master Splunk Free and Elastic Security log queries for Windows Event IDs and Linux auth logs.", value: "Foundational", status: "planned" },
                { id: "s2", title: "Month 3-4: Credential Milestone", text: "Prepare and clear CompTIA Security+ to pass automated HR filters.", value: "Certification", status: "planned" },
                { id: "s3", title: "Month 5-6: Hands-On Portfolio", text: "Complete TryHackMe SOC Level 1 exercises and write up 2 incident walkthroughs in GitHub.", value: "Proof", status: "planned" }
              ],
              columns: [],
              rows: [],
            }
          ],
          interaction: {
            kind: "question",
            input_type: "single_select",
            question_id: "q_priority_focus",
            question: "Which milestone would you like to plan out first?",
            options: [
              { id: "opt_siem", label: "SIEM & Practical Lab Setup", description: "Configuring free local lab environments", value: "siem_lab" },
              { id: "opt_cert", label: "Security+ Study Schedule", description: "Budget-friendly prep resources and exam tips", value: "sec_plus" },
              { id: "opt_portfolio", label: "Incident Walkthrough Portfolio", description: "Structuring public GitHub investigation reports", value: "portfolio" }
            ],
            allow_other_input: false,
            other_input_label: "",
            fields: [],
            recommended_actions: []
          },
          service: {
            flow: "NONE",
            intent_detected: false,
            goal_summary: "Junior SOC Analyst transition",
            trigger: "",
            confidence: "",
            selected_rmo: "",
            offer_target: "",
            missing_inputs: [],
            actions: []
          },
          state: {
            active_response_mode: "standard",
            effective_response_mode: "standard",
            mode_source: "default",
            safety_override_applied: false,
            user_confidence: {
              score: 65,
              band: "medium",
              evidence_strength: "moderate",
              trend: "stable",
              reason_codes: ["GOAL_CLEAR", "ROUTE_UNRESOLVED"]
            },
            progress: {
              explained: ["transition_overview"],
              failed_attempts: 0,
              loop_count_same_issue: 0
            }
          },
          followups: {
            enabled: true,
            cancel_on_user_message: true,
            topic_lock: true,
            topic_key: "soc_pathway",
            triggers: [
              {
                after_seconds: 10,
                message: "Would you like me to recommend free SIEM lab guides or Security+ study schedules?",
                suggested_replies: ["Show free SIEM guides", "Security+ study schedule", "Portfolio template"]
              }
            ]
          }
        }),
        createdAt: Date.now() - 60000,
      },
    ],
    compactionHistory: [],
  };

  conversations.set(demoId, demoConv);
  res.json(demoConv);
});

// Get Conversation
app.get("/api/conversations/:id", (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  res.json(conv);
});

// Update Conversation
app.put("/api/conversations/:id", (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  // Filter out any unauthorized browser-submitted server state
  const allowedUpdates = {
    title: req.body.title,
    model: req.body.model,
    mode: req.body.mode,
    strategy: req.body.strategy,
    preset: req.body.preset,
    responseMode: req.body.responseMode,
    thinkingLevel: req.body.thinkingLevel,
    contextBudget: req.body.contextBudget,
    recentTurnsToKeep: req.body.recentTurnsToKeep,
    careerContext: req.body.careerContext,
    systemPromptMode: req.body.systemPromptMode,
    customSystemPrompt: req.body.customSystemPrompt,
  };
  Object.assign(conv, allowedUpdates, { updatedAt: Date.now() });
  conversations.set(conv.id, conv);
  res.json(conv);
});

// Delete Conversation
app.delete("/api/conversations/:id", (req, res) => {
  const deleted = conversations.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  res.status(204).send();
});

// Feedback Endpoint
app.post("/api/conversations/:id/feedback", (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  const messageId = req.query.messageId as string;
  const msg = conv.messages.find((m) => m.id === messageId);
  if (msg) {
    msg.feedback = req.body;
  }
  res.json({ status: "ok" });
});

// Reset Memory Endpoint
app.post("/api/conversations/:id/reset-memory", (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  conv.summary = "";
  conv.summaryVersion = 0;
  conv.compactionHistory = [];
  conv.updatedAt = Date.now();
  res.json(conv);
});

// Service Action Execution Endpoint (Strict Registry Verification - No fake execution)
app.post("/api/conversations/:id/actions/:actionId/execute", (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const actionId = req.params.actionId;
  const trustedAction = TRUSTED_SERVICE_ACTIONS[actionId];

  if (!trustedAction) {
    return res.status(400).json({
      success: false,
      executed: false,
      error: `Action "${actionId}" is not registered in the trusted server action registry.`,
    });
  }

  // Token Lab explicit connectivity check
  if (!trustedAction.isConnectedInLab) {
    return res.json({
      success: false,
      executed: false,
      connected: false,
      actionId,
      title: trustedAction.title,
      message: `This action is not connected in Token Lab. (Reference validation only; no live external service called).`,
    });
  }

  res.json({
    success: true,
    executed: true,
    connected: true,
    actionId,
    title: trustedAction.title,
  });
});

// Pre-flight Token Count Endpoint
app.post("/api/tokens/count", async (req, res) => {
  const { message = "", conversationId, model = "gemini-3.6-flash", fastEstimate = false } = req.body;
  const trimmed = message.trim();

  if (!trimmed) {
    return res.json({
      userMessageTokens: 0,
      estimatedTotalInputTokens: 0,
      exactCount: true,
      breakdown: {
        systemInstructionTokens: 0,
        careerContextTokens: 0,
        summaryTokens: 0,
        recentTurnsTokens: 0,
        currentMessageTokens: 0,
        totalAssembledTokens: 0,
        removedTokens: 0,
        includedSections: [],
        excludedSections: [],
      },
      sources: {
        system: "countTokens",
        career: "estimate",
        summary: "estimate",
        history: "estimate",
        user: "countTokens",
      },
    });
  }

  const conv = conversationId ? conversations.get(conversationId) : null;
  const sysPrompt = conv?.systemPromptMode === "custom" && conv?.customSystemPrompt
    ? conv.customSystemPrompt
    : requestAssembler.getPromptContent();

  const careerStr = requestAssembler.formatCareerContext(conv?.careerContext || {});
  const historicalMessages = conv ? conv.messages : [];
  const mem = memoryManager.assembleMemory(
    historicalMessages,
    conv?.contextBudget || 2000,
    conv?.recentTurnsToKeep || 4,
    conv?.strategy || "ADAPTIVE_HYBRID",
    conv?.summary || ""
  );

  if (fastEstimate) {
    // Fast local estimation during typing (Zero unnecessary network requests)
    const userTokens = estimateTokens(trimmed);
    const sysTokens = estimateTokens(sysPrompt);
    const careerTokens = estimateTokens(careerStr);
    const sumTokens = estimateTokens(mem.summaryText);
    const recTokens = estimateTokens(mem.recentHistoryText);
    const total = sysTokens + careerTokens + sumTokens + recTokens + userTokens;

    return res.json({
      userMessageTokens: userTokens,
      estimatedTotalInputTokens: total,
      exactCount: false,
      sources: {
        system: "estimate",
        career: "estimate",
        summary: "estimate",
        history: "estimate",
        user: "estimate",
      },
      breakdown: {
        systemInstructionTokens: sysTokens,
        careerContextTokens: careerTokens,
        summaryTokens: sumTokens,
        recentTurnsTokens: recTokens,
        currentMessageTokens: userTokens,
        totalAssembledTokens: total,
        removedTokens: mem.removedTokens,
        includedSections: [
          { name: "Yuzee Main Prompt v0.12", description: "Authoritative counsellor instruction (systemInstruction)", tokens: sysTokens, preview: sysPrompt.slice(0, 75) },
          ...(careerTokens > 0 ? [{ name: "Structured Memory Capsule", description: "Verified user constraints & goals", tokens: careerTokens, preview: careerStr.slice(0, 75) }] : []),
          ...(sumTokens > 0 ? [{ name: "Conversation Summary", description: "Compact semantic memory", tokens: sumTokens, preview: mem.summaryText.slice(0, 75) }] : []),
          ...(recTokens > 0 ? [{ name: "Recent Dialogue Turns", description: "Verbatim recent exchanges", tokens: recTokens, preview: mem.recentHistoryText.slice(0, 75) }] : []),
          { name: "Current User Input", description: "Active incoming prompt", tokens: userTokens, preview: trimmed.slice(0, 75) },
        ],
        excludedSections: mem.excludedItems,
      },
    });
  }

  // Component-by-component token counting with cache lookup
  const [userRes, sysRes, careerRes, sumRes, recRes] = await Promise.all([
    countExactTokens(trimmed, model),
    countExactTokens(sysPrompt, model),
    careerStr ? countExactTokens(careerStr, model) : Promise.resolve({ count: 0, source: "estimate" as const }),
    mem.summaryText ? countExactTokens(mem.summaryText, model) : Promise.resolve({ count: 0, source: "estimate" as const }),
    mem.recentHistoryText ? countExactTokens(mem.recentHistoryText, model) : Promise.resolve({ count: 0, source: "estimate" as const }),
  ]);

  const total = sysRes.count + careerRes.count + sumRes.count + recRes.count + userRes.count;
  
  // Truthful whole-request exactness: ONLY true if every active component has source 'countTokens'
  const isAllExact =
    userRes.source === "countTokens" &&
    sysRes.source === "countTokens" &&
    (!careerStr || careerRes.source === "countTokens") &&
    (!mem.summaryText || sumRes.source === "countTokens") &&
    (!mem.recentHistoryText || recRes.source === "countTokens");

  const breakdown = {
    systemInstructionTokens: sysRes.count,
    careerContextTokens: careerRes.count,
    summaryTokens: sumRes.count,
    recentTurnsTokens: recRes.count,
    currentMessageTokens: userRes.count,
    totalAssembledTokens: total,
    removedTokens: mem.removedTokens,
    includedSections: [
      { name: "Yuzee Main Prompt v0.12", description: "Authoritative counsellor instruction (systemInstruction)", tokens: sysRes.count, preview: sysPrompt.slice(0, 75) },
      ...(careerRes.count > 0 ? [{ name: "Structured Memory Capsule", description: "Verified user constraints & goals", tokens: careerRes.count, preview: careerStr.slice(0, 75) }] : []),
      ...(sumRes.count > 0 ? [{ name: "Conversation Summary", description: "Compact semantic memory", tokens: sumRes.count, preview: mem.summaryText.slice(0, 75) }] : []),
      ...(recRes.count > 0 ? [{ name: "Recent Dialogue Turns", description: "Verbatim recent exchanges", tokens: recRes.count, preview: mem.recentHistoryText.slice(0, 75) }] : []),
      { name: "Current User Input", description: "Active incoming prompt", tokens: userRes.count, preview: trimmed.slice(0, 75) },
    ],
    excludedSections: mem.excludedItems,
  };

  res.json({
    userMessageTokens: userRes.count,
    estimatedTotalInputTokens: total,
    exactCount: isAllExact,
    sources: {
      system: sysRes.source,
      career: careerRes.source,
      summary: sumRes.source,
      history: recRes.source,
      user: userRes.source,
    },
    breakdown,
  });
});

// Session Cumulative Telemetry
app.get("/api/tokens/session-stats", (req, res) => {
  const trueTotal = sessionStats.totalUserFacingTokens + sessionStats.compactionTotalTokens;
  const saved = Math.max(0, sessionStats.baselineEstimatedTokens - trueTotal);
  const netSavingsPercent = sessionStats.baselineEstimatedTokens > 0
    ? Math.round((saved / sessionStats.baselineEstimatedTokens) * 1000) / 10
    : 0;
  const cacheHitRatio = sessionStats.totalModelInputTokens > 0
    ? Math.round((sessionStats.totalCachedTokens / sessionStats.totalModelInputTokens) * 1000) / 10
    : 0;
  const calls = sessionStats.userFacingChatCalls;

  res.json({
    ...sessionStats,
    trueTotalConsumption: trueTotal,
    tokensSaved: saved,
    netSavingsPercentage: netSavingsPercent,
    cacheHitRatio,
    averageTokensPerTurn: calls > 0 ? Math.round(sessionStats.totalUserFacingTokens / calls) : 0,
    averageOutputPerTurn: calls > 0 ? Math.round(sessionStats.totalModelOutputTokens / calls) : 0,
    averageThinkingPerTurn: calls > 0 ? Math.round(sessionStats.totalThinkingTokens / calls) : 0,
  });
});

app.post("/api/tokens/session-reset", (req, res) => {
  Object.keys(sessionStats).forEach((k) => ((sessionStats as any)[k] = 0));
  res.json({ status: "ok" });
});

// Benchmark Mode Endpoint (Modelled Estimate vs Live Gemini Benchmark)
app.post("/api/benchmark", async (req, res) => {
  const {
    conversationId,
    prompt = "Help me transition into cybersecurity and build a 6-month study roadmap.",
    model = "gemini-3.6-flash",
    strategies,
    isLive = false, // When true, executes real Gemini provider benchmark
  } = req.body;

  const conv = conversationId ? conversations.get(conversationId) : null;
  const stratsToTest = strategies || ["BASELINE", "SLIDING_WINDOW", "SUMMARY_RECENT", "ADAPTIVE_HYBRID"];
  const historicalMessages = conv ? conv.messages : [];

  const results = [];

  for (const strat of stratsToTest) {
    const mem = memoryManager.assembleMemory(
      historicalMessages,
      strat === "BASELINE" ? 8000 : (strat === "SLIDING_WINDOW" ? 2000 : 1500),
      strat === "BASELINE" ? 10 : (strat === "SLIDING_WINDOW" ? 4 : 2),
      strat,
      conv?.summary || ""
    );

    const assembledReq = requestAssembler.assembleRequest({
      model,
      messageText: prompt,
      careerContext: conv?.careerContext || {
        goals: "Transition into Junior SOC Analyst",
        constraints: "Under $1000, 12 hrs/week",
      },
      summaryText: mem.summaryText,
      recentHistoryText: mem.recentHistoryText,
      responseMode: "standard",
      thinkingLevel: "adaptive",
    });

    if (isLive && getGemini()) {
      // Live Gemini Benchmark Mode (Real provider request)
      const ai = getGemini()!;
      const startTime = Date.now();
      let firstChunkTime: number | null = null;
      let fullText = "";
      let usageMeta: any = null;
      let isValid = false;

      try {
        const stream = await ai.models.generateContentStream({
          model: assembledReq.model,
          contents: assembledReq.contents,
          config: assembledReq.geminiConfig,
        });

        for await (const chunk of stream) {
          if (!firstChunkTime) firstChunkTime = Date.now();
          const t = chunk.text;
          if (t) fullText += t;
          if (chunk.usageMetadata) usageMeta = chunk.usageMetadata;
        }

        const validation = validateProtocolV13(JSON.parse(fullText));
        isValid = validation.protocolAccepted;
      } catch {
        isValid = false;
      }

      const totalTime = Date.now() - startTime;
      const ttft = firstChunkTime ? firstChunkTime - startTime : null;
      const genTime = firstChunkTime ? Date.now() - firstChunkTime : null;

      const inputTokens = usageMeta?.promptTokenCount ?? estimateTokens(assembledReq.contents) + estimateTokens(assembledReq.systemInstruction);
      const outputTokens = usageMeta?.candidatesTokenCount ?? estimateTokens(fullText);
      const thinkingTokens = usageMeta?.thinkingTokenCount ?? null;
      const cachedTokens = usageMeta?.cachedContentTokenCount ?? null;

      results.push({
        strategy: strat,
        label: `${strat} (Live Gemini Benchmark)`,
        model,
        mode: "live",
        inputTokens,
        outputTokens,
        thinkingTokens,
        cachedTokens,
        totalTokens: usageMeta?.totalTokenCount ?? (inputTokens + outputTokens + (thinkingTokens || 0)),
        latencyMs: totalTime,
        ttftMs: ttft,
        generationMs: genTime,
        compactionCost: mem.compactionMetrics ? mem.compactionMetrics.compactionTotalCost : 0,
        responsePreview: fullText.slice(0, 120),
        retainedContextTokens: assembledReq.dynamicContextTokenCount,
        schemaValid: isValid,
        sources: {
          inputTokens: usageMeta ? "provider" : "estimate",
          outputTokens: usageMeta ? "provider" : "estimate",
          thinkingTokens: usageMeta?.thinkingTokenCount !== undefined ? "provider" : "unavailable",
          cachedTokens: usageMeta?.cachedContentTokenCount !== undefined ? "provider" : "unavailable",
        },
        notes: `Real Gemini measurement with responseJsonSchema enforcement. Protocol accepted: ${isValid}`,
      });
    } else {
      // Modelled Estimate Mode (Clearly labeled Estimated)
      const userTokens = estimateTokens(prompt);
      const sysTokens = estimateTokens(assembledReq.systemInstruction);
      const dynTokens = assembledReq.dynamicContextTokenCount;
      const totalInput = sysTokens + dynTokens + userTokens;
      const estimatedOutput = 240;

      results.push({
        strategy: strat,
        label: `${strat} (Modelled Estimate)`,
        model,
        mode: "estimated",
        inputTokens: totalInput,
        outputTokens: estimatedOutput,
        thinkingTokens: null,
        cachedTokens: null,
        totalTokens: totalInput + estimatedOutput,
        latencyMs: 700 + Math.round(dynTokens * 0.15),
        ttftMs: null,
        generationMs: null,
        compactionCost: mem.compactionMetrics ? mem.compactionMetrics.compactionTotalCost : 0,
        responsePreview: "Modelled structured response adhering to Response Protocol v1.3 envelope.",
        retainedContextTokens: dynTokens,
        schemaValid: true,
        sources: {
          inputTokens: "estimate",
          outputTokens: "estimate",
          thinkingTokens: "unavailable",
          cachedTokens: "unavailable",
        },
        notes: "Modelled estimate (0 provider calls). Select 'Live Gemini' in benchmark controls to execute live API measurements.",
      });
    }
  }

  res.json({ results });
});

// -------------------------------------------------------------
// Streaming Chat API (SSE) with Real Schema Enforcement & Validation
// -------------------------------------------------------------
app.post("/api/conversations/:id/messages", async (req, res) => {
  // START REQUEST LATENCY CLOCK AT LINE 1 (covers conversation lookup, validation, memory assembly)
  const requestReceivedAt = Date.now();
  const id = req.params.id;

  const conversationLoadStart = Date.now();
  let conv = conversations.get(id);

  if (!conv) {
    const newConv: ConversationItem = {
      id,
      title: "Career Exploration",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: req.body.model || "gemini-3.6-flash",
      mode: req.body.mode || "AUTO",
      strategy: req.body.strategy || "ADAPTIVE_HYBRID",
      preset: req.body.preset || "BALANCED",
      responseMode: req.body.responseMode || "standard",
      thinkingLevel: req.body.thinkingLevel || "adaptive",
      contextBudget: req.body.contextBudget || 2000,
      recentTurnsToKeep: req.body.recentTurnsToKeep || 4,
      careerContext: req.body.careerContext || {
        facts: "",
        goals: "",
        constraints: "",
        decisions: "",
        openThreads: "",
      },
      summary: "",
      summaryVersion: 0,
      systemPromptMode: req.body.systemPromptMode || "default",
      customSystemPrompt: req.body.customSystemPrompt || "",
      useInteractionsApi: req.body.useInteractionsApi || false,
      useFlashLiteUtility: req.body.useFlashLiteUtility ?? true,
      messages: [],
      compactionHistory: [],
    };
    conversations.set(id, newConv);
    conv = newConv;
  }
  const conversationLoadMs = Date.now() - conversationLoadStart;

  const userMessageContent = req.body.message || "";
  const userEvent: UserEvent | undefined = req.body.userEvent;
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const userPromptTokens = estimateTokens(userMessageContent);

  // SERVER-SIDE VALIDATION OF USEREVENT AGAINST TRUSTED ACTIVE INTERACTION
  const userEventValidationStart = Date.now();
  const eventValidation = validateUserEventAgainstActiveInteraction(userEvent, conv.activeInteraction);
  const userEventValidationMs = Date.now() - userEventValidationStart;

  if (!eventValidation.valid) {
    return res.status(400).json({
      error: "Invalid user event against active server interaction",
      details: eventValidation.errors,
    });
  }

  // Strategy & Memory Budget Resolution
  let strategy = req.body.strategy || conv.strategy;
  let budget = req.body.contextBudget || conv.contextBudget;
  let recentTurns = req.body.recentTurnsToKeep || conv.recentTurnsToKeep;
  const mode = req.body.mode || conv.mode || "AUTO";

  if (mode === "SAVE_TOKENS") {
    strategy = "SUMMARY_RECENT";
    budget = 1000;
    recentTurns = 2;
  } else if (mode === "FULL_CONTEXT") {
    strategy = "BASELINE";
    budget = 8000;
    recentTurns = 10;
  }

  // 1. ASSEMBLE MEMORY ON MESSAGES BEFORE CURRENT TURN
  const memoryAssemblyStart = Date.now();
  const historicalMessages = conv.messages;
  const mem = memoryManager.assembleMemory(historicalMessages, budget, recentTurns, strategy, conv.summary);
  const memoryAssemblyMs = Date.now() - memoryAssemblyStart;

  if (mem.compactionMetrics) {
    conv.compactionHistory.push(mem.compactionMetrics);
    if (!mem.compactionMetrics.isSimulated) {
      sessionStats.compactionCalls++;
      sessionStats.compactionInputTokens += mem.compactionMetrics.compactionInputTokens;
      sessionStats.compactionOutputTokens += mem.compactionMetrics.compactionOutputTokens;
      sessionStats.compactionTotalTokens += mem.compactionMetrics.compactionTotalCost;
    }
  }

  // 2. ASSEMBLE GEMINI REQUEST (IMMUTABLE PROMPT IN SYSTEM INSTRUCTION ONLY)
  const requestAssemblyStart = Date.now();
  const modelId = req.body.model || conv.model || "gemini-3.6-flash";
  const assembledReq = requestAssembler.assembleRequest({
    model: modelId,
    messageText: userMessageContent,
    userEvent,
    careerContext: req.body.careerContext || conv.careerContext,
    summaryText: mem.summaryText,
    recentHistoryText: mem.recentHistoryText,
    responseMode: req.body.responseMode || conv.responseMode,
    thinkingLevel: req.body.thinkingLevel || conv.thinkingLevel,
    customSystemPrompt: req.body.customSystemPrompt || conv.customSystemPrompt,
    systemPromptMode: req.body.systemPromptMode || conv.systemPromptMode,
  });
  const requestAssemblyMs = Date.now() - requestAssemblyStart;

  // Setup SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function sendEvent(type: string, data: any) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  sendEvent("start", {
    conversationId: conv.id,
    messageId,
    aiRequestId: assembledReq.aiRequestId,
    appliedThinkingLevel: assembledReq.appliedThinkingLevel,
    numericThinkingBudget: assembledReq.numericThinkingBudget,
    maxOutputTokens: assembledReq.maxOutputTokens,
    requestReceivedAt,
  });

  if (mem.compactionMetrics) {
    sendEvent("compaction", mem.compactionMetrics);
  }

  const providerStartTime = Date.now();
  let firstProviderChunkTime: number | null = null;
  let providerEndTime: number | null = null;
  let fullAssistantText = "";
  let realUsageMetadata: any = null;
  let isMockResponse = false;

  try {
    const ai = getGemini();

    if (ai) {
      // Real Gemini API Invocation with Provider-Enforced Response Schema
      const stream = await ai.models.generateContentStream({
        model: assembledReq.model,
        contents: assembledReq.contents,
        config: assembledReq.geminiConfig,
      });

      for await (const chunk of stream) {
        if (!firstProviderChunkTime) {
          firstProviderChunkTime = Date.now();
          // Emit TTFT status without exposing raw unparsed JSON
          sendEvent("status", {
            state: "generating",
            ttftMs: firstProviderChunkTime - providerStartTime,
          });
        }
        const text = chunk.text;
        if (text) {
          fullAssistantText += text;
          // IMPORTANT: DO NOT emit raw JSON fragments over the delta channel for protocol mode
        }
        if (chunk.usageMetadata) {
          realUsageMetadata = chunk.usageMetadata;
        }
      }
      providerEndTime = Date.now();
    } else {
      // Fallback offline mock mode (Clearly marked as simulated)
      isMockResponse = true;
      const guidanceJson = generateOfflineProtocolV13(userMessageContent, conv.careerContext);
      fullAssistantText = JSON.stringify(guidanceJson, null, 2);
      await new Promise((r) => setTimeout(r, 250)); // Simulating provider TTFT
      firstProviderChunkTime = Date.now();
      sendEvent("status", {
        state: "generating",
        ttftMs: firstProviderChunkTime - providerStartTime,
      });
      await new Promise((r) => setTimeout(r, 350)); // Simulating generation duration
      providerEndTime = Date.now();
    }
  } catch (err: any) {
    console.error("Gemini invocation error:", err);
    sendEvent("error", { error: err?.message || "Failed to generate AI response" });
    res.end();
    return;
  }

  // 3. SERVER-SIDE 3-LAYER VALIDATION
  const validationStartTime = Date.now();
  let parsedResponse: any = null;
  let isJsonValid = false;

  try {
    parsedResponse = JSON.parse(fullAssistantText);
    isJsonValid = true;
  } catch {
    isJsonValid = false;
  }

  const validationResult = isJsonValid
    ? validateProtocolV13(parsedResponse)
    : {
        jsonParsed: false,
        schemaValid: false,
        semanticValid: false,
        protocolAccepted: false,
        schemaErrors: ["Failed to parse model output as JSON"],
        semanticErrors: [],
        errors: ["Failed to parse model output as JSON"],
        warnings: [],
      };

  const validationEndTime = Date.now();
  const validationDurationMs = validationEndTime - validationStartTime;

  // STRICT PROTOCOL ACCEPTANCE BOUNDARY:
  // Only if protocolAccepted === true may the server update activeInteraction and emit protocol_response
  if (validationResult.protocolAccepted) {
    if (parsedResponse?.interaction && parsedResponse.interaction.kind !== "none") {
      conv.activeInteraction = parsedResponse.interaction;
    } else if (parsedResponse?.interaction && parsedResponse.interaction.kind === "none") {
      conv.activeInteraction = null;
    }

    sendEvent("validation", {
      schemaValid: validationResult.schemaValid,
      semanticValid: validationResult.semanticValid,
      protocolAccepted: true,
      errors: [],
      warnings: validationResult.warnings,
      promptHash: requestAssembler.getPromptHash(),
      schemaHash: requestAssembler.getSchemaHash(),
    });

    sendEvent("protocol_response", parsedResponse);
    sendEvent("structured", parsedResponse);
  } else {
    // DO NOT update active interaction or trusted state on invalid output
    sendEvent("protocol_validation_error", {
      schemaValid: validationResult.schemaValid,
      semanticValid: validationResult.semanticValid,
      protocolAccepted: false,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      aiRequestId: assembledReq.aiRequestId,
    });
  }

  // 4. PRECISE TIMELINE & TOKEN TELEMETRY COMPUTATION
  const providerTtftMs = firstProviderChunkTime ? firstProviderChunkTime - providerStartTime : null;
  const providerGenMs = (firstProviderChunkTime && providerEndTime) ? providerEndTime - firstProviderChunkTime : null;
  const preProviderLatencyMs = providerStartTime - requestReceivedAt;
  const totalLatencyMs = Date.now() - requestReceivedAt;

  const timeline = {
    aiRequestId: assembledReq.aiRequestId,
    requestReceivedAt,
    preProviderLatencyMs,
    conversationLoadMs,
    userEventValidationMs,
    memoryAssemblyMs,
    requestAssemblyMs,
    providerRequestStartedAt: providerStartTime,
    providerTtftMs,
    providerGenerationDurationMs: providerGenMs,
    providerCompletedAt: providerEndTime || Date.now(),
    validationDurationMs,
    validationCompletedAt: validationEndTime,
    totalLatencyMs,
  };

  const hasProviderUsage = !isMockResponse && !!realUsageMetadata;
  const inputTokens = realUsageMetadata?.promptTokenCount ?? (estimateTokens(assembledReq.systemInstruction) + estimateTokens(assembledReq.contents));
  const outputTokens = realUsageMetadata?.candidatesTokenCount ?? estimateTokens(fullAssistantText);
  const thinkingTokens = realUsageMetadata?.thinkingTokenCount ?? (realUsageMetadata?.thoughtsTokenCount ?? null);
  const cachedTokens = realUsageMetadata?.cachedContentTokenCount ?? null;
  const totalTokens = realUsageMetadata?.totalTokenCount ?? (inputTokens + outputTokens + (thinkingTokens || 0));

  const usageMetrics = {
    currentUserTokens: userPromptTokens,
    inputTokens,
    outputTokens,
    thinkingTokens,
    cachedTokens,
    toolTokens: null,
    totalTokens,
    uncachedInputTokens: cachedTokens !== null ? Math.max(0, inputTokens - cachedTokens) : inputTokens,
    cacheHitPercentage: cachedTokens !== null && inputTokens > 0 ? Math.round((cachedTokens / inputTokens) * 1000) / 10 : null,
    latencyMs: totalLatencyMs,
    isMock: isMockResponse,
    sources: {
      inputTokens: isMockResponse ? "simulated" : (hasProviderUsage ? "provider" : "estimate"),
      outputTokens: isMockResponse ? "simulated" : (hasProviderUsage ? "provider" : "estimate"),
      thinkingTokens: isMockResponse ? "simulated" : (thinkingTokens !== null ? "provider" : "unavailable"),
      cachedTokens: isMockResponse ? "simulated" : (cachedTokens !== null ? "provider" : "unavailable"),
      currentUserTokens: "estimate",
    },
    timeline,
    requestTrace: {
      aiRequestId: assembledReq.aiRequestId,
      promptHash: requestAssembler.getPromptHash(),
      systemTokenCount: estimateTokens(assembledReq.systemInstruction),
      dynamicContextTokenCount: assembledReq.dynamicContextTokenCount,
      currentMessageTokenCount: userPromptTokens,
      historicalTurnsCount: mem.recentTurnsCount,
      schemaVersion: "1.3",
      providerModel: assembledReq.model,
      appliedThinkingLevel: assembledReq.appliedThinkingLevel,
      numericThinkingBudget: assembledReq.numericThinkingBudget,
      maxOutputTokens: assembledReq.maxOutputTokens,
    },
  };

  const contextBreakdown = {
    systemInstructionTokens: estimateTokens(assembledReq.systemInstruction),
    careerContextTokens: estimateTokens(assembledReq.careerContext ? JSON.stringify(assembledReq.careerContext) : ""),
    summaryTokens: estimateTokens(mem.summaryText),
    recentTurnsTokens: estimateTokens(mem.recentHistoryText),
    currentMessageTokens: userPromptTokens,
    totalAssembledTokens: inputTokens,
    removedTokens: mem.removedTokens,
    includedSections: [
      { name: "Yuzee Main Prompt v0.12", description: "Authoritative counsellor instruction (systemInstruction)", tokens: estimateTokens(assembledReq.systemInstruction), preview: assembledReq.systemInstruction.slice(0, 75) },
      ...(mem.summaryText ? [{ name: "Conversation Summary", description: "Compact semantic memory", tokens: estimateTokens(mem.summaryText), preview: mem.summaryText.slice(0, 75) }] : []),
      ...(mem.recentHistoryText ? [{ name: "Recent Dialogue Turns", description: "Verbatim recent exchanges", tokens: estimateTokens(mem.recentHistoryText), preview: mem.recentHistoryText.slice(0, 75) }] : []),
      { name: "Current User Input", description: "Active incoming prompt / UserEvent", tokens: userPromptTokens, preview: userMessageContent.slice(0, 75) },
    ],
    excludedSections: mem.excludedItems,
  };

  // Cumulative accounting (Exclude mock calls from real totals)
  if (!isMockResponse) {
    sessionStats.userFacingChatCalls++;
    sessionStats.totalUserInputTokens += userPromptTokens;
    sessionStats.totalModelInputTokens += inputTokens;
    sessionStats.totalModelOutputTokens += outputTokens;
    if (thinkingTokens) sessionStats.totalThinkingTokens += thinkingTokens;
    if (cachedTokens) sessionStats.totalCachedTokens += cachedTokens;
    sessionStats.totalUserFacingTokens += totalTokens;

    const baselineEst = inputTokens + conv.messages.length * 120;
    sessionStats.baselineEstimatedTokens += baselineEst;
  }

  // 5. ATTACH COMPLETED TURN TO CONVERSATION RECORD
  const userMsg: MessageItem = {
    id: `user-${Date.now()}`,
    role: "user",
    content: userMessageContent,
    userEvent,
    createdAt: requestReceivedAt,
  };
  conv.messages.push(userMsg);

  const assistantMsg: MessageItem = {
    id: messageId,
    role: "assistant",
    content: fullAssistantText,
    structuredResponse: validationResult.protocolAccepted ? parsedResponse : undefined,
    telemetry: {
      usage: usageMetrics,
      contextMetrics: contextBreakdown,
      compactionMetrics: mem.compactionMetrics,
      timeline,
      model: assembledReq.model,
      appliedThinkingLevel: assembledReq.appliedThinkingLevel,
      validation: validationResult,
      timestamp: Date.now(),
    },
    createdAt: Date.now(),
  };
  conv.messages.push(assistantMsg);
  conv.updatedAt = Date.now();

  sendEvent("usage", {
    usage: usageMetrics,
    contextMetrics: contextBreakdown,
    compactionMetrics: mem.compactionMetrics,
    timeline,
  });

  sendEvent("done", { aiRequestId: assembledReq.aiRequestId });
  res.end();
});

function generateOfflineProtocolV13(prompt: string, career: Record<string, string | undefined>): YuzeeResponseV13 {
  const role = career?.["Target Role"] || career?.["goals"] || "Cybersecurity Analyst";
  return {
    schema_version: "1.3",
    current_mode: "A_CONVERSATION",
    response_intent: "ACTION_PLAN",
    content_blocks: [
      {
        id: "b1",
        type: "text",
        level: "none",
        variant: "default",
        title: "",
        text: `Here is a structured, actionable pathway plan for your transition towards **${role}**.`,
        items: [],
        columns: [],
        rows: [],
      },
      {
        id: "b2",
        type: "steps",
        level: "h2",
        variant: "info",
        title: "Recommended Milestones",
        text: "Core progression steps designed to build demonstrable competence:",
        items: [
          { id: "s1", title: "Foundational Networking & Systems Core", text: "Master TCP/IP subnetting, Linux command-line diagnostics, and Wireshark packet capture.", value: "Phase 1", status: "planned" },
          { id: "s2", title: "Defensive Operations & SIEM Telemetry", text: "Setup a virtual home lab with Splunk or Elastic Security and analyze attack alerts.", value: "Phase 2", status: "planned" },
          { id: "s3", title: "Industry Certification & GitHub Portfolio", text: "Complete Security+ certification and document 2 end-to-end incident walkthroughs.", value: "Phase 3", status: "planned" },
        ],
        columns: [],
        rows: [],
      },
    ],
    interaction: {
      kind: "question",
      input_type: "single_select",
      question_id: "q_next_step",
      question: "Which milestone would you like to explore first?",
      options: [
        { id: "opt_networking", label: "Networking & Linux Foundations", description: "Free labs and command cheat-sheets", value: "networking" },
        { id: "opt_siem", label: "SIEM & Practical Detection", description: "Configuring Splunk Free & alert analysis", value: "siem" },
        { id: "opt_portfolio", label: "Incident Walkthrough Portfolio", description: "Structuring verifiable GitHub case studies", value: "portfolio" },
      ],
      allow_other_input: false,
      other_input_label: "",
      fields: [],
      recommended_actions: [],
    },
    service: {
      flow: "NONE",
      intent_detected: false,
      goal_summary: `Career pathway towards ${role}`,
      trigger: "",
      confidence: "",
      selected_rmo: "",
      offer_target: "",
      missing_inputs: [],
      actions: [],
    },
    state: {
      active_response_mode: "standard",
      effective_response_mode: "standard",
      mode_source: "default",
      safety_override_applied: false,
      user_confidence: {
        score: -1,
        band: "unknown",
        evidence_strength: "none",
        trend: "unknown",
        reason_codes: ["NEW_TOPIC_RESET"],
      },
      progress: {
        explained: ["pathway_overview"],
        failed_attempts: 0,
        loop_count_same_issue: 0,
      },
    },
    followups: {
      enabled: true,
      cancel_on_user_message: true,
      topic_lock: true,
      topic_key: "offline_pathway",
      triggers: [
        {
          after_seconds: 10,
          message: "Would you like me to tailor this timeline based on your current weekly study hours?",
          suggested_replies: ["Tailor for 10 hrs/week", "Tailor for 20 hrs/week", "Show cert resources"],
        },
      ],
    },
  };
}

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Yuzee AI Token Lab running on port ${PORT}`);
  });
}

startServer();
