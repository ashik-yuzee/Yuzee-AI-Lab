# Yuzee AI Token Lab — Full System Documentation

Everything a new developer needs to read the code: what each layer does, how a request
flows end to end, and which invariants must not be broken.

Companion docs: `README.md` (quick start), `HANDOVER/AI_HANDOVER.md` (acceptance criteria),
and the topic docs in `docs/` (BGE calibration, counselling prompt updates, warehouse design).

---

## 1. What this application is

A career-counselling chat product (**Oala**) plus a **token telemetry laboratory** wrapped
around it. It runs the same Gemini-powered counselling AI as production, but exposes every
internal signal production hides: prompt token counts, cache hit rates, thinking budgets,
context assembly per strategy, compaction break-even maths, validation results, and latency
timelines.

Three things are happening at once in every turn:

1. **A counselling conversation.** Gemini answers under a versioned system prompt and must
   return a single JSON object conforming to **Response Protocol v1.3**.
2. **A context-engineering experiment.** The server decides what history, memory and
   retrieved data enter the prompt, under a token budget, using a selectable strategy.
3. **A measurement harness.** Real `usageMetadata` from the provider is recorded per turn,
   logged to NDJSON and optionally PostgreSQL, and surfaced in the UI.

Two backends implement the same design:

| Backend | Path | Port | Status |
|---|---|---|---|
| Node.js / Express / TypeScript | `server.ts` | 3000 | The running system. Serves the React UI and all APIs. |
| Spring Boot 3.4 + Spring AI | `spring-backend/` | 8080 | Standalone Java reference of the same architecture. Not used by the UI. |

---

## 2. Technology stack

**Frontend** — React 19, TypeScript, Vite 6, Tailwind CSS v4, `lucide-react` icons,
`react-markdown` + `remark-gfm`, `motion`. Runs an ONNX embedding model in a Web Worker via
`@huggingface/transformers`.

**Backend** — Node 22+, Express 4, `@google/genai` (Gemini SDK), `ajv` (JSON Schema),
`pg` (optional PostgreSQL), `tsx` for dev, `esbuild` to bundle `dist/server.cjs` for production.

**Storage** — in-memory `Map` is the hot store; JSON files under `data/` are the default
durable store; PostgreSQL is optional and takes over when `DATABASE_URL` is set. A SQLite
catalogue (the "warehouse") is read out-of-process by a forked worker.

---

## 3. Repository map

```
server.ts                      Entire Node backend (~2500 lines): routes + chat pipeline
api/index.ts                   Vercel serverless entry — requires dist/server.cjs
index.html                     Vite HTML entry
vite.config.ts                 Build + dev proxy (/api -> :3000)
vercel.json / render.yaml      Deployment configs
tsconfig.json                  noEmit type-check config

src/
  main.tsx                     React root; monkey-patches fetch to inject the auth token
  App.tsx                      Auth gate, page switch, provider tree, modal mounting
  index.css                    Tailwind entry + CSS custom properties (--accent etc.)
  types.ts                     Shared frontend types (Conversation, ChatMessage, ...)
  shared-settings.ts           Deployment-wide settings persisted to data/shared-settings.json

  context/TokenLabContext.tsx  Single global React store: conversations, streaming, telemetry, modals

  services/                    Backend + frontend service layer
    api.ts                       Frontend HTTP/SSE client
    YuzeeRequestAssembler.ts     Builds the Gemini request (system instruction, contents, config)
    TokenBudgetMemoryManager.ts  Context strategies, turn grouping, token-budget eviction
    MultiTurnRequestBuilder.ts   Converts memory into Gemini Content[] role turns
    SystemPromptCacheManager.ts  Gemini explicit context cache per model
    db.ts                        PostgreSQL schema/queries with local-JSON fallback
    LocalConversationStore.ts    Atomic JSON file store used by several subsystems
    MicroToolRouter.ts           Frontend facade over the embedding Web Worker
    TeachingAnswerReview.ts      Second-pass review of explanation blocks
    ReviewRetry.ts               Bounded retry wrapper with audit trail
    ProviderRecovery.ts          One-shot provider stream retry
    HelpEvidence.ts              Student-loan/help evidence guard

  protocol/
    validator.ts                 3-layer validation (Ajv schema -> semantics -> trusted actions)
    securityOverride.ts          Server-authoritative security state
    presentationDefaults.ts      Fills presentation fields the model omitted
    v1.3/                        Canonical protocol TS type, JSON Schema, counsellor prompts
    v1.4/                        Next protocol revision (types + schema, validated but not default)

  routing/                     Local semantic routing (BGE embeddings, in-browser)
    models.ts, policy.ts, bge*.ts, skillSuggestions.ts, turnNeeds.ts, learningDepth.ts,
    skillInputs.ts, tokenBudget.ts, EmbeddingQueue.ts, microtools.json, bgeCalibration.json
  workers/embedder.worker.ts   The Web Worker that runs the ONNX encoder

  prompts/                     Instruction fragments concatenated into the system prompt
  objectives/                  "Workspace" activities (316 catalogue) — service, routing, UI
  warehouse/                   Approved course/career/job catalogue retrieval + UI
  miniPathway/                 Optional generated mini career pathway
  research/                    "Explore more" grounded detail research
  orchestration/               Shared conversation context, question ownership, action registry
  oala/                        @Oala mention handling and service knowledge
  ux/                          Presentation helpers, stream progress copy, bypass copy
  components/                  All React UI
  data/models.ts               Gemini model registry + cost calculation

spring-backend/                Java reference implementation (60 classes)
tests/                         Node test files (tsx loader, assert-based)
scripts/                       Calibration, audit, build-check and evaluation scripts
qa/                            Objective workbook registry, schema compiler, harness
data/                          Runtime state (gitignored): conversations, logs, stats
docs/                          This file and topic-specific design notes
```

---

## 4. Running it

### Prerequisites

Node 22+ (Node 26 used for the last clean check), npm 11+. Java 21 + Maven only for the
Spring backend.

### Setup

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

`npm run dev` runs Express **and** Vite in middleware mode from the same process, so port
3000 serves both the API and the UI with HMR. The Vite dev-server proxy block in
`vite.config.ts` only matters if you run `vite` standalone.

Sign-in uses `ADMIN_USERNAME` / `ADMIN_PASSWORD` from the environment only (no defaults in code; sign-in is disabled until both
are set).

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes for live mode | All Gemini calls. Without it, chat returns an `AUTH_ERROR` SSE event. |
| `DATABASE_URL` | No | PostgreSQL. When unset, everything persists to `data/*.json`. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Yes | Login credentials (environment only; sign-in is disabled without them). |
| `AUTH_SECRET` | Recommended | HMAC secret for the stateless auth token (derived from the password when unset). |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | No | Enables the Llama-3.1-8b server-side routing model option. |
| `YUZEE_WAREHOUSE_DB` | No | Path to the SQLite catalogue. Defaults to `~/.yuzee-monitor/training_gov.db`. |
| `PORT` | No | Default 3000. |
| `NODE_ENV` | No | `production` switches from Vite middleware to static `dist/public`. |
| `VERCEL` | No | Set by Vercel. Suppresses `app.listen` and shortens the response timeout to 8.5 s. |
| `SKIP_BGE_CONTRACT` | No | Skips the BGE contract check during build (model files are gitignored). |
| `DISABLE_HMR` | No | Disables Vite HMR and file watching. |

