import pg from "pg";
import fs from "fs/promises";
import path from "path";
const { Pool } = pg;

// ---- Local JSON file fallback (used when DATABASE_URL is absent) ----
const LOCAL_FILE = path.join(process.cwd(), "data", "conversations.json");

async function readLocal(): Promise<any[]> {
  try { return JSON.parse(await fs.readFile(LOCAL_FILE, "utf-8")); }
  catch { return []; }
}

async function writeLocal(convs: any[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FILE, JSON.stringify(convs, null, 2));
  } catch (err) { console.error("[local-db] write failed:", err); }
}

// ---- PostgreSQL pool (optional) ----
// Optional — if DATABASE_URL is absent the app works without logging
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase requires SSL; rejectUnauthorized:false accepts their CA without a local cert bundle
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

// ---- Schema ----

const TABLE_CONVERSATIONS = `
CREATE TABLE IF NOT EXISTS conversations (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  model                 TEXT NOT NULL DEFAULT 'gemini-3.5-flash',
  mode                  TEXT DEFAULT 'AUTO',
  strategy              TEXT DEFAULT 'ADAPTIVE_HYBRID',
  preset                TEXT DEFAULT 'BALANCED',
  response_mode         TEXT DEFAULT 'standard',
  thinking_level        TEXT DEFAULT 'adaptive',
  context_budget        INT DEFAULT 270000,
  recent_turns_to_keep  INT DEFAULT 100,
  summary               TEXT DEFAULT '',
  summary_version       INT DEFAULT 0,
  system_prompt_mode    TEXT DEFAULT 'default',
  custom_system_prompt  TEXT DEFAULT '',
  use_interactions_api  BOOLEAN DEFAULT FALSE,
  use_flash_lite_utility BOOLEAN DEFAULT TRUE,
  career_context        JSONB DEFAULT '{}',
  compaction_history    JSONB DEFAULT '[]',
  active_interaction    JSONB
)`;

const TABLE_MESSAGES = `
CREATE TABLE IF NOT EXISTS messages (
  id                  TEXT PRIMARY KEY,
  conversation_id     TEXT NOT NULL,
  role                TEXT NOT NULL,
  content             TEXT NOT NULL,
  structured_response JSONB,
  user_event          JSONB,
  telemetry           JSONB,
  feedback            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
)`;

const TABLE_TURN_LOGS = `
CREATE TABLE IF NOT EXISTS conversation_logs (
  id            BIGSERIAL PRIMARY KEY,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  ip            TEXT        NOT NULL,
  conversation_id TEXT      NOT NULL,
  message_id    TEXT        NOT NULL,
  model         TEXT,
  input_tokens        INT,
  uncached_input_tokens INT,
  cached_tokens       INT,
  output_tokens       INT,
  thinking_tokens     INT,
  estimated_cost_usd  NUMERIC(12,8),
  latency_ms          INT,
  finish_reason       TEXT,
  is_mock       BOOLEAN     NOT NULL DEFAULT FALSE,
  user_input    TEXT,
  assistant_output TEXT,
  error_code    TEXT
)`;

const INDEX_SQLS = [
  `CREATE INDEX IF NOT EXISTS idx_convlog_expires ON conversation_logs (expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_convlog_ip      ON conversation_logs (ip, logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_convlog_conv    ON conversation_logs (conversation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_updated    ON conversations (updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_expires    ON conversations (expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_msg_conv        ON messages (conversation_id, created_at ASC)`,
];

export async function initDb(): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(TABLE_TURN_LOGS);
    await pool.query(TABLE_CONVERSATIONS);
    await pool.query(TABLE_MESSAGES);
    for (const sql of INDEX_SQLS) {
      try { await pool.query(sql); } catch (e) { console.warn("[db] Index warning:", e); }
    }
    console.log("[db] Schema ready");
    const { rowCount } = await pool.query("DELETE FROM conversation_logs WHERE expires_at < NOW()");
    if (rowCount) console.log(`[db] Pruned ${rowCount} expired turn log rows on startup`);
  } catch (err) {
    console.error("[db] Init failed:", err);
  }
}

// Run every 6 hours to keep the tables lean
export async function pruneExpired(): Promise<void> {
  if (!pool) return;
  try {
    const r1 = await pool.query("DELETE FROM conversation_logs WHERE expires_at < NOW()");
    const r2 = await pool.query("DELETE FROM conversations WHERE expires_at < NOW()");
    const pruned = (r1.rowCount ?? 0) + (r2.rowCount ?? 0);
    if (pruned) console.log(`[db] Pruned ${pruned} expired rows`);
  } catch (err) {
    console.error("[db] Prune failed:", err);
  }
}

