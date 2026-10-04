# MULTI_AGENT mode

EXP-RAG plus a visible team of specialists (spec: *Yuzee Agentic Orchestration v1.0*). The final answer is still
written by the EXP-RAG path: cached core prompt, retrieved guidance and evidence, rolling memory, teaching review fast
path, `enforceSingleQuestion`, Protocol v1.3 validation, server security state, telemetry and persistence. Specialists
add a merged, evidence-checked `<specialist_findings>` block to that turn. In `server.ts`, `ragMode = expRag || multiAgent`
marks every place where EXP-RAG behaviour applies.

| File | Role |
|---|---|
| `src/agents/contract.ts` | Shared types: plan, events, `AgentResult`, `OrchestrationRecord` (browser-safe) |
| `src/agents/router.ts` | Complexity gate: rules at t=0, additive refinement from the warehouse planner |
| `src/agents/registry.ts` | The 8 specialists: version, capabilities, inputs, tools, timeout, model, permissions, status text |
| `src/agents/specialists.ts` | Evidence slices, own index search, mini-prompts, JSON schemas, grounding checks |
| `src/agents/orchestrator.ts` | DAG executor (`runDag`) and turn glue (`startMultiAgent`, `orchestrationRecord`) |
| `src/agents/merger.ts` | Deterministic merge, conflicts, confidence, next actions, `<specialist_findings>` package |
| `tests/multi-agent.test.ts` | `npm run test:multi-agent` (no live Gemini) |

## Complexity gate

`classify(message)` is deterministic: same text, same plan. Signals: domains (jobs, courses, skills, market, pathway,
providers, funding, location), a named employer (`at <Company>` or a known employer), personalisation (`am I`, `my`,
`for me`, `suit me`, first-person statements; "show me" and "near me" do not count), comparison, discovery
(`find … for me`, `suits me`), pathway intent (`how do I become`, `move/switch from X into Y`, `path`, `fastest way`)
and actionability (`start getting me offers`, `realistically apply`, `close any gaps`).

| Level | When | Specialists |
|---|---|---|
| 0 | Definitions, social or no data domain | None. No orchestration events; plain EXP-RAG answer. Greetings/thanks still use the instant bypass |
| 1 | One data domain, not personal | One specialist with `execution:'retrieval'`: its work is the typed lookup plus its own index search. No model call. `plan.visible=false` |
| 2 | Personal or comparison, 1–2 domains | Profile (if personal) + domain specialists; Skills when fit is asked; Opportunity on discovery |
| 3 | Pathway intent, 3+ domains, or a named employer with personalisation | Pathway intent: Profile, Jobs, Skills, Market, Learning, Pathway. Employer: Profile, Company, Jobs, Skills, Learning |
| 4 | Actionable requests | Profile, Jobs, Skills, Learning, Opportunity, Pathway (+ Market/Company when asked) |

When the warehouse planner returns (it already runs for EXP-RAG, so no extra tokens), `refinePlan` adds domains and,
for level ≥ 2, missing Jobs/Learning (or Market at level ≥ 3 for LOCAL facets). Agents are only ever added. A refined plan
is sent as a second `PLAN_CREATED` with `classifier.method:'rules+planner'`. Both classifications are logged
(`[multi-agent] classified|refined`). The test corpus has 38 prompts, including every spec §7 and §47 prompt, plus
paraphrase groups that must route the same way.

## Specialists

All analysis specialists use `gemini-3.5-flash-lite` with its default (minimal) thinking, `responseMimeType:
application/json` and a per-agent `responseSchema` matching the contract envelope (summary, facts, findings,
recommendations, missingData, confidence, warnings, data). The task wording follows spec §10; evidence specialists are
told not to make a final recommendation. The schema the model fills is small (summary, up to 3 findings each marked FACT or INFERENCE, missing data, confidence,
agent data with lists capped by `maxItems`); the server derives the facts/findings split, sources and warnings. A call
takes ~1.1–2 s in isolation and ~2 s after the lookup in a live turn.

