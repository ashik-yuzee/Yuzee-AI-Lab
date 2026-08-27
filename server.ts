import express from "express";
import path from "path";
import crypto from "crypto";
// vite is only needed for local dev — dynamic import keeps it out of the Vercel bundle
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import { YuzeeRequestAssembler } from "./src/services/YuzeeRequestAssembler";
import {
  TokenBudgetMemoryManager,
  estimateTokens,
  groupIntoTurns,
  getTokenCacheKey,
  getCachedTokenCount,
  setExactCachedTokenCount,
  setEstimatedCachedTokenCount,
  DialogueTurn,
} from "./src/services/TokenBudgetMemoryManager";
import { SystemPromptCacheManager } from "./src/services/SystemPromptCacheManager";
import {
  validateProtocolV13,
  validateUserEventAgainstActiveInteraction,
  TRUSTED_SERVICE_ACTIONS,
} from "./src/protocol/validator";
import { YuzeeResponseV13 } from "./src/protocol/v1.3/Yuzee_Response_Protocol_v1.3";
import { UserEvent } from "./src/types/UserEvent";
import { GEMINI_MODELS, calcTurnCost } from "./src/data/models";
import { initDb, logTurn, pruneExpired, isDbEnabled, saveConversation, saveMessage, deleteConversation, loadConversations } from "./src/services/db";
import { SharedSettingsManager } from "./src/shared-settings";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: '500kb' }));

// Simple in-memory per-IP rate limiter (no extra dependency needed for this scale)
const _rlWindows = new Map<string, { count: number; resetAt: number }>();
function makeRateLimit(maxPerMinute: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? 'anon') + ':' + maxPerMinute;
    const now = Date.now();
    let w = _rlWindows.get(ip);
    if (!w || w.resetAt < now) {
      if (_rlWindows.size > 500) for (const [k, v] of _rlWindows) if (v.resetAt < now) _rlWindows.delete(k);
      _rlWindows.set(ip, (w = { count: 0, resetAt: now + 60_000 }));
    }
    if (++w.count > maxPerMinute) {
      return res.status(429).json({ error: 'Rate limit: too many requests. Wait a minute and try again.', errorCode: 'RATE_LIMIT' });
    }
    next();
  };
}

// Initialize Authoritative Request Assembler & Memory Manager
const requestAssembler = YuzeeRequestAssembler.getInstance();
const memoryManager = new TokenBudgetMemoryManager();
const cacheManager = new SystemPromptCacheManager();
const sharedSettings = new SharedSettingsManager();

/**
 * Real LLM summarizer using gemini-3.5-flash-lite.
 * Runs async post-response — zero latency impact on current turn.
 * Returns compact structured bullets of the evicted career counseling turns.
 */
async function summarizeEvictedTurns(
  evictedTurns: DialogueTurn[],
  previousSummary: string,
  ai: GoogleGenAI
): Promise<string> {
  const evictedText = evictedTurns
    .map(t => `User: ${t.userMessage.content}\nAssistant: ${t.assistantMessage?.content || ''}`)
    .join('\n---\n');

  const parts: string[] = [];
  if (previousSummary) parts.push(`Existing summary:\n${previousSummary}\n`);
  parts.push(`Compress these career counseling turns into structured bullets (max 500 tokens).\nOnly include facts that are explicitly stated:\n\n${evictedText}\n\n- Goal: [career target/role]\n- Background: [experience, certs, skills]\n- Constraints: [budget, time, location]\n- Decisions: [committed choices, chosen courses/certs]\n- Progress: [completed steps, feedback given]\n- Open: [unanswered questions, hesitations]\nOmit any field with no clear evidence. Plain bullets only.`);

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: parts.join('\n'),
    config: { maxOutputTokens: 500 },
  });

  const text = (response.text || '').trim();

  if (response.usageMetadata) {
    sessionStats.compactionCalls++;
    sessionStats.compactionInputTokens += response.usageMetadata.promptTokenCount || 0;
    sessionStats.compactionOutputTokens += response.usageMetadata.candidatesTokenCount || 0;
    sessionStats.compactionTotalTokens += response.usageMetadata.totalTokenCount || 0;
  }

  return text;
}

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
  totalModelInputTokens: 0,   // gross (uncached + cached); used for cache-hit ratio
  totalUncachedInputTokens: 0, // only new tokens billed at full input rate
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
  model: string = "gemini-3.5-flash-lite"
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
    defaultModel: "gemini-3.5-flash",
    supportsThinking: true,
    supportsCachedTokens: true,
    supportsInteractionsApi: true,
    supportsExplicitCache: true,
    geminiApiKeyPresent: hasKey,
    runtime: "preview-adapter",
  });
});

