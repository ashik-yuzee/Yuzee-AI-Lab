# EXP-RAG mode

Experimental chat mode that keeps Oala's counselling quality while sending far fewer tokens per turn.
Instead of the full ~46k-token v1.11 prompt on every turn, the model receives a short cached core
prompt plus only the guidance, warehouse evidence and memory that the current turn needs.

Select **EXP-RAG (Experimental)** in the mode menu. The server enforces Gemini 3.7 Flash with
medium thinking for this mode. Response Protocol v1.3, validation, teaching review, security
state and telemetry are unchanged.

## What a turn looks like

```
systemInstruction (explicit cache, slot "exp-rag")   src/rag/guidance/core-prompt.md  ~8.8k real tokens
history  <conversation_summary> + capsule  (first kept user turn)
         recent turns verbatim (user / model)
user     <runtime_context>      date, stated location, profile facts, workspace state
         <retrieved_guidance>   verbatim v1.11 modules chosen for this turn
         <retrieved_evidence>   typed-lookup chunks + catalogue-index matches + saved results
         <conversation_memory>  older user statements recalled verbatim
         <turn_notes>           routing / needs / clarity / @Oala notes
         <user_message>         the message or USER_EVENT
```

Dynamic content sits at the end so implicit prefix caching still works on the history.
User text that imitates these tags is defanged (`neutralise()` in `src/rag/pipeline.ts`).

## 1. Core prompt (cached)

`src/rag/guidance/core-prompt.md` holds every rule that applies on every turn: role, security,
the turn input contract, user/conversation state, scope gate, counselling method and turn
progression, question control, understanding and service timing, voice, evidence and claims,
presentation, and the complete v1.3 output contract (all 123 schema enum values are named — a
test enforces this). It is cached through `SystemPromptCacheManager` in its own slot, so it
coexists with the default prompt's cache instead of evicting it.

## 2. Guidance knowledge base (prompt RAG)

`src/rag/guidance/manifest.ts` partitions the v1.11 prompt into anchored regions. Each region is
assigned to the core, to one or more of **70 retrievable modules**, or to both.
`npm run build:rag-guidance` extracts module text **verbatim** into `guidance-kb.json`; retrieved
rules are never paraphrased. The build fails if an anchor drifts, and `check:rag-guidance` is a
build gate. Of 3,474 source lines, every non-blank line is accounted for: 623 core-only, 488 core
and module, 1,455 module-only, 156 headers/metadata.

Each module carries `when` (the situations it governs), 5 example user turns, a priority, a
family (`counselling` or `evidence`) and optional deterministic triggers.

Selection per turn (`src/rag/guidance.ts`):

1. **Triggers** from turn signals: first turn, short reply, correction, overwhelm, comparison,
   service intent, active handoff, jurisdiction terms, cost, university, study load, return to
   work, course quality, stated work experience, unsure-in-a-place, nearby providers, warehouse
   evidence (comparison / local / skills-jobs), workspace, returning user, format requests.
2. **Hybrid semantic retrieval**: BM25 over each module's retrieval key, plus BGE max-similarity
   over the key and every example, scored as lift over the module's background similarity
   (hubness correction, so generic modules do not match everything), fused with RRF. The raw
   message and a context-augmented query are both embedded; the best lift wins.
3. **Tiered packing** with separate budgets: counselling 3,600 tokens (cap 5,200) and evidence
   policy 2,700 (cap 3,600). Priority-5 triggered modules are packed first.
4. Modules render in source order; `layer="application"` marks later clarifications that take
   precedence, matching v1.11.

Evaluation (`npm run eval:exp-rag`, 46 labelled turns): **100% recall** of required modules with
dense retrieval (≈2.8k guidance tokens, 4.3 modules per turn); **96.9%** lexical-only fallback.

### Embedding provider: BGE or Gemini

Settings → Data intelligence & RAG → *EXP-RAG embeddings* chooses per browser: server default
(`EXP_RAG_EMBEDDER`; Gemini when `GEMINI_API_KEY` is set, else BGE), BGE (local files) or Gemini (`gemini-embedding-2`, 768-d,
retrieval task types, L2-normalised). Gemini needs only `GEMINI_API_KEY`, so dense retrieval also
works on hosts without the BGE files (Vercel). It drives guidance, evidence rerank and memory
recall; the prebuilt warehouse index keeps its BGE vectors (searched with a BGE query vector when
available, else BM25). Vectors from the two providers are never compared: every cache is keyed by
provider.

