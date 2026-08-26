import pg from "pg";
const { Pool } = pg;

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

const SCHEMA_SQL = `
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
);
CREATE INDEX IF NOT EXISTS idx_convlog_expires  ON conversation_logs (expires_at);
CREATE INDEX IF NOT EXISTS idx_convlog_ip       ON conversation_logs (ip, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_convlog_conv     ON conversation_logs (conversation_id);
`;

export async function initDb(): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(SCHEMA_SQL);
    console.log("[db] Schema ready");
    const { rowCount } = await pool.query("DELETE FROM conversation_logs WHERE expires_at < NOW()");
    if (rowCount) console.log(`[db] Pruned ${rowCount} expired rows on startup`);
  } catch (err) {
    console.error("[db] Init failed:", err);
  }
}

// Run every 6 hours to keep the table lean
export async function pruneExpired(): Promise<void> {
  if (!pool) return;
  try {
    const { rowCount } = await pool.query("DELETE FROM conversation_logs WHERE expires_at < NOW()");
    if (rowCount) console.log(`[db] Pruned ${rowCount} expired rows`);
  } catch (err) {
    console.error("[db] Prune failed:", err);
  }
}

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

export function isDbEnabled(): boolean {
  return pool !== null;
}