// Extract user profile facts from a conversation turn (fire-and-forget from client)
app.post("/api/extract-profile-facts", makeRateLimit(30), async (req, res) => {
  const { userMessage = "", assistantMessage = "", existingFacts = [] } = req.body;
  const ai = getGemini();
  if (!ai || !userMessage) return res.json({ facts: [] });
  const prompt = `Extract 0-4 SHORT factual statements about the user from this conversation turn.
Focus on: name, location, job/role, years of experience, certifications held, career goals, budget constraints, time availability, learning preferences, explicit likes ("I love", "I prefer", "I enjoy"), explicit dislikes ("I hate", "I don't like", "I avoid").

For each fact, output an object with "text" (the fact) and "category" (one of: "general", "like", "dislike").

User message: "${String(userMessage).slice(0, 400)}"
Already known facts: ${JSON.stringify((existingFacts as string[]).slice(0, 10))}

Return ONLY a JSON array of NEW fact objects not already known. If none, return [].
Example: [{"text":"Works as IT support","category":"general"},{"text":"Likes hands-on learning","category":"like"},{"text":"Dislikes online-only courses","category":"dislike"}]`;
  try {
    const resp = await ai.models.generateContent({ model: "gemini-3.5-flash-lite", contents: prompt });
    const text = (resp.text || "[]").trim();
    const match = text.match(/\[[\s\S]*\]/);
    const raw = match ? JSON.parse(match[0]) : [];
    // Support both old string format and new object format
    const facts = Array.isArray(raw) ? raw.slice(0, 4).map((f: any) =>
      typeof f === "string" ? { text: f, category: "general" } : f
    ) : [];
    res.json({ facts });
  } catch { res.json({ facts: [] }); }
});

// Detect contradictions between user message and stored profile facts
app.post("/api/detect-contradictions", makeRateLimit(20), async (req, res) => {
  const { userMessage = "", profileFacts = [] } = req.body;
  const ai = getGemini();
  if (!ai || !userMessage || !profileFacts.length) return res.json({ contradictions: [] });
  const prompt = `Check if the user's message contradicts any of their stored profile facts.

User message: "${String(userMessage).slice(0, 400)}"
Profile facts: ${JSON.stringify((profileFacts as string[]).slice(0, 15))}

Return ONLY a JSON array of contradiction objects. Each object: {"fact": "the stored fact", "contradiction": "what the user said that conflicts"}.
If no contradictions, return []. Keep it short — only clear factual conflicts, not vague differences.`;
  try {
    const resp = await ai.models.generateContent({ model: "gemini-3.5-flash-lite", contents: prompt });
    const text = (resp.text || "[]").trim();
    const match = text.match(/\[[\s\S]*\]/);
    const contradictions = match ? JSON.parse(match[0]) : [];
    res.json({ contradictions: Array.isArray(contradictions) ? contradictions.slice(0, 3) : [] });
  } catch { res.json({ contradictions: [] }); }
});

// Pre-flight contradiction check — called BEFORE the main AI request.
// Returns clarification questions only when the user's message relates to known unresolved contradictions.
// Fail-safe: always returns { needsClarification: false } on error so the main request proceeds.
app.post("/api/pre-check", makeRateLimit(30), async (req, res) => {
  const { userMessage = "", unresolvedContradictions = [] } = req.body;
  const ai = getGemini();
  if (!ai || !userMessage || !(unresolvedContradictions as any[]).length) {
    return res.json({ needsClarification: false });
  }
  const contraList = (unresolvedContradictions as any[]).slice(0, 3)
    .map((c: any) => `• Previously stated: "${String(c.fact).slice(0, 120)}" — Now saying: "${String(c.contradiction).slice(0, 120)}"`)
    .join('\n');
  const prompt = `You are a pre-response classifier. A user has unresolved profile contradictions.

User's message: "${String(userMessage).slice(0, 500)}"

Unresolved contradictions:
${contraList}

Task: Does the user's message relate to any of these contradictions? If yes, write 1–2 targeted questions to resolve them. If no, or if the message is a simple greeting/skip, return needsClarification:false.

Reply ONLY with valid JSON — no text before or after:
Related → {"needsClarification":true,"bridgeMessage":"One sentence explaining why you need to ask","questions":[{"dimension":"snake_case","text":"Question?","ui_type":"single_select","required":true,"options":[{"id":"a","label":"Option A"},{"id":"b","label":"Option B"}]}]}
Not related → {"needsClarification":false}`;
  try {
    const resp = await ai.models.generateContent({ model: "gemini-3.5-flash-lite", contents: prompt });
    const text = (resp.text || "{}").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.json({ needsClarification: false });
    const parsed = JSON.parse(match[0]);
    if (parsed.needsClarification === true && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return res.json({ needsClarification: true, questions: parsed.questions, bridgeMessage: parsed.bridgeMessage });
    }
    return res.json({ needsClarification: false });
  } catch { return res.json({ needsClarification: false }); }
});

// Default system prompt content (so client can display/diff)
app.get("/api/system-prompt", (req, res) => {
  res.json({
    content: requestAssembler.getPromptContent(),
    hash: requestAssembler.getPromptHash(),
    bytes: requestAssembler.getPromptBytes(),
  });
});

// ── Shared Settings ───────────────────────────────────────────────────────────
// All users share: system prompt mode + retention defaults.
// Changes here affect every conversation on this deployment.