| | BGE | Gemini |
|---|---|---|
| Guidance recall (46 turns) | 100% | 100% |
| Guidance tokens / modules per turn | 2,809 / 4.3 | 2,278 / 3.3 |
| Thresholds (minLift / with lexical) | 0.12 / 0.08 | 0.18 / 0.10 (recall holds to 0.28 / 0.16) |
| Memory-recall cosine floor | 0.62 | 0.64 |
| Added latency per turn | local CPU | ~1-2 s (API) |

Guidance vectors for Gemini ship pre-built (`src/rag/guidance/guidance-vectors.gemini.json`, int8,
772 KB) so cold starts skip ~770 embeddings. Rebuild with `npm run build:rag-vectors` after editing
the manifest; a stale file is detected by text hash and the index is embedded lazily instead.

## 3. Warehouse RAG (hybrid)

Two sources are fused per turn:

**Typed lookup (existing).** The Gemini query planner and SQLite lookup still resolve areas,
providers, funding and comparisons exactly. Instead of injecting the `WAREHOUSE_DATA` JSON blob,
`packEvidence()` (`src/rag/evidence.ts`) turns the pack into labelled chunks (area, comparison,
course facts, course analysis, each intelligence section, providers, careers, industries,
signals, roles, learning links, job records, observed skills). Anchors (area, comparison, course
facts, local overview, status) are always kept; the rest is ranked by BM25 + BGE against the
query with per-entity and per-family diversity caps.

**Semantic catalogue index (new).** `npm run rag:index` builds `data/rag/warehouse-index.sqlite`
from the read-only warehouse (`src/rag/warehouse/chunks.ts`):

| Kind | Chunks | Avg tokens | One chunk per |
|---|---:|---:|---|
| qualification | 3,354 | 434 | national code: training.gov.au description, field, named occupations, core units, Yuzee analysis of a representative offering, offering count, states, example providers |
| course | 14,316 | 313 | provider-specific course with no national code (degrees, postgraduate, upskilling); single subjects labelled |
| occupation | 986 | 331 | O*NET profile: tasks, skills, work styles, mapped ANZSCO groups |
| anzsco | 358 | 79 | ANZSCO group with dated national JSA projection |
| unit | 15,136 | 221 | current unit of competency and the qualifications containing it |
| provider | 4,119 | 84 | public identity, place, recorded learner support (no contact fields) |
| short_course | 2,362 | 159 | short course record |

Offerings of the same national qualification (147k rows, 95k of them skill sets) are grouped,
including university-delivered VET courses, because their content is shared; delivery, fees and
locations stay with the typed lookup. Private tables and contact fields are never read.

Vectors are local BGE-small (CLS, L2) stored int8 with a per-vector scale; FTS5 provides BM25.
Builds are incremental and resumable (content-hashed; an unchanged rebuild takes ~25 s; a full
build ~9.5 min on 12 threads). A forked worker (`src/rag/warehouse-index-worker.cjs`) serves
search in 8–45 ms with weighted RRF (natural language leans dense, codes lean lexical). Exact
national codes in the message are fetched by id. Catalogue matches already covered by the typed
lookup are de-duplicated, low-relevance matches dropped, and evidence is packed under 3,400
tokens (4,800 for comparisons).

If the typed lookup is unavailable (no warehouse DB on the host), the index still answers
discovery questions and the evidence says the live lookup was unavailable.

## 4. Conversation memory

`src/rag/history.ts`: recent turns stay verbatim; after a response, once two or more turns are
older than the newest four, they are folded into a structured rolling summary (situation,
goals, constraints, preferences, corrections, options with status, already explained, decisions,
open threads) by Gemini 3.7 Flash with low thinking. A turn leaves verbatim history only after the
summary covers it, updates use optimistic concurrency, and older user statements relevant to the
current turn are recalled verbatim. The summary persists in `conversations.rag_memory`
(PostgreSQL, added by an idempotent migration) or the local JSON store.

## 5. Instant replies

Pure greetings answer locally in a few milliseconds with zero tokens, including mid-conversation
(re-orienting copy, preserved confidence state). Explicit thanks/goodbye also close a pending
question; a bare "ok"/"yes" never bypasses because it may answer one.