### Build and production

```bash
npm run build
```

Build order: quiz-prompt check → BGE contract check → objective catalogue checks →
`tsc --noEmit` → `vite build` (to `dist/public`) → `esbuild server.ts` (to `dist/server.cjs`)
→ copy the warehouse `.cjs` workers into `dist/`. The build is deliberately gated: it fails
if the quiz prompt, BGE routing artifact or objective catalogue are out of sync with their
generators.

```bash
npm start
```

### Test scripts

Tests are plain Node scripts using `assert`, run through the `tsx` loader — no test framework.

```bash
npm run lint
```

```bash
npm run test:ux
```

```bash
npm run test:routing
```

```bash
npm run test:bge
```

```bash
npm run test:mini-pathway
```

```bash
npm run test:warehouse
```

```bash
npm run test:objectives
```

Slower jobs: `npm run eval:bge` (held-out evaluation, downloads the model) and
`npm run calibrate:bge` (regenerates `bgeCalibration.json`).

---

## 5. The chat request lifecycle (end to end)

This is the single most important flow. Endpoint:
`POST /api/conversations/:id/messages` — `server.ts:1607`.

### 5.1 Browser side, before the request

`TokenLabContext.sendMessage()` (`src/context/TokenLabContext.tsx:517`):

1. **Send lock.** `sendLockRef` plus `isStreaming` prevent concurrent turns.
2. **Normalise input.** Input is either a plain string, a `UserEvent` (an option click, form
   submit, ranked choice), or a `{message, userQuestionAnswers}` clarification payload. A
   readable chat-bubble label is synthesised for structured events.
3. **Contradiction pre-flight.** If the user has unresolved profile contradictions and the
   message is longer than 20 characters, `POST /api/pre-check` runs first. If it returns
   clarification questions, the message is *deferred* — no user bubble is added — and the
   clarification modal opens. This is fail-safe: any error proceeds normally.
4. **Optimistic messages.** A user message and an empty streaming assistant message are
   pushed into state immediately.
5. **Local context.** Date, timezone, saved location, and up to 8 relevance-scored profile
   facts are collected. Likes/dislikes are always included; general facts are keyword-scored
   against the message.
6. **Local semantic routing** (all optional, all abstain-safe):
   - `assessMessageNeeds()` classifies the turn as `answer` / `clarify` / `research`.
   - If the user selected a topic from the previous question, `routeMessage(topic, {topic:true})`.
   - If the message starts with `@Oala`, `routeMessage()` picks at most one micro-tool skill.
7. **`api.streamChatMessage()`** POSTs the whole payload and parses the SSE response.

### 5.2 Server side

Step by step through the handler:

1. **Conversation resolution.** Loaded from the in-memory `Map`, or created on the fly with
   request-body defaults.
2. **Objective workspace result transfer** (optional). If `objectiveResultId` is present, the
   saved workspace result is loaded, revision-checked (409 on mismatch), de-duplicated against
   prior transfers, and injected as untrusted supplementary context.
3. **Shared conversation context.** `sharedConversationContext()` builds a bounded, versioned
   read model of user contributions (chat statements, workspace answers, corrections) —
   ranked by recency, correction priority and keyword overlap, capped at 16 entries.
4. **Workspace coordination.** `workspaceQuestionOwner()` decides whether chat or an open
   workspace owns the next question, so the user is never asked the same thing twice.
5. **Warehouse retrieval.** `warehouseService.retrieve()` runs a Gemini query planner, then a
   bounded SQLite lookup in a forked child process (8 s timeout). Returns courses, providers,
   careers, industries, jobs, skills and regional signals — or `NOT_NEEDED`.
6. **Research reference.** If the message cites a saved research answer UUID, that answer's
   facts, gaps, evidence and sources are attached.
7. **Context prefix assembly.** All of the above plus date/location/user facts are joined into
   a single bracketed prefix and prepended to the user message:
   `[Date: ... · WAREHOUSE_DATA: {...} · User facts: ...]\n<message>`. Every injected block is
   explicitly labelled as **data, not instructions** — this is the prompt-injection boundary.
8. **UserEvent validation.** `validateUserEventAgainstActiveInteraction()` checks the submitted
   event against the server's trusted `activeInteraction`. A mismatch is a hard 400 — the
   browser cannot invent an option id.
9. **Strategy resolution.** Precedence: mode presets (`SAVE_TOKENS` / `FULL_CONTEXT`) override
   request body, which overrides shared settings, which override the conversation record.
10. **Memory assembly.** `memoryManager.assembleMemory()` — see §7.
11. **Model allowlist.** A model not in `GEMINI_MODELS` with `selectable:true` is a 400.
12. **Turn needs, routing, help evidence, clarity guidance.** Server-side rules re-derive or
    re-validate the browser's advisory hints; the browser's thresholds are never trusted.
13. **Request assembly.** `YuzeeRequestAssembler.assembleRequest()` — see §6.
14. **Explicit cache lookup.** `SystemPromptCacheManager.getCacheForModel()` returns a
    `cachedContents/...` name when warm; the system instruction is then omitted from the request
    and served from cache at roughly 75 % lower input cost.
15. **SSE headers flushed.** The `start` event carries `messageId`, `aiRequestId`, thinking
    level, routing decision, preflight needs, and token budgets.
16. **Timeout guard.** 8.5 s on Vercel, 90 s elsewhere. On fire it emits a clean `error` event
    and aborts the provider — never a silent socket drop.
17. **Bypass path.** Greetings, farewells, idle chatter and basic @Oala service questions are
    answered locally from `makeBypassResponse()` at **zero provider tokens**. A message is only
    bypassed when there is no prior assistant turn and no active question.
18. **Provider stream.** `generateContentStream` with abort signal and `includeThoughts` on
    3.x/2.5 models. Each chunk is split by `splitGeminiStreamChunk()` so *thought summaries
    never reach the client* — they only flip the status phase to `thinking`. Text chunks are
    emitted as `delta` events.
19. **JSON recovery.** Flash-Lite sometimes wraps JSON in markdown fences; these are stripped
    and parsing retried.
20. **Teaching review** (conditional). When the response contains substantive teaching content,
    a second bounded Gemini call re-checks the explanation blocks against the context. It may
    rewrite `content_blocks` only — never `interaction` or `service` state. Usage from both
    calls is combined. Failure withholds the answer with a retry message.
21. **Help-evidence guard.** An answer asserting outdated student-loan repayment rules is
    withheld outright.
22. **Server-authoritative security state.** `normaliseSecurityFields()` coerces the model's
    nullable output; `computeNextSecurityState()` derives breach count and penalty **without
    reading model output**; `applyServerSecurityState()` writes them back. The model cannot
    clear its own penalty.