app.get("/api/shared-settings", (_req, res) => {
  res.json({
    ...sharedSettings.get(),
    defaultPromptHash: requestAssembler.getPromptHash(),
    defaultPromptBytes: requestAssembler.getPromptBytes(),
  });
});

app.put("/api/shared-settings", (req, res) => {
  const { systemPromptMode, customSystemPrompt, contextBudget, recentTurnsToKeep, strategy } = req.body;
  const patch: Record<string, any> = {};
  if (systemPromptMode === 'default' || systemPromptMode === 'custom') patch.systemPromptMode = systemPromptMode;
  if (typeof customSystemPrompt === 'string') patch.customSystemPrompt = customSystemPrompt;
  if (typeof contextBudget === 'number' && contextBudget > 0) patch.contextBudget = contextBudget;
  if (typeof recentTurnsToKeep === 'number' && recentTurnsToKeep > 0) patch.recentTurnsToKeep = recentTurnsToKeep;
  if (typeof strategy === 'string') patch.strategy = strategy;
  res.json(sharedSettings.update(patch));
});

app.post("/api/shared-settings/reset-prompt", (_req, res) => {
  res.json(sharedSettings.resetPrompt());
});
// ─────────────────────────────────────────────────────────────────────────────

// List Conversations
app.get("/api/conversations", (req, res) => {
  const list = Array.from(conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  res.json(list);
});

// Create Clean Conversation
app.post("/api/conversations", (req, res) => {
  const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const title = req.body?.title || "New Career Exploration";
  const model = req.body?.model || "gemini-3.5-flash";
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
    contextBudget: req.body?.contextBudget || 270000,
    recentTurnsToKeep: req.body?.recentTurnsToKeep || 100,
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

  // Cap in-memory store to prevent unbounded growth on the free Render instance
  if (conversations.size >= 500) {
    const oldest = Array.from(conversations.values()).sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) conversations.delete(oldest.id);
  }
  conversations.set(id, conv);
  saveConversation(conv).catch(() => {});
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
    model: "gemini-3.5-flash",
    mode: "AUTO",
    strategy: "ADAPTIVE_HYBRID",
    preset: "BALANCED",
    responseMode: "standard",
    thinkingLevel: "adaptive",
    contextBudget: 270000,
    recentTurnsToKeep: 100,
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
  saveConversation(demoConv).catch(() => {});
  for (const m of demoConv.messages) saveMessage(m, demoId).catch(() => {});
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
  const raw = {
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
  const allowedUpdates = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  Object.assign(conv, allowedUpdates, { updatedAt: Date.now() });
  conversations.set(conv.id, conv);
  saveConversation(conv).catch(() => {});
  res.json(conv);
});

// Delete Conversation
app.delete("/api/conversations/:id", (req, res) => {
  const deleted = conversations.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  deleteConversation(req.params.id).catch(() => {});
  res.status(204).send();
});

// Restore Conversation (from localStorage backup after server restart)
app.post("/api/conversations/restore", (req, res) => {
  const data = req.body;
  if (!data || !data.id) return res.status(400).json({ error: "Missing conversation id" });

  // Skip if already in memory (server hasn't restarted)
  if (conversations.has(data.id)) {
    return res.json(conversations.get(data.id));
  }

  const restored: ConversationItem = {
    id: data.id,
    title: data.title || "Restored Conversation",
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    model: data.model || "gemini-3.5-flash-lite",
    mode: data.mode || "AUTO",
    strategy: data.strategy || "ADAPTIVE_HYBRID",
    preset: data.preset || "BALANCED",
    responseMode: data.responseMode || "standard",
    thinkingLevel: data.thinkingLevel || "adaptive",
    contextBudget: data.contextBudget || 270000,
    recentTurnsToKeep: data.recentTurnsToKeep || 100,
    careerContext: data.careerContext || {},
    summary: data.summary || "",
    summaryVersion: data.summaryVersion || 0,
    systemPromptMode: data.systemPromptMode || "default",
    customSystemPrompt: data.customSystemPrompt || "",
    useInteractionsApi: data.useInteractionsApi || false,
    useFlashLiteUtility: data.useFlashLiteUtility ?? true,
    activeInteraction: data.activeInteraction || null,
    messages: Array.isArray(data.messages) ? data.messages : [],
    compactionHistory: Array.isArray(data.compactionHistory) ? data.compactionHistory : [],
  };

  if (conversations.size >= 500) {
    const oldest = Array.from(conversations.values()).sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) conversations.delete(oldest.id);
  }
  conversations.set(restored.id, restored);
  saveConversation(restored).catch(() => {});
  for (const m of restored.messages) saveMessage(m, restored.id).catch(() => {});
  res.json(restored);
});

