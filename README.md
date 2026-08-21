# Yuzee AI Token Lab

A production-instrumented reference implementation demonstrating token optimization strategies for Gemini-powered career counseling AI.

## What it is

The Token Lab runs the same career guidance AI as production, but exposes every internal signal production hides: prompt token counts, cache hit rates, thinking budgets, compaction break-even math, and per-strategy context assembly. It answers "what did that conversation cost, and why?"

**Two backends, one design:**
- `server.ts` — Node.js/Express (port 3000) — the running system. Actually calls Gemini, receives real `usageMetadata`.
- `spring-backend/` — Spring Boot 3.4.3 + Spring AI 1.0.0 GA (port 8080) — same architecture in Java.

## Setup

### Node backend (required for the UI)

```bash
npm install
# create .env with GEMINI_API_KEY=your_key (see .env.example)
npm run dev
```

Open http://localhost:3000

### Spring backend (optional, standalone)

Requires Java 21 and Maven.

```bash
cd spring-backend
# set GEMINI_API_KEY in environment or application.yml
mvn spring-boot:run
```

Spring API at http://localhost:8080

## Key features

- **4 context strategies**: BASELINE / SLIDING_WINDOW / SUMMARY_RECENT / ADAPTIVE_HYBRID
- **Token-budget memory**: eviction enforced by tokens, not message count
- **Stable-prefix context ordering**: system prompt + career context always first — maximizes implicit caching
- **Thinking budget control**: 0 (minimal) → 1024 tokens, model-aware (Flash Lite gets reduced caps)
- **3-layer protocol validation**: JSON parse → schema v1.3 → semantic — rejected responses never enter context
- **Real `usageMetadata`**: prompt, output, thinking, and cached token counts from the provider
- **Compaction break-even economics**: tracks whether compaction pays off before triggering it

## Models

| Model | Family | Notes |
|---|---|---|
| gemini-3.6-flash | Flash | Default |
| gemini-3.5-flash | Flash | |
| gemini-3.5-flash-lite | Flash Lite | Fastest; reduced output budget |
| gemini-3.1-flash-lite | Flash Lite | |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes (live mode) | Gemini Developer API key |

Without `GEMINI_API_KEY`, the Node backend runs in offline mode with a deterministic response. The Spring backend serves a structured offline fallback.

## Protocol

Responses conform to `Yuzee_Response_Protocol_v1.3` (immutable). Every response carries `promptHash` and `schemaHash` for full traceability. Do not modify the protocol or schema files.