23. **3-layer validation.** `validateProtocol()` — see §8.
24. **Render gate.** `canRender` requires: no teaching-review error, no `MAX_TOKENS`
    truncation, valid JSON, and `protocolAccepted`. Only then do `validation`,
    `protocol_response` and `structured` events fire. Otherwise a
    `protocol_validation_error` event is sent and **the response never enters conversation
    history** — a rejected answer cannot poison the next turn's context.
25. **`activeInteraction` update.** Only updated when the protocol is fully accepted.
26. **Telemetry computation.** Timeline (pre-provider latency, TTFT, generation duration,
    validation duration, total), token accounting (see §9), context breakdown, request trace.
27. **Persistence.** User and assistant messages are appended to the conversation, saved to the
    store, and fire-and-forget logged to PostgreSQL and `data/token-log.ndjson`.
28. **`usage` then `done` events.**
29. **Async post-response compaction.** Evicted turns are summarised by
    `gemini-3.5-flash-lite` *after* the response is closed — zero latency impact — and the
    resulting summary is stored for the next turn.

### 5.3 SSE event contract

| Event | Payload | Meaning |
|---|---|---|
| `start` | ids, thinking level, routing, preflight, budgets | Turn accepted |
| `status` | `{phase}` | `routing`/`waiting`/`thinking`/`receiving`/`retrying`/`reviewing`/`checking` |
| `compaction` | `CompactionMetrics` | Turns were evicted this request |
| `delta` | string | Raw JSON text chunk |
| `validation` | schema/semantic/accepted, errors, warnings, hashes | Response passed |
| `protocol_response` / `structured` | the parsed v1.3 object | Renderable answer |
| `protocol_validation_error` | errors, finishReason, reviewFailureCode | Answer withheld |
| `usage` | usage, model, contextMetrics, compactionMetrics, timeline | Telemetry |
| `error` | `{error, errorCode}` | Terminal failure |
| `done` | `{aiRequestId}` | Stream complete |

Error codes: `AUTH_ERROR`, `QUOTA_EXHAUSTED`, `RATE_LIMIT`, `PROVIDER_BUSY`,
`PROVIDER_ERROR`, `RESPONSE_TIMEOUT`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, plus client-side
`NETWORK_ERROR`, `INVALID_RESPONSE`, `INCOMPLETE_RESPONSE`.

---

## 6. Request assembly — `YuzeeRequestAssembler`

A singleton (`getInstance()`) that owns the authoritative prompt and schema.

**On construction it loads and hashes:**

- `src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.11.md` — the counsellor system prompt
  (path and version come from `src/prompts/quizPrompt.ts`).
- `src/protocol/v1.3/Yuzee_Response_Schema_v1.3.json` — the response schema.
- `src/prompts/activity-context.md` + `clear-guidance.md` + `learning-depth.md` — experience
  rules appended when a custom system prompt is in use.

SHA-256 hashes of both are exposed as `promptHash` / `schemaHash` and travel with every
response for traceability. `reload()` re-reads from disk (admin-only endpoint).

**`assembleRequest()` produces:**

1. **System instruction** — the prompt file, or a custom prompt plus experience rules, plus an
   optional `oalaInstruction`. It is *never* copied into `contents`.
2. **Dynamic context**, in stable-prefix order: structured memory capsule → previous
   conversation summary → recent dialogue turns. This ordering is deliberate: the stable parts
   come first so Gemini's implicit prefix cache hits as often as possible.
3. **Current user input** — raw text for plain messages, or a `USER_EVENT:` JSON block for
   structured interactions. Plain text is sent raw on purpose: wrapping it in `USER_EVENT`
   made the model treat the turn as a UI continuation and suppress discovery content.
4. **Micro-tool instruction** appended after the user input — the optional routed skill's
   `mini_prompt`, needs instruction, help evidence, clarity guidance, warehouse rules and
   objective continuation, joined with blank lines.
5. **`contents`** — either a single concatenated string, or (when `useMultiTurn`, the default
   from the client) a proper `Content[]` of alternating `user`/`model` roles built by
   `MultiTurnRequestBuilder`.
6. **`geminiConfig`** — `maxOutputTokens` (65536), optional `temperature`/`topP`, thinking
   config, and — only when `useStructuredOutput` is on — `responseMimeType: 'application/json'`
   plus the sanitised response schema.

**Schema sanitisation.** Gemini's `responseSchema` is a proto-defined subset of JSON Schema.
`sanitizeSchemaForGemini()` whitelists `type, description, format, nullable, enum, properties,
required, items, anyOf` and drops everything else. Integer/number enums are dropped entirely.
When `""` was a valid enum value it is removed and the field marked `nullable` — which is why
the server must later coerce nulls back to canonical defaults. The Ajv copy used for
validation is untouched.

**Thinking resolution.** `resolveThinkingConfig()` maps a level to a numeric budget
(`minimal:0, low:128, medium:512, high:1024` — capped at 128 on Flash-Lite). `adaptive` uses a
zero-latency local keyword classifier: comparison/planning words → medium, career/guidance
words → low-or-medium, greetings and very short inputs → minimal. The level is then clamped to
what the model registry says the model supports (Gemini 3.7 Flash has no `minimal`). Budget 0
omits `thinkingConfig` entirely — sending `thinkingBudget: 0` is an `INVALID_ARGUMENT`.
Gemini 3.x uses `thinkingLevel` strings; 2.5 uses `thinkingBudget` integers; the mechanism
comes from `ModelCapabilityInfo.thinkingMechanism`.

**`classifyUserMessage()`** returns `greeting` / `farewell` / `idle` / `rubbish` / `career`.
It short-circuits to `career` whenever there is an ongoing conversation or an active question —
it is a bypass classifier, not the semantic router, and must never gate understanding. Only
empty or symbol-only input counts as `rubbish`; acronyms, numbers and non-Latin text are all
routed to Gemini.

---

## 7. Memory and context strategies — `TokenBudgetMemoryManager`

**Token estimation.** `estimateTokens()` is a local approximation:
`ceil(chars × 0.26 + words × 0.15)`. Exact counts come from `ai.models.countTokens` and are
cached separately from estimates in two bounded LRU maps — an estimate never masquerades as an
exact count, and the `sources` field in every telemetry payload says which was used.

**Turn grouping.** `groupIntoTurns()` pairs each user message with its assistant reply into an
atomic `DialogueTurn`. Eviction is whole-turn — you never get a user question in context with
its answer missing. **Rejected assistant responses are dropped from the turn**, so an invalid
answer contributes only the user's question to future context.

**Assistant compaction for context.** `formatAssistantMessageForContext()` converts stored
Protocol v1.3 JSON into compact plain text (`[Mode: ... | Intent: ...]` plus headings, block
text, list items and the question asked). Raw protocol JSON is never re-fed into context.

**The four strategies:**