// Generate Conversation Title from first exchange
app.post("/api/conversations/:id/generate-title", makeRateLimit(10), async (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const ai = getGemini();
  if (!ai) return res.status(503).json({ error: "AI not configured" });

  const userMsg = conv.messages.find((m) => m.role === "user");
  const assistantMsg = conv.messages.find((m) => m.role === "assistant");
  if (!userMsg) return res.status(400).json({ error: "No messages to title" });

  const excerpt = [
    `User: ${userMsg.content.slice(0, 400)}`,
    assistantMsg ? `Assistant: ${(assistantMsg.content || "").slice(0, 300)}` : "",
  ].filter(Boolean).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: `Write a short title (4-6 words, no quotes, no punctuation at end) summarising this conversation:\n\n${excerpt}`,
      config: { maxOutputTokens: 20 },
    });
    const title = (response.text || "").trim().replace(/^["'`]|["'`]$/g, "").replace(/[.!?]$/, "").slice(0, 60);
    if (!title) return res.status(500).json({ error: "Empty title generated" });
    conv.title = title;
    conv.updatedAt = Date.now();
    conversations.set(conv.id, conv);
    saveConversation(conv).catch(() => {});
    res.json({ title });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Title generation failed" });
  }
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
  saveConversation(conv).catch(() => {});
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
app.post("/api/tokens/count", makeRateLimit(30), async (req, res) => {
  const { message = "", conversationId, model = "gemini-3.5-flash-lite", fastEstimate = false } = req.body;
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
    conv?.contextBudget || 270000,
    conv?.recentTurnsToKeep || 100,
    conv?.strategy || "ADAPTIVE_HYBRID",
    conv?.summary || "",
    trimmed
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

  // Derive uncached input in case old accumulated stats pre-date the new field
  const totalUncachedInputTokens = sessionStats.totalUncachedInputTokens > 0
    ? sessionStats.totalUncachedInputTokens
    : Math.max(0, sessionStats.totalModelInputTokens - sessionStats.totalCachedTokens);

  res.json({
    ...sessionStats,
    totalUncachedInputTokens,
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
app.post("/api/benchmark", makeRateLimit(10), async (req, res) => {
  const {
    conversationId,
    prompt = "Help me transition into cybersecurity and build a 6-month study roadmap.",
    model = "gemini-3.5-flash-lite",
    strategies,
    isLive = false, // When true, executes real Gemini provider benchmark
  } = req.body;

  const conv = conversationId ? conversations.get(conversationId) : null;
  const stratsToTest = strategies || ["BASELINE", "SUMMARY_RECENT", "ADAPTIVE_HYBRID", "SEMANTIC_EVIDENCE"];
  const historicalMessages = conv ? conv.messages : [];

  const BENCHMARK_BUDGETS: Record<string, number> = {
    BASELINE: 8000,
    SUMMARY_RECENT: 1500,
    ADAPTIVE_HYBRID: 1500,
    SEMANTIC_EVIDENCE: 6000,
  };
  const BENCHMARK_TURNS: Record<string, number> = {
    BASELINE: 10,
    SUMMARY_RECENT: 2,
    ADAPTIVE_HYBRID: 2,
    SEMANTIC_EVIDENCE: 20,
  };

  const results = [];

  for (const strat of stratsToTest) {
    const mem = memoryManager.assembleMemory(
      historicalMessages,
      BENCHMARK_BUDGETS[strat] ?? 1500,
      BENCHMARK_TURNS[strat] ?? 2,
      strat,
      conv?.summary || "",
      prompt
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

        let textToParse = fullText;
        const fenceMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) textToParse = fenceMatch[1].trim();
        const validation = validateProtocolV13(JSON.parse(textToParse));
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
        latencyMs: null,
        ttftMs: null,
        generationMs: null,
        compactionCost: mem.compactionMetrics ? mem.compactionMetrics.compactionTotalCost : 0,
        responsePreview: "Modelled structured response adhering to Response Protocol v1.3 envelope.",
        retainedContextTokens: dynTokens,
        schemaValid: null,
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
app.post("/api/conversations/:id/messages", makeRateLimit(20), async (req, res) => {
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
      model: req.body.model || "gemini-3.5-flash-lite",
      mode: req.body.mode || "AUTO",
      strategy: req.body.strategy || "ADAPTIVE_HYBRID",
      preset: req.body.preset || "BALANCED",
      responseMode: req.body.responseMode || "standard",
      thinkingLevel: req.body.thinkingLevel || "adaptive",
      contextBudget: req.body.contextBudget || 270000,
      recentTurnsToKeep: req.body.recentTurnsToKeep || 100,
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
    saveConversation(newConv).catch(() => {});
    conv = newConv;
  }
  const conversationLoadMs = Date.now() - conversationLoadStart;

  const userMessageContent = req.body.message || "";
  const userEvent: UserEvent | undefined = req.body.userEvent;

  if (!userMessageContent && !userEvent) {
    return res.status(400).json({ error: "message or userEvent is required" });
  }

  // Build lightweight context prefix (date, location, user profile) — injected into each turn
  const uc = req.body.userContext as { date?: string; timezone?: string; location?: string } | undefined;
  const upFacts: string[] = req.body.userProfileFacts || [];
  const userQuestionAnswers: any[] = req.body.userQuestionAnswers || [];
  const ctxParts: string[] = [];
  if (uc?.date) ctxParts.push(`Date: ${uc.date}`);
  if (uc?.location) ctxParts.push(`Location: ${uc.location}`);
  else if (uc?.timezone) ctxParts.push(`Timezone: ${uc.timezone}`);
  if (upFacts.length > 0) ctxParts.push(`User facts: ${upFacts.slice(0, 8).join("; ")}`);
  if (userQuestionAnswers.length > 0) ctxParts.push(`USER_QUESTION_ANSWERS: ${JSON.stringify(userQuestionAnswers)}`);
  const enrichedMessage = ctxParts.length > 0
    ? `[${ctxParts.join(" · ")}]\n${userMessageContent}`
    : userMessageContent;
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
  // Shared settings are the authoritative defaults so all users get consistent behaviour.
  // Per-request body values (sent by power-user Lab controls) override the shared defaults.
  // Mode-based presets (SAVE_TOKENS / FULL_CONTEXT) override everything below.
  const ss = sharedSettings.get();
  let strategy = req.body.strategy || ss.strategy || conv.strategy;
  let budget = req.body.contextBudget || ss.contextBudget || conv.contextBudget;
  let recentTurns = req.body.recentTurnsToKeep || ss.recentTurnsToKeep || conv.recentTurnsToKeep;
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
  const mem = memoryManager.assembleMemory(historicalMessages, budget, recentTurns, strategy, conv.summary, userMessageContent);
  const memoryAssemblyMs = Date.now() - memoryAssemblyStart;

  // Capture evicted turns now (before pushing current turn) for post-response summarization
  const allDialogueTurns = groupIntoTurns(historicalMessages);
  const keptTurnIds = new Set(mem.keptTurns.map(t => t.id));
  const evictedDialogueTurns = allDialogueTurns.filter(t => !keptTurnIds.has(t.id));

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
  const modelId = req.body.model || conv.model || "gemini-3.5-flash-lite";
  const allowedModels = GEMINI_MODELS.filter(m => m.selectable).map(m => m.id);
  if (!allowedModels.includes(modelId)) {
    return res.status(400).json({ error: `Unknown model: ${modelId}` });
  }
  // System prompt is sourced from SHARED settings (not per-conversation) so:
  // 1. All users and all conversations see identical system instruction content.
  // 2. The Gemini explicit context cache is maximally reused across all requests
  //    because the same content hash maps to the same remote cache entry.
  const effectiveSystemPrompt = ss.systemPromptMode === 'custom' && ss.customSystemPrompt.trim()
    ? ss.customSystemPrompt.trim()
    : undefined; // undefined → assembler uses the default file-loaded prompt

  const assembledReq = requestAssembler.assembleRequest({
    model: modelId,
    messageText: enrichedMessage,
    userEvent,
    careerContext: req.body.careerContext || conv.careerContext,
    summaryText: mem.summaryText,
    recentHistoryText: mem.recentHistoryText,
    responseMode: req.body.responseMode || conv.responseMode,
    thinkingLevel: req.body.thinkingLevel || conv.thinkingLevel,
    customSystemPrompt: effectiveSystemPrompt,
    systemPromptMode: effectiveSystemPrompt ? 'custom' : 'default',
  });
  const requestAssemblyMs = Date.now() - requestAssemblyStart;

  // Explicit context cache for system prompt — returns null while cache is being created (first ~1 request per model).
  // When active: systemInstruction tokens are served from cache at ~75% lower cost.
  const aiInstance = getGemini();
  // Cache is keyed by (model, promptHash). Using sharedSettings.effectiveHash() ensures:
  // - All users on the default prompt share the SAME cache entry → maximum reuse.
  // - When an admin switches to a custom prompt, effectiveHash() changes → new cache
  //   entry is created automatically and the old one is deleted.
  const effectivePromptHash = sharedSettings.effectiveHash(requestAssembler.getPromptHash());
  let cacheName: string | null = null;
  try {
    cacheName = aiInstance
      ? await cacheManager.getCacheForModel(modelId, aiInstance, assembledReq.systemInstruction, effectivePromptHash)
      : null;
  } catch {
    // Cache lookup failure is non-fatal; proceed without cache
  }
  const geminiConfig = cacheName
    ? { ...assembledReq.geminiConfig, systemInstruction: undefined, cachedContent: cacheName }
    : assembledReq.geminiConfig;

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

  // Vercel Hobby tier kills functions at 10s; fire a clean error event at 8.5s so the
  // client sees an informative message rather than a silent connection drop.
  let timeoutFired = false;
  const VERCEL_SAFE_MS = process.env.VERCEL ? 8500 : 0;
  const timeoutHandle = VERCEL_SAFE_MS
    ? setTimeout(() => {
        timeoutFired = true;
        sendEvent("error", {
          error: "Response is taking too long for the free-tier function limit (10 s). Try a shorter question or switch to Flash Lite.",
          errorCode: "FUNCTION_TIMEOUT",
        });
        res.end();
      }, Math.max(100, VERCEL_SAFE_MS - (Date.now() - requestReceivedAt)))
    : null;

  let fullAssistantText = "";
  let isMockResponse = false;

  // Greeting/farewell bypass — skip Gemini entirely, costs 0 tokens
  const messageClass = requestAssembler.classifyUserMessage(userMessageContent);
  if (messageClass !== 'career') {
    if (timeoutHandle) clearTimeout(timeoutHandle); // prevent timer firing after res.end()
    fullAssistantText = JSON.stringify(makeBypassResponse(messageClass));
    isMockResponse = true;
    // Fast-path: emit all required SSE events and return
    sendEvent("validation", { schemaValid: true, semanticValid: true, protocolAccepted: true, errors: [], warnings: [], promptHash: requestAssembler.getPromptHash(), schemaHash: requestAssembler.getSchemaHash() });
    const bypassParsed = JSON.parse(fullAssistantText);
    sendEvent("protocol_response", bypassParsed);
    sendEvent("structured", bypassParsed);
    sendEvent("usage", {
      usage: { currentUserTokens: estimateTokens(userMessageContent), inputTokens: 0, outputTokens: 0, thinkingTokens: null, cachedTokens: null, toolTokens: null, totalTokens: 0, finishReason: 'STOP', isMock: true, sources: { inputTokens: "bypass", outputTokens: "bypass", thinkingTokens: "unavailable", cachedTokens: "unavailable", currentUserTokens: "estimate" }, timeline: { aiRequestId: assembledReq.aiRequestId, requestReceivedAt, preProviderLatencyMs: 0, providerTtftMs: null, providerGenerationDurationMs: null, totalLatencyMs: Date.now() - requestReceivedAt } },
      contextMetrics: null,
      compactionMetrics: null,
      timeline: { aiRequestId: assembledReq.aiRequestId, requestReceivedAt, preProviderLatencyMs: 0, providerTtftMs: null, providerGenerationDurationMs: null, totalLatencyMs: Date.now() - requestReceivedAt },
    });
    const bypassUserMsg: MessageItem = { id: `user-${Date.now()}`, role: "user", content: userMessageContent, userEvent, createdAt: requestReceivedAt };
    const bypassMsg: MessageItem = { id: messageId, role: "assistant", content: fullAssistantText, structuredResponse: bypassParsed, createdAt: Date.now() };
    conv.messages.push(bypassUserMsg);
    conv.messages.push(bypassMsg);
    conv.updatedAt = Date.now();
    saveConversation(conv).catch(() => {});
    saveMessage(bypassUserMsg, conv.id).catch(() => {});
    saveMessage(bypassMsg, conv.id).catch(() => {});
    sendEvent("done", { aiRequestId: assembledReq.aiRequestId });
    res.end();
    return;
  }

  const providerStartTime = Date.now();
  let firstProviderChunkTime: number | null = null;
  let providerEndTime: number | null = null;
  let realUsageMetadata: any = null;
  let finishReason: string | null = null;

  try {
    if (aiInstance) {
      // Real Gemini API Invocation — uses explicit cache when available, systemInstruction otherwise
      const stream = await aiInstance.models.generateContentStream({
        model: assembledReq.model,
        contents: assembledReq.contents,
        config: geminiConfig,
      });

      for await (const chunk of stream) {
        if (timeoutFired) break;
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
          sendEvent("delta", text);
        }
        if (chunk.usageMetadata) {
          realUsageMetadata = chunk.usageMetadata;
        }
        const chunkFinish = chunk.candidates?.[0]?.finishReason;
        if (chunkFinish) finishReason = chunkFinish;
      }
      providerEndTime = Date.now();
    } else {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      sendEvent("error", { error: "GEMINI_API_KEY is not configured. Add it to your .env file and restart the server.", errorCode: "AUTH_ERROR" });
      res.end();
      return;
    }
  } catch (err: any) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (timeoutFired) return; // timeout already ended the response
    console.error("Gemini invocation error:", err);
    const msg: string = err?.message || err?.toString() || '';
    let errorCode: string;
    let userMsg: string;
    if (/API_KEY_INVALID|PERMISSION_DENIED|invalid.api.key|unauthenticated/i.test(msg)) {
      errorCode = 'AUTH_ERROR';
      userMsg = 'Gemini API key issue. Check that GEMINI_API_KEY is set and valid.';
    } else if (/per.day|daily.*quota|quota.*day|requests_per_day|tokens_per_day|FreeTier.*limit.*exceed|limit.*exceed.*FreeTier/i.test(msg)) {
      // Daily/monthly quota exhausted — check quota before generic RESOURCE_EXHAUSTED
      errorCode = 'QUOTA_EXHAUSTED';
      userMsg = 'Gemini free-tier daily quota has been used up. The lab will resume when the quota resets (midnight Pacific time).';
    } else if (err?.status === 429 || /RESOURCE_EXHAUSTED|rate.limit|too many requests/i.test(msg)) {
      errorCode = 'RATE_LIMIT';
      // Distinguish per-minute (RPM) from other rate limits
      userMsg = /per.minute|per_minute|requests.*minute|minute.*request/i.test(msg)
        ? 'Per-minute request limit reached (free tier: 10–30 RPM). Wait 60 seconds and try again. Flash Lite has the highest free-tier limit.'
        : 'Gemini rate limit reached. Wait a moment and try again.';
    } else {
      errorCode = 'PROVIDER_ERROR';
      userMsg = 'Gemini returned an error. Please try again.';
    }
    sendEvent("error", { error: userMsg, errorCode });
    res.end();
    const clientIpErr = ((req.ip ?? req.socket?.remoteAddress ?? 'unknown') as string).replace(/^::ffff:/, '');
    logTurn({
      ip: clientIpErr,
      conversationId: conv.id,
      messageId,
      model: modelId,
      isMock: false,
      userInput: userMessageContent,
      errorCode,
    }).catch(() => {});
    return;
  }
  if (timeoutHandle) clearTimeout(timeoutHandle);
  if (timeoutFired) return; // timeout fired during the stream; response already ended

  try {
  // 3. SERVER-SIDE 3-LAYER VALIDATION
  const validationStartTime = Date.now();
  let parsedResponse: any = null;
  let isJsonValid = false;

  try {
    parsedResponse = JSON.parse(fullAssistantText);
    isJsonValid = true;
  } catch {
    // Flash-Lite sometimes wraps JSON in markdown fences (```json...```). Strip them and retry.
    const fenceMatch = fullAssistantText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const extracted = fenceMatch ? fenceMatch[1].trim() : fullAssistantText.trim().replace(/^```json?\s*/, '').replace(/```\s*$/, '');
    try {
      parsedResponse = JSON.parse(extracted);
      isJsonValid = true;
      fullAssistantText = extracted; // normalise so delta content matches
    } catch {
      isJsonValid = false;
    }
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
  const wasTruncated = finishReason === 'MAX_TOKENS';

  // Security gate: only trust interaction choices when protocol is fully accepted.
  // MAX_TOKENS truncation: JSON is incomplete, never trust it.
  const trustInteraction = !wasTruncated && (isMockResponse || validationResult.protocolAccepted);
  if (trustInteraction) {
    if (parsedResponse?.interaction && parsedResponse.interaction.kind !== "none") {
      conv.activeInteraction = parsedResponse.interaction;
    } else if (parsedResponse?.interaction && parsedResponse.interaction.kind === "none") {
      conv.activeInteraction = null;
    }
  }

  // Render gate: send structured event whenever JSON parsed OK (not truncated).
  // AJV noise / semantic warnings must NOT suppress rendering — the UI shows notices instead.
  const canRender = !wasTruncated && isJsonValid && parsedResponse !== null;
  if (canRender) {
    sendEvent("validation", {
      schemaValid: isMockResponse ? true : validationResult.schemaValid,
      semanticValid: isMockResponse ? true : validationResult.semanticValid,
      protocolAccepted: isMockResponse ? true : validationResult.protocolAccepted,
      errors: isMockResponse ? [] : validationResult.errors,
      warnings: isMockResponse ? [] : validationResult.warnings,
      promptHash: requestAssembler.getPromptHash(),
      schemaHash: requestAssembler.getSchemaHash(),
    });
    sendEvent("protocol_response", parsedResponse);
    sendEvent("structured", parsedResponse);
  } else {
    const truncationErrors = wasTruncated
      ? [`Response truncated (MAX_TOKENS): output hit the ${assembledReq.maxOutputTokens}-token limit mid-JSON. Try switching to Detail mode or ask a more focused question.`]
      : [];
    sendEvent("protocol_validation_error", {
      schemaValid: isJsonValid ? validationResult.schemaValid : false,
      semanticValid: isJsonValid ? validationResult.semanticValid : false,
      protocolAccepted: false,
      errors: [...truncationErrors, ...(isJsonValid ? validationResult.errors : ["Failed to parse model output as JSON"])],
      warnings: isJsonValid ? validationResult.warnings : [],
      aiRequestId: assembledReq.aiRequestId,
      finishReason,
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
  // Only report cached tokens when provider confirms a real cache hit (non-null, non-zero)
  const cachedTokensRaw = realUsageMetadata?.cachedContentTokenCount ?? null;
  const cachedTokens = (cachedTokensRaw !== null && cachedTokensRaw > 0) ? cachedTokensRaw : null;
  // Total = tokens actually consumed from quota: uncached input + output + thinking
  // (Do NOT use totalTokenCount from the API — it includes cached tokens in the input sum)
  const uncachedInputTokens = cachedTokens !== null ? Math.max(0, inputTokens - cachedTokens) : inputTokens;
  const totalTokens = uncachedInputTokens + outputTokens + (thinkingTokens || 0);

  const usageMetrics = {
    currentUserTokens: userPromptTokens,
    inputTokens,
    outputTokens,
    thinkingTokens,
    cachedTokens,
    toolTokens: null,
    totalTokens,
    finishReason,
    uncachedInputTokens,
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
      explicitCache: cacheManager.getStatus(modelId),
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
    sessionStats.totalUncachedInputTokens += uncachedInputTokens;
    sessionStats.totalModelOutputTokens += outputTokens;
    if (thinkingTokens) sessionStats.totalThinkingTokens += thinkingTokens;
    if (cachedTokens) sessionStats.totalCachedTokens += cachedTokens;
    sessionStats.totalUserFacingTokens += totalTokens;

    const baselineEst = inputTokens + conv.messages.length * 120;
    sessionStats.baselineEstimatedTokens += baselineEst;
  }

  // 5. ATTACH COMPLETED TURN TO CONVERSATION RECORD
  const userMsg: MessageItem = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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
    structuredResponse: (isJsonValid && parsedResponse !== null && !wasTruncated) ? parsedResponse : undefined,
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
  saveConversation(conv).catch(() => {});
  saveMessage(userMsg, conv.id).catch(() => {});
  saveMessage(assistantMsg, conv.id).catch(() => {});

  sendEvent("usage", {
    usage: usageMetrics,
    contextMetrics: contextBreakdown,
    compactionMetrics: mem.compactionMetrics,
    timeline,
  });

  // Fire-and-forget DB logging (non-blocking, optional)
  const clientIp = ((req.ip ?? req.socket?.remoteAddress ?? 'unknown') as string).replace(/^::ffff:/, '');
  logTurn({
    ip: clientIp,
    conversationId: conv.id,
    messageId,
    model: modelId,
    inputTokens: usageMetrics.inputTokens,
    uncachedInputTokens: usageMetrics.uncachedInputTokens,
    cachedTokens: usageMetrics.cachedTokens,
    outputTokens: usageMetrics.outputTokens,
    thinkingTokens: usageMetrics.thinkingTokens,
    estimatedCostUsd: calcTurnCost(modelId, usageMetrics),
    latencyMs: usageMetrics.latencyMs,
    finishReason: finishReason || null,
    isMock: isMockResponse,
    userInput: userMessageContent,
    assistantOutput: fullAssistantText,
  }).catch(() => {});

  sendEvent("done", { aiRequestId: assembledReq.aiRequestId });
  } catch (e: any) {
    console.error("Post-stream processing error:", e);
    try { sendEvent("error", { error: "Internal error processing response", errorCode: "INTERNAL_ERROR" }); } catch {}
  } finally {
    res.end();
  }

  // Async post-response: real LLM summarization of evicted turns (zero latency impact).
  // Updates conv.summary for the next turn; uses cheapest model.
  if (aiInstance && !isMockResponse && evictedDialogueTurns.length > 0) {
    const convId = conv.id;
    summarizeEvictedTurns(evictedDialogueTurns, conv.summary, aiInstance)
      .then(s => {
        const live = conversations.get(convId);
        if (s && live) {
          live.summary = s;
          live.summaryVersion = (live.summaryVersion || 0) + 1;
          saveConversation(live).catch(() => {});
        }
      })
      .catch(() => {});
  }
});

function makeBypassResponse(kind: 'greeting' | 'farewell'): YuzeeResponseV13 {
  const text = kind === 'greeting'
    ? "Hi! I'm Oala, your Yuzee career counsellor. What career challenge can I help you with today? I can help with pathway planning, skill gap analysis, course options, job readiness, and more."
    : "You're welcome — happy to help anytime. Come back whenever you need career guidance!";
  return {
    schema_version: "1.3",
    current_mode: "A_CONVERSATION",
    response_intent: kind === 'greeting' ? "SOCRATIC_DIRECTION" : "PAUSE_CLOSURE",
    content_blocks: [{ id: "b1", type: "text", level: "none", variant: "default", title: "", text, items: [], columns: [], rows: [] }],
    interaction: { kind: "none", input_type: "none", question_id: "", question: "", options: [], allow_other_input: false, other_input_label: "", fields: [], recommended_actions: [] },
    service: { flow: "NONE", intent_detected: false, goal_summary: "", trigger: "", confidence: "", selected_rmo: "", offer_target: "", missing_inputs: [], actions: [] },
    state: { active_response_mode: "standard", effective_response_mode: "standard", mode_source: "default", safety_override_applied: false, user_confidence: { score: -1, band: "unknown", evidence_strength: "none", trend: "unknown", reason_codes: [] }, progress: { explained: [], failed_attempts: 0, loop_count_same_issue: 0 } },
    followups: { enabled: false, cancel_on_user_message: true, topic_lock: false, topic_key: "", triggers: [] },
  };
}

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // __dirname in the compiled dist/server.cjs is the dist/ folder itself
    const distPath = path.join(__dirname, "public");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Init DB before opening the port so the schema exists for the first request
  await initDb();
  if (isDbEnabled()) {
    const loaded = await loadConversations();
    for (const conv of loaded) {
      if (!conversations.has(conv.id)) conversations.set(conv.id, conv);
    }
    if (loaded.length) console.log(`[db] Loaded ${loaded.length} conversations from DB`);
    const iv = setInterval(() => pruneExpired(), 6 * 60 * 60 * 1000);
    iv.unref(); // don't prevent clean process exit
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Yuzee AI Token Lab running on port ${PORT}`);
  });
}

// Export app for Vercel serverless function (api/index.ts)
export { app };

// Only start the HTTP server when running directly (not as a Vercel serverless function)
if (!process.env.VERCEL) {
  startServer();
}