// ---- Turn logging (stats row per API call) ----

export interface TurnLog {
  ip: string;
  conversationId: string;
  messageId: string;
  model?: string | null;
  inputTokens?: number | null;
  uncachedInputTokens?: number | null;
  cachedTokens?: number | null;
  outputTokens?: number | null;
  thinkingTokens?: number | null;
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  finishReason?: string | null;
  isMock?: boolean;
  userInput?: string | null;
  assistantOutput?: string | null;
  errorCode?: string | null;
}

const MAX_INPUT_CHARS = 2000;
const MAX_OUTPUT_CHARS = 4000;

export async function logTurn(turn: TurnLog): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO conversation_logs (
        ip, conversation_id, message_id, model,
        input_tokens, uncached_input_tokens, cached_tokens, output_tokens, thinking_tokens,
        estimated_cost_usd, latency_ms, finish_reason, is_mock,
        user_input, assistant_output, error_code
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        turn.ip,
        turn.conversationId,
        turn.messageId,
        turn.model ?? null,
        turn.inputTokens ?? null,
        turn.uncachedInputTokens ?? null,
        turn.cachedTokens ?? null,
        turn.outputTokens ?? null,
        turn.thinkingTokens ?? null,
        turn.estimatedCostUsd ?? null,
        turn.latencyMs ?? null,
        turn.finishReason ?? null,
        turn.isMock ?? false,
        turn.userInput ? turn.userInput.slice(0, MAX_INPUT_CHARS) : null,
        turn.assistantOutput ? turn.assistantOutput.slice(0, MAX_OUTPUT_CHARS) : null,
        turn.errorCode ?? null,
      ]
    );
  } catch (err) {
    console.error("[db] logTurn failed:", err);
  }
}

// ---- Conversation persistence ----

export async function saveConversation(conv: any): Promise<void> {
  if (!pool) {
    const all = await readLocal();
    const idx = all.findIndex((c: any) => c.id === conv.id);
    if (idx >= 0) all[idx] = conv; else all.push(conv);
    await writeLocal(all);
    return;
  }
  try {
    await pool.query(
      `INSERT INTO conversations (
        id, title, created_at, updated_at, expires_at,
        model, mode, strategy, preset, response_mode, thinking_level,
        context_budget, recent_turns_to_keep,
        summary, summary_version,
        system_prompt_mode, custom_system_prompt,
        use_interactions_api, use_flash_lite_utility,
        career_context, compaction_history, active_interaction
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT (id) DO UPDATE SET
        title                 = EXCLUDED.title,
        updated_at            = EXCLUDED.updated_at,
        expires_at            = NOW() + INTERVAL '30 days',
        model                 = EXCLUDED.model,
        mode                  = EXCLUDED.mode,
        strategy              = EXCLUDED.strategy,
        preset                = EXCLUDED.preset,
        response_mode         = EXCLUDED.response_mode,
        thinking_level        = EXCLUDED.thinking_level,
        context_budget        = EXCLUDED.context_budget,
        recent_turns_to_keep  = EXCLUDED.recent_turns_to_keep,
        summary               = EXCLUDED.summary,
        summary_version       = EXCLUDED.summary_version,
        system_prompt_mode    = EXCLUDED.system_prompt_mode,
        custom_system_prompt  = EXCLUDED.custom_system_prompt,
        use_interactions_api  = EXCLUDED.use_interactions_api,
        use_flash_lite_utility = EXCLUDED.use_flash_lite_utility,
        career_context        = EXCLUDED.career_context,
        compaction_history    = EXCLUDED.compaction_history,
        active_interaction    = EXCLUDED.active_interaction`,
      [
        conv.id,
        conv.title ?? '',
        new Date(conv.createdAt || Date.now()),
        new Date(conv.updatedAt || Date.now()),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        conv.model ?? 'gemini-3.5-flash',
        conv.mode ?? 'AUTO',
        conv.strategy ?? 'ADAPTIVE_HYBRID',
        conv.preset ?? 'BALANCED',
        conv.responseMode ?? 'standard',
        conv.thinkingLevel ?? 'adaptive',
        conv.contextBudget ?? 270000,
        conv.recentTurnsToKeep ?? 100,
        conv.summary ?? '',
        conv.summaryVersion ?? 0,
        conv.systemPromptMode ?? 'default',
        conv.customSystemPrompt ?? '',
        conv.useInteractionsApi ?? false,
        conv.useFlashLiteUtility ?? true,
        JSON.stringify(conv.careerContext || {}),
        JSON.stringify(conv.compactionHistory || []),
        conv.activeInteraction ? JSON.stringify(conv.activeInteraction) : null,
      ]
    );
  } catch (err) {
    console.error("[db] saveConversation failed:", err);
  }
}