| Strategy | Behaviour |
|---|---|
| `BASELINE` | Keep every turn verbatim. No eviction, no summary. The control condition. |
| `SUMMARY_RECENT` | Newest-first fill under the token budget and turn count; evicted turns become a summary. |
| `ADAPTIVE_HYBRID` (default) | Same eviction loop, but paired with the structured memory capsule and a real LLM summary produced asynchronously after each turn. |
| `SEMANTIC_EVIDENCE` | 3-turn recency anchor is always kept, then remaining budget is filled with keyword-relevance-scored historical turns (stop-word-filtered, sqrt-dampened), merged and re-sorted chronologically. |

The most recent turn is guaranteed to survive even if it alone exceeds the budget — otherwise
the model would have no conversational context at all.

**Compaction economics.** Every eviction produces `CompactionMetrics`: source tokens, summary
tokens, tokens removed, compaction input/output cost, net savings per turn, and
**break-even turns** (`cost / savings`). These are marked `isSimulated: true` when derived from
the model rather than from a real summariser call. The real summariser is
`summarizeEvictedTurns()` in `server.ts`, which runs post-response on `gemini-3.5-flash-lite`
and produces structured bullets (Goal / Background / Constraints / Decisions / Progress / Open),
omitting any field without explicit evidence.

---

## 8. Protocol v1.3 and validation

### The envelope

Every accepted response is one JSON object (`src/protocol/v1.3/Yuzee_Response_Protocol_v1.3.ts`):

```ts
{
  schema_version: "1.3",
  current_mode: "A_CONVERSATION" | "B_DELIVERY" | "S_SERVICE_HANDOFF" | ...,
  response_intent: "ACTION_PLAN" | "GENERAL_DELIVERY" | "SOCRATIC_DIRECTION" | ...,
  content_blocks: YuzeeContentBlock[],   // the visible answer
  interaction:    YuzeeInteraction,      // question / handoff / none
  service_trigger:{...},                 // service intent + registered actions
  rmo_readiness:  {...},                 // readiness + missing inputs
  state:          {...},                 // response mode, confidence, progress, security
  followups:      {...}                  // optional timed follow-up triggers
}
```

**Block types:** `heading, text, list, steps, table, comparison, callout, key_value, cards,
timeline, flow, pathway_map, scorecard, chart, progress, checklist`. Each carries
`id, type, level, variant, title, text, items[], columns[], rows[]` and an optional `data`
object for v1.4 extensions.

### `validateProtocol()` — three layers

**Layer 1 — schema.** Ajv compiled against `Yuzee_Response_Schema_v1.3.json`, plus explicit
envelope assertions (`schema_version === "1.3"`, `content_blocks` is an array, the five
required objects exist). Schema failure short-circuits; semantics are not evaluated.

**Layer 2 — semantic invariants.** These encode the counselling contract:

- **Rule #10** — the first content block must be `type:"text"`, `level:"none"`, `title:""`.
  The answer always opens with plain prose, never a heading.
- `ranked_select` requires 3–6 options.
- `recommended_actions` must be empty when `interaction.kind` is `question` or `handoff` —
  you cannot offer an action while blocking on an answer.
- Confidence consistency: `score === -1` forces `band:"unknown"` and
  `evidence_strength:"none"`; otherwise 0–39 → `low`, 40–69 → `medium`, 70–100 → `high`.
- Display invariants via `validateDisplayInvariants()`.
- A security penalty with zero breaches is a **warning**, not an error — the content still renders.

**Layer 3 — trusted actions.** Any `action_id` not present in `TRUSTED_SERVICE_ACTIONS`
(`src/orchestration/serviceActions.ts`) produces a security warning. The model cannot invent
executable actions.

`protocolAccepted = schemaValid && semanticValid`. Warnings never block rendering; errors always do.

**v1.4** (`validateProtocolV14`) adds `rmo_readiness` as a required envelope member and extra
rules for the new block types — duplicate `flow` node ids, dangling edge endpoints, duplicate
`pathway_map` lane ids. It is validated but is not the default wire format.

### Security override

`src/protocol/securityOverride.ts` is the reason the model cannot escalate its own privileges:

- `normaliseSecurityFields()` — coerces the nulls Gemini's nullable schema permits back to
  canonical defaults.
- `computeNextSecurityState(currentCount, authoritativeBreachDelta = 0)` — **never reads model
  output**. Breach count changes only on explicit server events.
- `applyServerSecurityState()` — writes the server's values over whatever the model claimed.

### Service action execution

`POST /api/conversations/:id/actions/:actionId/execute` deliberately never executes anything.
Unregistered actions → 400. Registered but not connected in the lab → a truthful "not
connected" response. Registered and connected → **501**, because connectivity metadata is not
evidence of a completed provider operation. No fake success is ever reported.

---

## 9. Token accounting and telemetry

### Per-turn usage

Extracted from Gemini's `usageMetadata`, with explicit provenance:

- `inputTokens` — `promptTokenCount` (gross: cached + uncached).
- `outputTokens` — `candidatesTokenCount`.
- `thinkingTokens` — `thinkingTokenCount`/`thoughtsTokenCount` when explicit, otherwise derived
  as `total − prompt − candidates` when positive, otherwise `null`.
- `cachedTokens` — `cachedContentTokenCount`, reported **only** when non-null and non-zero.
- `uncachedInputTokens = inputTokens − cachedTokens`.
- `totalTokens = uncachedInput + output + thinking`. The provider's `totalTokenCount` is
  deliberately **not** used, because it counts cached tokens in the input sum and would
  overstate quota consumption.

Every number carries a `sources` entry: `provider` / `estimate` / `countTokens` / `simulated` /
`bypass` / `unavailable`. Nothing is presented as measured when it was guessed.

### Timeline

`requestReceivedAt`, `preProviderLatencyMs`, `conversationLoadMs`, `userEventValidationMs`,
`memoryAssemblyMs`, `requestAssemblyMs`, `providerTtftMs`, `providerGenerationDurationMs`,
`validationDurationMs`, `totalLatencyMs`. The clock starts on line 1 of the handler, so
pre-provider work is honestly attributed.

### Aggregates

- **Session stats** — cumulative counters in memory, mirrored to `data/session-stats.json` and
  rehydrated from PostgreSQL on boot. Derived: cache hit ratio, net savings percentage against
  an estimated baseline, averages per turn. Resettable.
- **Utility stats / whiteboard stats** — separate counters for the cheap helper models so
  helper spend never contaminates chat telemetry.
- **`data/token-log.ndjson`** — append-only, one JSON line per provider call, never truncated.
  Used for daily cost and the log viewer.
- **Lifetime stats** — non-resettable all-time totals from PostgreSQL.
- **Daily cost warnings** — the client polls `/api/tokens/daily-cost` after each turn and warns
  once each at $1/$5/$10, then on every turn above $15.

Costs come from `calcTurnCost()` in `src/data/models.ts` using per-model
`inputPricePerMToken` / `outputPricePerMToken` / `cachedReadPricePerMToken`.

---

## 10. Backend HTTP API reference