## Results (live, Gemini 3.7 Flash, medium thinking, warehouse connected)

Same 8-turn conversation in both modes (greeting, unsure in Geelong, electrician cost/duration,
provider comparison, overwhelm, correction, pre-apprenticeship verdict, thanks):

| | AUTO | EXP-RAG |
|---|---:|---:|
| Input tokens | 456,209 | 139,317 (−69%) |
| Uncached input | 133,327 | 86,775 (−35%) |
| Cost | $0.0284 | $0.0173 (−39%) |
| Protocol accepted | 8/8 | 8/8 |

The final "thanks" turn is now answered instantly at zero tokens. Explicit cache storage drops
from ~46k to ~8.8k tokens. Wall-clock time is similar: the warehouse query planner and teaching
review dominate, and EXP-RAG's own retrieval adds about 0.1–0.5 s.

## Operations

```bash
npm run rag:index -- --source "/path/to/training_gov.db"
```

```bash
npm run build:rag-guidance
```

```bash
npm run test:exp-rag
```

```bash
npm run eval:exp-rag
```

```bash
npm run eval:exp-rag -- --provider gemini
```

```bash
npm run build:rag-vectors
```

| Variable | Purpose |
|---|---|
| `YUZEE_WAREHOUSE_DB` | Warehouse SQLite for the typed lookup and the index build |
| `YUZEE_RAG_INDEX` | Index path (default `data/rag/warehouse-index.sqlite`) |
| `EXP_RAG_DENSE=off` | Force lexical-only retrieval (hosts without the BGE files) |
| `EXP_RAG_EMBEDDER` | Default provider when the client picks "Server default": `bge` or `gemini` |
| `EXP_RAG_GEMINI_EMBED_MODEL` | Gemini embedding model (default `gemini-embedding-2`) |

`GET /api/rag/status` reports the core hash, encoder, index and lookup state. Per-turn telemetry
(`requestTrace.rag`) lists the guidance modules with their trigger or lift, evidence ids, memory
state and retrieval latencies; the Context Inspector shows each section's tokens.

Deployment: the index (~110 MB) and BGE files are gitignored. Without them EXP-RAG still runs on
the cached core, trigger + BM25 guidance and the typed lookup; choose Gemini embeddings there for
dense guidance and evidence retrieval.

## Comparison with Vanilla (exp-rag-1.1)

Report: `docs/reports/exp-rag-vs-vanilla.pdf` (data in `docs/reports/data/`). Same model, thinking level, warehouse,
intelligence and review pipeline; 36 turns (two runs of 13 scenarios incl. multi-turn), judged blind in both answer orders.

| | Vanilla | EXP-RAG · Gemini (default) | EXP-RAG · BGE |
|---|---|---|---|
| Wins–losses–ties vs Vanilla | — | 15–4–17 (p = 0.01) | 12–8–16 (p = 0.25) |
| Median latency | 17.2 s | 14.2 s | 14.2 s |
| Cost per turn | $0.0042 | $0.0027 | $0.0027 |

What makes it faster and better than the first version:
- **Review fast path:** the teaching review returns `{"verdict":"OK"}` unless a correction is needed, instead of re-emitting the answer.
- **Planner:** the warehouse query planner runs on Gemini 3.5 Flash-Lite (`EXP_RAG.planModel`), with a guard against false comparison plans.
- **Local scope:** interstate-only courses are dropped, and same-state campuses away from the user's place are labelled. This covers both lookup and catalogue hits.
- **Rerank skip:** the evidence dense rerank is skipped when the ranking cannot change the selected set.
- **Single-question guard (`enforceSingleQuestion`):** drops a trailing prose question and trims compound free-text questions.
- **Core prompt rules:** concreteness; open question over a menu; no restating table content; codes only when evidenced; never produce off-topic content.

Reproduce (isolated server, no `DATABASE_URL`):

```bash
npm run eval:modes -- --report=tmp/run.json
```

```bash
npm run report:modes -- --report=tmp/run.json --out=docs/reports/new-report
```

## Known limitations

- Like AUTO, the model sometimes answers off-topic trivia in full or bundles two facts in one
  question; both modes share these tendencies.
- Module triggers are regex signals; semantic retrieval covers what they miss, and the labelled
  set should grow with real transcripts.
- The index reflects the warehouse at build time; rebuild after warehouse refreshes.