export async function saveMessage(msg: any, conversationId: string): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO messages (id, conversation_id, role, content, structured_response, user_event, telemetry, feedback, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         content             = EXCLUDED.content,
         structured_response = EXCLUDED.structured_response,
         telemetry           = EXCLUDED.telemetry,
         feedback            = EXCLUDED.feedback`,
      [
        msg.id,
        conversationId,
        msg.role,
        msg.content,
        msg.structuredResponse != null ? JSON.stringify(msg.structuredResponse) : null,
        msg.userEvent != null ? JSON.stringify(msg.userEvent) : null,
        msg.telemetry != null ? JSON.stringify(msg.telemetry) : null,
        msg.feedback != null ? JSON.stringify(msg.feedback) : null,
        new Date(msg.createdAt || Date.now()),
      ]
    );
  } catch (err) {
    console.error("[db] saveMessage failed:", err);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  if (!pool) {
    const all = await readLocal();
    await writeLocal(all.filter((c: any) => c.id !== id));
    return;
  }
  try {
    await pool.query("DELETE FROM conversations WHERE id = $1", [id]);
  } catch (err) {
    console.error("[db] deleteConversation failed:", err);
  }
}

export async function loadConversations(): Promise<any[]> {
  if (!pool) return readLocal();
  try {
    const convResult = await pool.query(
      `SELECT * FROM conversations WHERE expires_at > NOW() ORDER BY updated_at DESC LIMIT 500`
    );
    if (convResult.rows.length === 0) return [];

    const ids = convResult.rows.map((r: any) => r.id);
    const msgResult = await pool.query(
      `SELECT * FROM messages WHERE conversation_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    );

    const msgsByConv = new Map<string, any[]>();
    for (const m of msgResult.rows) {
      if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, []);
      msgsByConv.get(m.conversation_id)!.push(m);
    }

    return convResult.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      model: r.model,
      mode: r.mode,
      strategy: r.strategy,
      preset: r.preset,
      responseMode: r.response_mode,
      thinkingLevel: r.thinking_level,
      contextBudget: r.context_budget,
      recentTurnsToKeep: r.recent_turns_to_keep,
      summary: r.summary || '',
      summaryVersion: r.summary_version || 0,
      systemPromptMode: r.system_prompt_mode,
      customSystemPrompt: r.custom_system_prompt || '',
      useInteractionsApi: r.use_interactions_api || false,
      useFlashLiteUtility: r.use_flash_lite_utility ?? true,
      careerContext: r.career_context || {},
      compactionHistory: r.compaction_history || [],
      activeInteraction: r.active_interaction || null,
      messages: (msgsByConv.get(r.id) || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        structuredResponse: m.structured_response ?? undefined,
        userEvent: m.user_event ?? undefined,
        telemetry: m.telemetry ?? undefined,
        feedback: m.feedback ?? undefined,
        createdAt: new Date(m.created_at).getTime(),
      })),
    }));
  } catch (err) {
    console.error("[db] loadConversations failed:", err);
    return [];
  }
}

export function isDbEnabled(): boolean {
  return pool !== null;
}

export async function keepAlive(): Promise<void> {
  if (!pool) return;
  try { await pool.query("SELECT 1"); } catch (err) { console.error("[db] keepAlive failed:", err); }
}

export async function loadSessionStats(): Promise<{
  calls: number; modelInput: number; uncachedInput: number;
  modelOutput: number; thinking: number; cached: number;
} | null> {
  if (!pool) return null;
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)                                                        AS calls,
        COALESCE(SUM(input_tokens)         FILTER (WHERE NOT is_mock), 0) AS model_input,
        COALESCE(SUM(uncached_input_tokens) FILTER (WHERE NOT is_mock), 0) AS uncached_input,
        COALESCE(SUM(output_tokens)        FILTER (WHERE NOT is_mock), 0) AS model_output,
        COALESCE(SUM(thinking_tokens)      FILTER (WHERE NOT is_mock), 0) AS thinking,
        COALESCE(SUM(cached_tokens)        FILTER (WHERE NOT is_mock), 0) AS cached
      FROM conversation_logs WHERE expires_at > NOW()
    `);
    const row = r.rows[0];
    return {
      calls:        parseInt(row.calls)         || 0,
      modelInput:   parseInt(row.model_input)   || 0,
      uncachedInput:parseInt(row.uncached_input) || 0,
      modelOutput:  parseInt(row.model_output)  || 0,
      thinking:     parseInt(row.thinking)      || 0,
      cached:       parseInt(row.cached)        || 0,
    };
  } catch (err) {
    console.error("[db] loadSessionStats failed:", err);
    return null;
  }
}