Everything under `/api` requires `Authorization: Bearer <token>` except `/api/auth/*` and
`/api/db-status`. Auth is a stateless HMAC-SHA256 of `username:password` keyed by
`AUTH_SECRET`, so tokens survive restarts and there is no session store. Rate limits are
per-IP, per-limit-bucket, 1-minute windows, in memory.

### Auth and health

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | Returns `{token}` |
| POST | `/api/auth/logout` | Client-side clear only |
| GET | `/api/auth/check` | Returns `{authenticated}` |
| GET | `/api/db-status` | DB enabled + ping |

### Config and protocol

| Method | Path | Notes |
|---|---|---|
| GET | `/api/config/capabilities` | Model registry, defaults, feature flags |
| GET | `/api/protocol/info` | Prompt/schema versions and hashes |
| GET | `/api/system-prompt` | Prompt content, hash, bytes, filename |
| POST | `/api/system-prompt/reload` | Admin only; re-reads from disk |
| GET/PUT | `/api/shared-settings` | Deployment-wide prompt mode + retention defaults |
| POST | `/api/shared-settings/reset-prompt` | Back to the default prompt |

### Conversations

| Method | Path | Rate | Notes |
|---|---|---|---|
| GET | `/api/conversations` | — | DB-backed when available, merged with in-flight |
| POST | `/api/conversations` | — | Creates; in-memory store capped at 500 (LRU by `updatedAt`) |
| POST | `/api/conversations/load-demo` | — | Seeds the cybersecurity demo conversation |
| GET/PUT/DELETE | `/api/conversations/:id` | — | PUT filters the body to an allowlist of fields |
| POST | `/api/conversations/restore` | — | Rehydrates from a localStorage backup after a restart |
| POST | `/api/conversations/:id/messages` | 20/min | **The chat pipeline (SSE)** |
| POST | `/api/conversations/:id/generate-title` | 10/min | 4–6 word title from the first exchange |
| POST | `/api/conversations/:id/feedback` | — | Per-message quality feedback |
| POST | `/api/conversations/:id/reset-memory` | — | Clears summary and compaction history |
| POST | `/api/conversations/:id/actions/:actionId/execute` | — | Registry check only; never executes |

### Telemetry

| Method | Path | Notes |
|---|---|---|
| POST | `/api/tokens/count` | Pre-flight breakdown; `fastEstimate:true` for local estimation while typing |
| GET | `/api/tokens/session-stats` | Cumulative session counters + derived ratios |
| POST | `/api/tokens/session-reset` | Zeroes session counters |
| GET | `/api/tokens/utility-stats` | Whiteboard + utility model spend |
| GET | `/api/tokens/log` | Last 500 NDJSON entries |
| GET | `/api/tokens/lifetime-stats` | All-time totals |
| GET | `/api/tokens/daily-cost` | DB first, NDJSON fallback |
| POST | `/api/benchmark` | 10/min. Modelled estimate or live Gemini per strategy |

### Helper models (all Flash-Lite, all fail-safe)

| Method | Path | Rate | Returns on failure |
|---|---|---|---|
| POST | `/api/extract-profile-facts` | 30/min | `{facts: []}` |
| POST | `/api/detect-contradictions` | 20/min | `{contradictions: []}` |
| POST | `/api/pre-check` | 30/min | `{needsClarification: false}` |
| POST | `/api/routing/llm` | 30/min | 503 when Cloudflare is unconfigured |

### Pathway whiteboard

| Method | Path | Rate | Model |
|---|---|---|---|
| POST | `/api/pathway/generate` | 20/min | `gemini-3.7-flash` — full phased roadmap graph |
| POST | `/api/pathway/recommend` | 30/min | Flash-Lite — 3 next-step suggestions |
| POST | `/api/pathway/explain` | 30/min | `gemini-3.7-flash` — per-node Q&A |
| GET | `/api/pathway/stats` | — | Whiteboard token counters |

The generator supports four styles — `structured`, `project-driven`, `fast-track`,
`self-paced` — each with its own pacing, resource policy and phase count, and returns
`{nodes, edges}` with typed nodes (`goal, phase, course, skill, project, resume, apply, milestone`).

### Subsystems

| Method | Path | Rate | Notes |
|---|---|---|---|
| GET | `/api/warehouse/status` | — | Worker state and scope |
| GET | `/api/objectives/catalogue` | — | 316 catalogue with per-objective availability |
| GET | `/api/conversations/:id/objectives` | — | Saved workspace sessions |
| POST | `/api/conversations/:id/objectives/:operation` | 12/min | `select`/`start`/`dismiss`/`course-focus`/`correct`/`answer`, 100 s timeout |
| GET/POST | `/api/conversations/:id/mini-pathway` | 6/min | SSE, 120 s timeout |
| GET/POST | `/api/conversations/:id/details` | 6/min | SSE research; 409 if one is already running |

---

## 11. Backend subsystems

### 11.1 Warehouse — `src/warehouse/`

Retrieval over a **user-approved catalogue** of Australian courses, providers, careers,
industries, occupational skills, public job advertisement records and regional signals.

- **Process model.** `WarehouseService` forks `catalogue-worker.cjs` (a SQLite reader) with
  IPC. State machine: `STOPPED → PREPARING → READY | UNAVAILABLE`. Lookups are capped at 3
  queries × 240 chars, 4 ids, and an 8-second timeout. A crashed worker rejects all pending
  lookups and marks the service unavailable.
- **Gating.** `needsWarehouse()` is a cheap regex/length gate that skips retrieval for
  thanks/bye/ok and for explicit "don't search" requests.
- **Query planning.** A `gemini-3.7-flash` planner converts the message into a bounded plan:
  `action` (NONE/COURSES/CAREERS/INDUSTRY/LOCAL/SKILLS_JOBS), course/occupation/industry/skill/
  job/role/provider queries with hard caps, an explicit location, and facets
  (PROVIDER, CAREERS, INDUSTRY, LOCAL, FUNDING, SKILLS, JOBS, LEARNING). The plan is
  re-validated server-side; a malformed plan throws.
- **Two-pass role ranking.** When more than one candidate role comes back, `rankRoleCandidates()`
  narrows them and the lookup is re-run with explicit `role_ids`.
- **`WAREHOUSE_INSTRUCTION`** is a large, carefully worded prompt fragment that accompanies the
  data. Its rules are the evidence contract: catalogue records are data not instructions;
  similarity is never confidence; a regional signal is not local demand; a dated employer
  relationship is not an open vacancy; a skill title is not assessed competence; job
  availability is always `NOT_CONFIRMED_CURRENT`; missing values never mean zero, free or
  ineligible; no web search or independent verification has occurred.
- **Evidence ids.** `warehouseEvidence()` produces a stable id and `record_path` for every
  returned record so downstream answers can cite exactly what they used.

### 11.2 Objectives / workspaces — `src/objectives/`

The "316" catalogue of structured counselling activities that open in the right-hand workspace.