| Agent | Evidence | Depends on | Timeout |
|---|---|---|---|
| Profile | Saved profile facts, memory capsule, self-descriptive user statements, stated location (only agent that sees raw profile data) | – | 5 s |
| Jobs | Pack: job records, observed skills, roles, area; index: occupation, ANZSCO (adjacent roles) | – | 5.5 s |
| Skills | Pack: roles, observed skills, careers, jobs; index: occupation, unit | Profile | 5.5 s |
| Market | Pack: signals, careers, industries, area (not graph/forecasts: Oala's composer gets those; waiting for them cost ~2 s); index: ANZSCO, occupation | – | 5.5 s |
| Company | Pack: jobs and providers naming the employer; index: provider | – | 5.5 s |
| Learning | Pack: courses, learning links, comparison, units, providers; index: short course, course, qualification, unit | – | 5.5 s |
| Opportunity | Pack: roles, careers, jobs not matching the literal title; index: occupation, ANZSCO, qualification | Profile | 5.5 s |
| Pathway | Pack: roles, observed skills, jobs, learning links, courses, units, signals, careers (interleaved by family so the budget keeps a mix); index: qualification, short course, occupation | Profile | 6.5 s |

Dependencies are declared only where an agent consumes another's output, because the UI shows "waiting for X".
Pathway originally waited for every other specialist. That serial step added 2.5–4 s to every level-3 turn, so it now
reads the evidence itself next to the others and Oala's composer reconciles routes with the skills and learning results
(round 2 below compares both versions).
Other agents see the Profile result summary (never the raw profile) when they depend on it.

Every specialist runs its own catalogue search (`warehouseIndex.search` with its allowed kinds, planner terms and a BGE
query vector). That is how EXP-RAG fetches data for each agent. Progress events report real steps only: reading the
lookup, searching, and the number of records found.

**Grounding.** Evidence is given as `[id] text`. Server-side, cited ids that were not supplied are removed. A FACT left
without evidence is dropped, and so is any statement that cited only fabricated ids. Structured items (adjacent roles,
learning options, market signals, opportunities) without a valid id are dropped, so an uncited opportunity is never
shown. The count is added to `warnings`. Company with no employer records returns a fixed "no records naming X"
result without a model call. Market must label each signal HISTORICAL / CURRENT / INFERRED / UNCERTAIN. Vacancy outlooks
here are HISTORICAL_ONLY (JSA refresh is blocked from this network), and the prompt forbids presenting them as trends.

**Sources** carry `SourceKind`, a human label, `retrievedAt`, `updatedAt` where the record has one, and `stale` (jobs
older than 120 days, signals 540, vacancy outlooks 270, other records 3 years).

**Profile reuse.** The Profile input hash covers prompt version, target, facts, capsule, self-descriptive statements and
location. A completed Profile with the same hash, in this process or in a persisted `orchestration` record, is reused:
`AGENT_COMPLETED` arrives immediately with `metrics.reused=true` and the message "Using the profile review from earlier
in this chat".

Registry: `GET /api/agents/registry`. `MULTI_AGENT_DISABLED=COMPANY_SPECIALIST,MARKET_SPECIALIST` switches agents off.
Every agent's write permissions (save, apply, send, write profile, request offers) are false.

## Orchestrator

`runDag` starts each agent as soon as its dependencies have results, so independent agents run concurrently. Data
specialists wait for the shared warehouse lookup after they start. Their timeout starts when the lookup arrives. Each
agent has its registry timeout and at most one retry on 429/5xx while at least 2 s remain. The request `AbortSignal`
(client disconnect, an early SSE error, or a newer MULTI_AGENT message on the same conversation, which ends the old
stream with `SUPERSEDED`) stops running agents and keeps pending ones from starting. A failed agent never fails the run.
An agent that needs upstream results is `SKIPPED_DEPENDENCY` only when every dependency failed. Specialists start as
soon as the typed lookup returns; graph links and vacancy outlooks reach Oala's composer through the retrieved evidence. Per-agent
metrics: duration, model, tokens, `costUsd` (via `calcTurnCost`) and `reused`.

Test hook (spec Test 6, not in production): request body `debugFailAgents:['MARKET_SPECIALIST']` or env
`MULTI_AGENT_FAIL=MARKET_SPECIALIST` makes that agent hang until it times out.

## Merger and composer

`mergeResults` makes no model call:
- **Dedupe:** findings are deduplicated by normalised text, or by subject + stance + evidence ids. Duplicates are counted and never change confidence.
- **Agreements and conflicts:** findings on the same subject with POSITIVE and NEGATIVE stances are listed as a conflict, with the agents and statements involved.
- **Ranking:** sources are ranked by spec §29 priority, and FACT is kept apart from INFERENCE.
- **Confidence:** the mean confidence of completed agents, scaled by the share of agents that finished, minus 0.05 per conflict.
- **Also reported:** stale evidence, missing data and failed agents.

**Next actions** are limited to what the lab can honour:
- `BUILD_PATHWAY` (with a prompt)
- `COMPARE_COURSES`, `VIEW_JOB`, `REQUEST_JOB_MATCH`, `ASK_FOLLOW_UP` (follow-up chat prompts)
- `UPDATE_PROFILE`

Pathway's own `next_action` comes first. Unknown action types are dropped.

The level ≥ 2 package is `<specialist_findings>`, kept to 2,500 tokens or less and neutralised, so model text cannot
close the tag. `specialist_findings` is a reserved tag in `neutralise()`. The package lists, in order:
1. An answer plan: best route, best next action, main gaps, options beyond the request.
1. Checks done and not done.
2. Unfinished checks, with an instruction to say so in one sentence.
3. Confidence.
4. Conflicts.
5. Facts.
6. Inferences.
7. Structured results: skills, market signals with timeframe, jobs and adjacent roles, employer, learning options, opportunities, routes.
8. Missing data.
9. Next-action labels.

`buildExpRagTurn` places the package after `<retrieved_evidence>`. It awaits the package last, so guidance and evidence
selection overlap the specialists. `MULTI_AGENT_NOTE` (a turn note) asks for:
- one coherent Oala answer that does not name the agents;
- the spec §14 structure;
- conflicts and uncertainty kept as nuance;
- no inference presented as fact;
- a plain sentence for any check that didn't finish;
- at most one high-value question about missing profile data.

The teaching review receives the same package. Composer model: `EXP_RAG.model` (Gemini 3.7 Flash). Thinking:
the Composer thinking control, as chosen (default `medium`; `MULTI_AGENT_COMPOSER_THINKING` is the fallback). Low is
the fast option: tested on team turns it was the fastest configuration of any mode but ranked last in blind judging
(round 4), so it is not the default.

## Streaming

In MULTI_AGENT the SSE headers are flushed right after request validation. `event: orchestration` (data =
`OrchestrationEvent`) streams the following events:
1. `ORCHESTRATION_STARTED`
2. `PLAN_CREATED`, sent again if the planner refines the plan
3. `AGENT_STARTED`, `AGENT_PROGRESS`, then `AGENT_COMPLETED` or `AGENT_FAILED`
4. `MERGE_STARTED`, `MERGE_COMPLETED`
5. `RESPONSE_STREAM_STARTED`, sent before the composer call
6. `RESPONSE_COMPLETED`, carrying the full record and sent before `done`

The existing events (`start`, `status`, `delta`, `validation`, `protocol_response`, `structured`, `usage`, `done`) are
unchanged. Every early exit after the flush goes through `fail()`, which sends an SSE `error` with `{error, errorCode,
status}` and ends the stream. In other modes `fail()` still returns the old JSON status.

## Team window

In Multi-Agent mode only, a button next to the message box shows how many specialists are working (badge) and opens a
draggable window that snaps to any edge or corner. It renders the team as a pixel-art office
(`src/components/agents/PixelAgentsWindow.tsx`, `pixel/office.ts`; renderer and sprites adapted from Pixel Agents, MIT,
characters based on JIK-A-4's Metro City pack). Every team member has a fixed, labelled desk (Oala in the middle of the
front row). Only specialists the plan really called sit down: queued ones stand by their desk, running ones type with
their real status message, finished ones get a ✓, failed ones a "!". Desks of specialists not called stay empty.

## Persistence and analytics

- **Persistence:** `MessageItem.orchestration` holds the `OrchestrationRecord`. The local JSON store keeps it as-is. Postgres has a new `messages.orchestration JSONB` column, added by an idempotent migration and read back by `rowToConversation`.
- **Billing:** each specialist call is an `auxUsage` entry (`agent:JOBS_SPECIALIST`, …), so its cost is billed with the turn and written by `appendTokenLog`.
- **Telemetry:** `requestTrace.orchestration` (id, lookup/intelligence ms, level, classifier, agentsMs, confidence, conflicts) and `requestTrace.agents` (per-agent status, ms, tokens, cost, reused, evidence count, confidence, error). The Context Inspector shows a "Specialist findings" section.
- **Analytics:** `POST /api/conversations/:id/agent-events` accepts `agent_result_expanded`, `agent_evidence_opened`, `agent_next_action_shown`, `agent_next_action_clicked`, `agent_feedback_positive` and `agent_feedback_negative`. Fields: `orchestrationId`, optional `agent`, `action`, `messageId` and `at`. Requests are validated and rate limited (60/min). Each one is appended to `agent-events.ndjson` in the state dir. The server also appends one `agent_synthesis_completed` line per orchestration, with per-agent duration, cost, confidence, evidence and staleness.

## Evaluation (4 October 2026, isolated server, warehouse READY)

Data: `docs/reports/data/multi-agent/` (answers, blind files, label keys, judge scores). Collected with
`scripts/collect-modes.ts` (one run per turn, $0.18 of Gemini in total). Judged blind by two Claude models
(no Gemini judge): five 1–5 criteria (relevance, grounding, personalisation, actionability, clarity) and a rank.

**Round 1:** 11 turns. These are the spec §47 prompts plus earlier EXP-RAG scenarios, including a two-turn chat.

| Variant | Mean rank (1 best) | First places | Median wall | Cost/turn incl. planner + agents |
|---|---|---|---|---|
| MULTI_AGENT, medium thinking | **1.68** | **12/22** | 16.2 s | $0.0035 |
| EXP-RAG | 2.27 | 7/22 | 13.4 s | $0.0027 |
| Vanilla | 2.36 | 3/22 | 17.8 s | $0.0048 |
| MULTI_AGENT, low thinking (7 hard turns only) | 2.93 | 1/14 | 12.2 s | $0.0036 |

One round-1 MULTI_AGENT answer was withheld: the model omitted the optional intro `text` of a list block. That is now
repaired in `applyPresentationDefaults`, for every mode.

**Round 2:** 8 turns, re-run with parallel Pathway, the gate split and the label/prompt fixes. Vanilla, EXP-RAG and the
round-1 MULTI_AGENT answers were reused.

| Variant | Mean score /25 | Mean rank | First places | Last places |
|---|---|---|---|---|
| MULTI_AGENT v2 (parallel Pathway) | **19.50** | 2.31 | 2/16 | **1/16** |
| MULTI_AGENT v1 (Pathway after all) | 18.13 | **2.13** | 7/16 | 4/16 |
| Vanilla | 19.25 | 2.50 | 3/16 | 4/16 |
| EXP-RAG | 19.38 | 2.69 | 4/16 | 8/16 |

The v1/v2 gap is within run-to-run noise. Most of v1's extra first places are on level-2 turns where Pathway does not
run at all. v2 starts its answer about 4 s earlier on level-3 turns, so it is the shipped version.

Latency (same server, warehouse READY):
- **Level 1:** a retrieval-only specialist (~1.5–2.5 s, no model call), then the EXP-RAG composer. Same speed as
  EXP-RAG.
- **Level 2:** the answer starts at ~4.3–6 s.
- **Level 3:** the answer starts at ~5–6 s (v2), against ~9–10 s for v1 and ~2.5–4.5 s for EXP-RAG. Composer and review
  then take the same 8–15 s as EXP-RAG. Gemini variance dominates the total; the same prompt varied by 4–5 s between runs.
- **Overall:** level-3 wall time is ~2–4 s above EXP-RAG and similar to Vanilla. The team panel shows real progress
  from ~0.1 s.
- **Cost:** specialist calls add ~$0.0007–0.0022 per level-2/3 turn.

Spec Test 6 (`debugFailAgents:['MARKET_SPECIALIST']`, live): the state was `partial_failure`. The answer said "The
market check didn't finish, so I've left that out rather than guessing" and made no trend claims.

**Round 3 (5 Oct):** all three modes re-run in one session, 11 turns, after the speed work (lean specialists, Market
without the graph wait, an answer plan, a composer one notch lower on team turns). Multi-Agent became the fastest mode
(median 14.1 s vs EXP-RAG 14.8 s and Vanilla 17.6 s; first words 6.5 s vs 8.7 s and 10.6 s) but ranked last on quality
(mean rank 2.27 vs 1.68 / 1.82): unsupported timelines, a generic profile question pushed by the plan, arbitrary job
titles when the user gave no target, unattributed record details.

**Round 4:** those issues fixed (no question push, sources named, no-target rule, local providers), then the 7 team turns
re-run with the composer at low and at medium thinking, judged four-way against round-3 Vanilla and EXP-RAG.

| Team turns (7) | Mean rank (of 4) | Last places | Median total | First words |
|---|---|---|---|---|
| Vanilla | 1.86 | 1 | 15.1 s | 7.5 s |
| Multi-Agent, composer medium (shipped default) | 2.14 | 2 | 17.6 s | 11.5 s |
| EXP-RAG | 2.21 | 0 | 14.6 s | 8.7 s |
| Multi-Agent, composer low ("Low" in the menu) | 3.29 | 9 | 13.7 s | 6.7 s |

The composer's thinking decides quality; the step-down was removed. Final comparison (all 11 turns, data in
`final/`, PDF `docs/reports/multi-agent-comparison.pdf`): quality effectively tied (mean rank Vanilla 1.82, Multi-Agent
1.91, EXP-RAG 1.95), median total EXP-RAG 14.8 s, Multi-Agent 16.6 s, Vanilla 17.6 s, cost $0.0027 / $0.0033 / $0.0039.