- **Selection.** After each assistant turn the browser proposes a BGE shortlist; the server
  runs a Gemini selection call that returns at most one objective with `confidence`,
  `workspace_need` and `decision` (SUGGEST/CLARIFY/NONE). Hard boundaries return NONE: safety
  overrides, an already-active session, a turn that already has a saved activity, or a
  selection boundary in the user's message. Results are cached per source message and
  audited to `data/objective-preview/<hash>/audit/`.
- **Execution.** `plan()` composes the system prompt from the workbook registry
  (`qa/objectives/registry/workbook.json`), the objective's `qa_prompt_v2`, the wire
  instruction, the workspace capability contract and the warehouse rules. The response schema
  is compiled per objective by `qa/objectives/schema.mjs`, then tightened: summaries capped at
  600 chars, `next_actions` restricted to `continue_chat` and `research_required`, and
  `evidence_refs` bound by enum to ids that actually exist in the context.
- **Provider call.** `callObjectiveModel()` posts to the Gemini **Interactions** API with
  `store:false`, a fixed seed, and API-key redaction in any surfaced provider message.
- **Persistence.** One JSON file per session under a hashed conversation folder, written
  atomically via temp-file + rename with `0600` permissions.
- **Handoff.** A completed workspace result can be transferred into chat exactly once
  (`markHandedOff`), guarded by revision checks and an in-flight transfer set.

### 11.3 Mini pathway — `src/miniPathway/`

An optional short career pathway generated after a qualifying turn, streamed block by block.

`decideMiniPathway()` combines three signals: the accepted response, a BGE pathway relevance
hint (calibrated, versioned), and the model's own `user_confidence.score`. Below the threshold
of 40 and not already helped → `automatic`; otherwise `offer`; boundaries → `none`.
`validateMiniPathwayOutput()` enforces that the pathway is `B_DELIVERY` with **no question,
no recommended actions, no service trigger, no followups** — it must not hijack the conversation.

### 11.4 Detail research — `src/research/`

"Explore more": a grounded, separate specialist that answers one scoped follow-up question
about a course, career or study option using Google Search grounding.

- Requires a parent assistant message whose protocol validated.
- One concurrent research per conversation (409 otherwise), 120 s timeout, SSE progress.
- 15-minute cache keyed on parent message, target, question, study year and location.
- Status is one of `answered` / `partial` / `no_evidence` / `needs_clarification`. Every fact
  cites evidence ids and is labelled `source_backed` (the excerpt supports it — *not*
  independently verified), `inference`, or `benchmark`.
- Provider errors are never surfaced raw; only an allowlisted set of safe messages passes
  through, because raw errors can contain request credentials.

### 11.5 Orchestration — `src/orchestration/`

- `sharedContext.ts` — the versioned read model of user contributions described in §5.2.
  It explicitly refuses to promote model inference to fact; every entry is
  `evidence_status: USER_REPORTED`, `scope: CONVERSATION_ONLY`.
- `questionOwner.ts` — decides whether chat or a visible workspace owns the next question.
- `serviceActions.ts` — the trusted action registry (`TRUSTED_SERVICE_ACTIONS`).
- `workspacePresence.ts` — which workspace the browser currently shows, re-validated server-side.

### 11.6 @Oala — `src/oala/`

`parseOalaMention()` only activates on an explicit leading `@oala` (quoted mentions, email
addresses and older turns do not count). When active, the server reads the Yuzee service list
out of the prompt, builds an Oala instruction listing only enabled and connected action ids,
and — for simple service questions — answers locally via `oalaBasicAnswer()` at zero provider
cost.

### 11.7 Teaching review and provider recovery

- `TeachingAnswerReview.ts` — `shouldReviewTeaching()` decides whether a second pass is
  warranted; `applyReviewedBlocks()` merges only `content_blocks`; `combineGenerationUsage()`
  sums usage across both calls so telemetry stays honest.
- `ReviewRetry.ts` — bounded retry with a `ReviewAudit` (`attempts`, `failures[]`) attached to
  the validation result and logged.
- `ProviderRecovery.ts` — one retry of the provider stream, surfacing a `retrying` status to
  the user. SDK-level retries are disabled (`retryOptions:{attempts:1}`) so a 503 cannot hide
  behind a silent internal retry until timeout.

### 11.8 EXP-RAG — `src/rag/`

An experimental mode that replaces the full counsellor prompt with a short cached core plus
per-turn retrieval: verbatim v1.11 guidance modules, warehouse evidence (typed-lookup chunks fused
with a local BGE + FTS5 catalogue index) and a rolling conversation summary. Full design, numbers
and operations: `docs/EXP-RAG.md`.

### 11.9 Warehouse intelligence — `src/intelligence/` + `workers/intelligence/`

Port of Yuzee Dev's Neo4j graph and TimesFM forecasts. A Docker worker exports the SQLite
warehouse, evaluates the 45 monthly IVI series (pinned TimesFM 2.5 vs baselines on holdouts),
projects every row into a generation-versioned Neo4j graph and writes `data/intelligence/current.json`.
After a READY warehouse lookup, every mode gets bounded graph links and (for outlook questions)
freshness-checked forecasts in `WAREHOUSE_DATA.intelligence`; without Neo4j it is a no-op.
Details: `docs/WAREHOUSE-INTELLIGENCE.md`.

---

## 12. Local semantic routing (BGE) — `src/routing/` + `src/workers/`

Routing runs **in the browser**, in a Web Worker, on a pinned quantised ONNX model. Gemini
still writes every answer; routing only picks an optional topical focus.

**Model.** `Xenova/bge-small-en-v1.5`, revision pinned in `src/routing/models.ts`, `q8` dtype,
CLS pooling, 512-token budget, 384 dimensions, single WASM thread. `all-MiniLM-L6/L12` remain
in the registry for offline comparison scripts only. A Cloudflare Workers AI Llama-3.1-8b
option routes server-side via `/api/routing/llm` instead.

**Contract enforcement.** `bgeContract.ts` validates the ready handshake field by field
(model id, revision, token budget, pooling, dimensions, dtype, artifact, release) and
`checkedBgeVector()` rejects any embedding that is the wrong length, non-finite or not
L2-normalised to within 0.002. A mismatch marks the router unavailable rather than silently
degrading. `npm run check:bge-contract` gates the build.

**Worker tasks** (`embedder.worker.ts`), all priority-queued through `EmbeddingQueue` with
cooperative `yield` between batches so interactive routing preempts background work:

| Task | Purpose | Timeout |
|---|---|---|
| `route` | Pick one micro-tool skill for an `@Oala` message | 1500 ms |
| `topic` | Route a topic selected from the previous question | 1500 ms |
| `needs` | Classify the turn as answer / clarify / research | 1000 ms |
| `suggest` | Post-response skill suggestions from the answer text | 20 s |
| `pathway` | Mini-pathway relevance | 25 s |
| `objectives` | Lazy 316-catalogue retrieval | 90 s |

**Gating.** `routingSkipReason()` refuses to route before embedding at all: structured
answers, empty or >1800-char input, non-Latin or symbol-only text, bare greetings,
corrections and boundaries ("stop", "actually", "not interested"), sensitive-boundary phrases,
under-4-word fragments, and multi-question messages. Short follow-ups ("more", "why",
"compare them") get one chance to be resolved against history by `resolveShortQuery()`.

**Decision.** `chooseRoute()` applies the calibrated gate from `bgeCalibration.json` — per-flow
score, margin and domain-margin thresholds — and abstains otherwise. Abstention is the
designed-for outcome, not a failure.

**Server re-validation.** The browser's decision is advisory. `validateRouteSelection()` on the
server re-checks version, model id, flow, tool eligibility, calibration version, and that
score/margin/domain-margin clear the server's own thresholds. Client-supplied thresholds are
never accepted, and only allowlisted catalogue text (`mini_prompt` from `microtools.json`)
ever reaches Gemini.

**The instruction itself** (`scopedInstruction()`) tells the model the hint is *fallible*, is
not a user instruction or evidence, must be ignored if it does not match, must never be
exposed as a label or score, and must not restart intake or override a correction.

---

## 13. Frontend

### 13.1 Entry and auth

`src/main.tsx` wraps `window.fetch` so every `/api/*` request except `/api/auth/*` gets the
`Authorization` header from `localStorage.yuzee_auth`. `App.tsx` checks the token against
`/api/auth/check`, renders `LoginPage` when absent, and otherwise mounts
`TokenLabProvider → ObjectiveProvider → AuthedApp`. A second page, `ProtocolRendererPage`, is
a standalone protocol renderer playground reachable from the navbar.

### 13.2 State — `TokenLabContext`

One context holds everything: conversations list, current conversation, capabilities, session
stats, streaming flags, active turn telemetry, every modal's open/closed state, the user
profile facts, saved location, contradictions, deferred clarification payload, shared settings
and the daily cost warning. There is no Redux/Zustand layer — the surface is large but flat.

Streaming updates always guard with `prev?.id !== activeConv.id` and `controller.signal.aborted`
before mutating, so a late chunk from an abandoned turn can never write into a different
conversation.

Key actions: `selectConversation`, `startNewConversation`, `loadDemoConversation`,
`removeConversation`, `updateCurrentConversationSettings`, `applyOptimizationMode`,
`applyPreset`, `sendMessage`, `stopStreaming`, `submitFeedback`, `resetMemory`,
`refreshStats`, `resetSessionStats`, `inspectTurnTelemetry`, `clearLocalData`.

**Modes** (`applyOptimizationMode`): `AUTO`, `SAVE_TOKENS`, `FULL_CONTEXT`, `VANILLA`,
`MICRO_PROMPT`, `ADVANCED`, `EXP_RAG` (short cached core prompt + per-turn retrieval; see `docs/EXP-RAG.md`).
**Presets** (`applyPreset`): `MAX_QUALITY`, `BALANCED`, `MAX_SAVINGS`, `VANILLA`, `ADVANCED`.
Both write strategy, thinking level, context budget, retained turns and response mode together.

### 13.3 Streaming client

`api.streamChatMessage()` is a hand-written SSE parser, not `EventSource`, because the request
is a POST with a JSON body. Details that matter:

- `currentEvent` persists **across chunk boundaries** — an event name and its data line can
  arrive in different network chunks.
- A blank line dispatches and resets the event type, per the SSE spec.
- The initial `fetch` retries twice (500 ms, 1000 ms) on transient network errors only.
- The returned function aborts the request; a caller-supplied signal is forwarded into the
  internal controller.
- `onDone` is idempotent.

### 13.4 Component map

| Component | Role |
|---|---|
| `Navbar` | Model picker, router-model selector, pathway toggle, lab tools, profile, settings, cost chip, telemetry toggle |
| `Sidebar` | Conversation list, new/demo conversation, overall telemetry |
| `ChatArea` | Message list, turn dividers, per-message actions (copy, raw JSON, speak, retry), skill suggestions, objective suggestions, research offers, cost warnings |
| `Composer` | Textarea with draft persistence, `@Oala` mention affordance, attachments, speech-to-text, send/stop |
| `ProtocolV13Renderer` | Renders all 16 block types with a defensive `default` branch for unknown types |
| `ProtocolInteraction` | Renders questions, options, ranked select, field forms and handoffs |
| `TokenInspector` | Right-hand live telemetry panel |
| `AdvancedLabModal` | The lab workbench: context, memory, strategy, protocol and raw diagnostics tabs |
| `ContextInspectorModal` | Included/excluded context sections with token counts and previews |
| `MemoryTimelineModal` | Compaction history and break-even maths |
| `BenchmarkModal` | Strategy comparison, modelled or live |
| `AnalyticsDashboardModal` | Session/lifetime aggregates |
| `CareerContextModal` | Edit the structured memory capsule |
| `UserProfileModal` | Learned profile facts, likes/dislikes, contradictions |
| `ClarificationQuestionsModal` / `Card` | Contradiction resolution flow |
| `SettingsModal` | Shared settings, system prompt, storage, API status |
| `ExportModal` | Conversation export |
| `PathwayWhiteboard` | The full pathway canvas (largest component) |
| `MiniPathwayExperience` / `Streaming` | Mini pathway drawer and its streaming blocks |
| `SkillSuggestions` | Post-response skill offers from the local router |
| `MicroRouterStatus` / `ModelLoadingIndicator` | Embedding model load state |
| `GuidanceList`, `MoreDetails`, `ResearchAnswerCard`, `ChatStreamingStatus`, `ChatTurnDivider` | Supporting UI |
| `objectives/*` | Workspace shell, primitive renderer, suggestions toolbar, history, result |
| `warehouse/*` | Course cards, provider comparison, skills explorer, local area guide |
| `ui/Apple*` | Shared control primitives (toggle, slider, select, segmented control, confirm dialog) |

### 13.5 Presentation safety

`src/ux/responsePresentation.ts::acceptedResponse()` is the single gate the UI uses before
rendering anything. A message renders only if it parses, validates and was not marked
invalid — the same rule the server applies before storing it. `readableMarkdown.ts` and
`responseToReadableText()` produce copy/speech text from the structured blocks rather than
from raw JSON.

---

## 14. Data and persistence

### Layers

1. **In-memory `Map<string, ConversationItem>`** — the hot path. Capped at 500; the
   least-recently-updated conversation is evicted on overflow.
2. **`data/` JSON files** — the default durable layer, always active:
   - `conversations.json` — full conversations (via `LocalConversationStore`)
   - `session-stats.json` — cumulative counters
   - `token-log.ndjson` — append-only per-call usage log
   - `shared-settings.json` — deployment-wide settings
   - `detail-research.json`, `mini-pathways.json` — subsystem results
   - `objective-preview/<hash>/` — workspace sessions, selections and audits
   - `warehouse/catalogue.sqlite` — the built catalogue index
3. **PostgreSQL** — optional, activated by `DATABASE_URL`.