**Why it is not much faster.** Specialists run in parallel, but Oala's answer is written by one model after they finish,
and that model's thinking (3–4 s at medium) plus writing and review is the same serial work every mode does. Parallelism
shortened the gathering (team part now ~2 s after the lookup, down from 5–8 s); it cannot shorten the writing. The only
large remaining lever, a lighter composer, costs quality. The first version (Pathway after all specialists, detailed
specialist notes; rounds 1–2) ranked best on quality but was ~5 s slower than EXP-RAG on team turns.

## Running

```bash
npm run test:multi-agent
```

Isolated live check: start the server with `DATABASE_URL=""` passed as an empty string (not unset, or dotenv loads the
shared database), `YUZEE_STATE_DIR=<scratch dir>`, `YUZEE_WAREHOUSE_DB=<training_gov.db>`, and generated `ADMIN_*` and
`AUTH_SECRET`. Then POST `{message, mode:'MULTI_AGENT'}` to `/api/conversations/<id>/messages` and read the SSE stream.

## Known limits

- **Routing:** the rules are regexes. The corpus and planner refinement cover common intents, but unusual phrasings can fall to level 0 or 1. Add cases to the corpus when that happens.
- **Learning and gaps:** neither Learning nor Pathway waits for Skills (latency). They work from the job sample and the profile summary, and Oala's composer reconciles them with the Skills result.
- **Warehouse data:** job records are a stored sample (`NOT_CONFIRMED_CURRENT`), often older than 120 days, so they are flagged stale. Vacancy outlooks are historical only.
- **Next actions:** `BUILD_PATHWAY` and the other actions are chat prompts or UI hooks. No action writes to external systems, and journey persistence beyond the message record is not built (spec Phase 2).
- **Evaluation size:** 19 judged turns is a small sample; repeat `scripts/collect-modes.ts` with blind judging after prompt changes.