`LocalConversationStore` serialises all writes through a promise chain and writes
temp-file + `rename` for atomicity. A read error other than `ENOENT` **throws** rather than
returning `[]` — it will never overwrite unreadable history with an empty list.

### PostgreSQL schema

- **`conversations`** — settings, career context (JSONB), summary, compaction history,
  active interaction, and a 30-day `expires_at`.
- **`messages`** — role, content, structured response, user event, telemetry, feedback, with
  `ON DELETE CASCADE`.
- **`conversation_logs`** — append-only per-turn audit: ip, model, token counts, cost, latency,
  finish reason, truncated input/output, error code, and whiteboard flag. **Never pruned.**

Indexes cover ip+time, conversation id, updated/expiry, and message ordering. `MIGRATION_SQLS`
are idempotent `ADD COLUMN IF NOT EXISTS` statements run on every startup.

Background jobs when the DB is enabled: `pruneExpired()` every 6 hours, `keepAlive()` every
hour (Supabase free tier auto-pauses idle projects). Both intervals are `unref()`'d.

Connection details: pool max 5, 30 s idle, 5 s connect timeout, `ssl.rejectUnauthorized:false`,
and `dns.setDefaultResultOrder('ipv4first')` at module load because Render's free tier cannot
route IPv6 while Supabase resolves to both.

---

## 15. Deployment

**Render** (`render.yaml`) — `npm install && SKIP_BGE_CONTRACT=1 npm run build`, started with
`node dist/server.cjs`. The BGE contract check is skipped because the model files are
gitignored.

**Vercel** (`vercel.json`) — static output from `dist/public`; all `/api/*` rewrites hit
`api/index.ts`, which `require`s the pre-bundled `dist/server.cjs`. The bundle is required
because `@vercel/node` transpiles but does not bundle transitive imports, leaving
extensionless ESM paths unresolvable at runtime. `maxDuration` is 300 s; a chat turn self-limits
to `RESPONSE_TIMEOUT_MS` (default 90 s) so a slow turn ends with an informative error.
`startServer()` never runs there, so the first `/api` request runs `bootState()` (DB schema,
conversations, stats). Writable state (fallback conversation store, stats, token log, previews)
goes to the temp dir (`YUZEE_STATE_DIR`, `src/services/paths.ts`); it is per instance, so set
`DATABASE_URL` for durable conversations. A conversation missing from an instance's cache is
loaded from storage before any `/api/conversations/:id` handler runs. Neo4j/TimesFM and the BGE
files are optional there; see `docs/WAREHOUSE-INTELLIGENCE.md` and the Gemini embedding option in
`docs/EXP-RAG.md`.

**Local production** — `npm run build` then `npm start`.

---

## 16. Spring backend

`spring-backend/` is a 60-class Java 21 / Spring Boot 3.4 / Spring AI 1.0 GA implementation of
the same architecture. It is a standalone reference; the React UI does not talk to it.

Controllers mirror the Node routes: `/api/config/capabilities`, `/api/protocol/{info,schema,prompt}`,
`/api/conversations` (CRUD, feedback, reset-memory), `/api/conversations/{id}/messages`
(SSE via `TEXT_EVENT_STREAM_VALUE`), `/api/tokens/{count,session-stats,session-reset}`,
`/api/benchmark`.

Services mirror the Node services: `ContextAssembler`, `TokenBudgetMemoryManager`,
`ConversationCompactor`, `GeminiChatService`, `TokenCountService`, `UsageAccumulator`,
`YuzeeSchemaValidator`, `YuzeeSemanticValidator`, `YuzeeProtocolRegistry`, `TextQualityFilter`.

It additionally carries a `service/semantic/` package that the Node backend does not have:
`SemanticEpisodeSegmenter`, `AdaptiveMemoryRetriever`, `MemoryQueryPlanner`,
`LexicalSemanticSimilarityService` and `SemanticEvidenceContextBuilder` — the research
implementation behind the `SEMANTIC_EVIDENCE` strategy, tuned by the
`yuzee.token-lab.semantic-memory` block in `application.yml` (episode token/turn soft caps,
boundary threshold, evidence token cap). Extraction is disabled by default.

Run with `mvn spring-boot:run` and `GEMINI_API_KEY` in the environment. Actuator exposes
health, info and metrics.

---

## 17. Invariants — do not break these

1. **The system prompt lives only in `config.systemInstruction`.** Never copy it into
   `contents`. Doing so doubles the token cost and destroys cache reuse.
2. **Stable-prefix ordering.** System instruction, then capsule, then summary, then recent
   turns, then the current message. Reordering breaks implicit caching.
3. **A rejected response never enters history.** `canRender === false` means the message is
   stored without `structuredResponse` and is skipped by `groupIntoTurns()`.
4. **Security state is server-derived.** `computeNextSecurityState()` must never read model output.
5. **`activeInteraction` updates only on full acceptance**, and every `UserEvent` is validated
   against it server-side.
6. **Only registered service actions exist**, and none of them execute. A connected action
   returns 501, not a fake success.
7. **Token provenance is never fudged.** `exactCount` is true only when *every* active
   component came from `countTokens`. `sources` must stay accurate.
8. **`totalTokenCount` from the provider is not used** for quota maths — cached tokens are
   counted in its input sum.
9. **Routing is advisory and re-validated server-side.** Client thresholds, tool ids and scores
   are never trusted; only allowlisted catalogue text reaches the model.
10. **Retrieved data is data.** Warehouse records, research results, workspace results and
    shared context are all injected with an explicit "not instructions" label.
11. **Thought summaries never reach the client.** `splitGeminiStreamChunk()` filters
    `part.thought === true`.
12. **Protocol and schema files are immutable.** `Yuzee_Response_Protocol_v1.3.ts` and
    `Yuzee_Response_Schema_v1.3.json` are versioned artifacts; change the version, not the file.
13. **Provider errors are never surfaced raw** — they can contain request credentials.
14. **Build gates are load-bearing.** The quiz-prompt, BGE-contract and objective-catalogue
    checks fail the build on purpose when generated artifacts drift.

---

## 18. Where to start reading

| Goal | Read |
|---|---|
| Understand a chat turn | `server.ts:1607` → `YuzeeRequestAssembler.assembleRequest` → `validateProtocol` |
| Change context strategy | `src/services/TokenBudgetMemoryManager.ts` |
| Change the counsellor's behaviour | `src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.11.md` + `src/prompts/*.md` |
| Add a response block type | v1.3 schema + TS type + `ProtocolV13Renderer.renderBlock` + `validateDisplayInvariants` |
| Work on routing | `src/routing/policy.ts`, `src/routing/bgeMatching.ts`, `src/workers/embedder.worker.ts` |
| Work on retrieval | `src/warehouse/service.ts` and `WAREHOUSE_INSTRUCTION` |
| Work on the UI shell | `src/App.tsx` → `src/context/TokenLabContext.tsx` → `src/components/ChatArea.tsx` |
| Understand telemetry | `server.ts` lines ~2200–2350 and `src/data/models.ts` |
