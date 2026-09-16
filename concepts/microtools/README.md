# Explore together — isolated micro-tools concept

**Decision:** test a small, understandable exploration experience before connecting the entire registry or introducing a routing model. The current chat, research component, main prompt and server are not changed by this concept.

Open **http://127.0.0.1:3001/**. This is a separate React/Vite application rooted at `concepts/microtools/client`, with its own stylesheet and build output. Micro-tool answers still use fixtures. An optional separate Gemini conversation adapter now runs on port 3002 and is proxied only under `/api/concept`; the API key stays on that server. There is no analytics service or application-database connection. Read `STREAMING-REVIEW.md` for the 16 September conversation update. All sessions and test events are held in tab memory; reloading clears them. The five journey sessions remain separate while switching between them.

## What is working

- Five sample journeys: study, career change, employers, curriculum review and industry exploration.
- 22 reviewed sample adapters using the supplied registry’s actual tool IDs.
- Immediate answer, three suggested questions initially, and up to five after expanding the additional choices.
- Specific skill/role choices carry stable entity IDs. Suggestions follow explicit registry edges, prefer entities in the current answer and omit already completed identical requests.
- Small forms collect missing details before execution. Location is typed, never inferred or requested from the device. Known details are carried down a branch.
- Course comparison requests a different second course; it never silently chooses one.
- Breadcrumbs and saved answers allow branching without overwriting earlier results. Switching journeys cancels an in-flight sample request.
- A conversation area with visible user turns, short responses, explicit uncertainty and one follow-up question. Sample mode uses scripted counselling; optional Gemini mode supports broader wording. Micro-tool cards remain explicit actions. The earlier deterministic question matcher remains in the engine but is not the current chat interface.
- Clearly marked sample content, unknown information, an unconnected-fee state, and simulated empty/error responses with recovery.
- A stopping point: “I have enough for now.”
- A concept lab showing selected metadata, explicit click events, a portable response projection and simulation controls. Event downloads omit profile text, questions and location.

This is **an interaction POC**, not an assessment engine. It does not determine admission, funding, employment suitability, skill proficiency or real course quality. All organisations/course names and relationships are sample content. No result has a real source or evidence date; the source disclosure says so. The original micro-prompt bodies are retained for later integration, not executed or bundled into the frontend. Live counselling uses a separate short concept prompt; the existing main prompt remains unchanged.

## Registry findings

The supplied CSV contains **105 TOOL rows and 40 RULE rows**, with no duplicate IDs. All literal next-tool IDs exist. Two entries also contain prose, which must not be interpreted as executable IDs:

| Source | Non-executable target |
|---|---|
| CORE_006 | domain-specific detail tools |
| CORE_009 | Any action-capable RMO or micro-tool |

`required_inputs`, `output_fields` and `allowed_next_tools` are descriptive strings, not runtime schemas. Examples include `course_id or qualification_type` and broad target/profile fields. A generic semicolon splitter is insufficient for executing all 105 tools. The POC explicitly reviews input forms for its enabled subset and retains the broader catalog only as metadata.

The registry specifies evidence rules, but it does not supply provider data, entity taxonomy IDs, curriculum records, job feeds, source dates, skill assessments or credentials. Those must come from real services. Example courses and entities in this concept use stable **sample IDs**, not claimed provider or official classification IDs.

`reference/registry.json` preserves all CSV fields, including the prompt text and 40 rules. `reference/audit.json` records the structural findings. `client/catalog.json` contains only tool metadata and deliberately omits prompt bodies.

## How a click works today

1. The current answer already gives the basic information.
2. The rule engine considers reviewed tools listed in that answer’s registry `allowed_next_tools`.
3. It binds known entities, applies fixed priorities, and suppresses completed tool + entity + relevant-input combinations. This is a POC heuristic, not a validated personalised ranking algorithm.
4. If required information is missing, a short form opens. This is a preparation step, not a premature service call.
5. An explicit `MICRO_TOOL` event carries its parent answer, tool ID, entity references and submitted input values. The event is not disguised as user chat text.
6. The fixture adapter returns a typed result. A single answer component renders the summary, findings, unknowns and source disclosure. Comparison uses a dedicated two-option layout.
7. The new answer stores its parent and context. The user can continue, return to an earlier answer or stop.

The sample stream exercises loading and cancellation. A compact status row rotates neutral titles within its current phase. In live conversation mode, Gemini chunk signals drive the phase; no thought text or incomplete JSON is sent to the answer UI. Slow, no-summary, invalid and interrupted sample streams are available in the lab.

## Contracts to retain when connecting a backend

The executable TypeScript definitions are in `client/engine.ts`. The lab displays actual events and the `portableResult` projection.

A request includes `version`, `conversationId`, `parentMessageId`, `action.type`, `action.toolId`, `action.entityRefs` and `inputValues`. Display labels are advisory; a backend must resolve canonical entities and allowed actions from its own trusted state. Sample request values are limited to the chosen tool’s reviewed fields. Existing parent context is hydrated by ID, not sent as an unrestricted transcript.

The portable response includes `schema_version`, `tool_id`, `mode`, `status`, `entity_context`, `concise_summary`, `findings`, `evidence_state`, `sources`, `unresolved_questions` and `next_actions`. Next actions include stable entity references and missing input keys. In this POC, findings use `SAMPLE` or `UNKNOWN`, sources are empty, and all results have `mode: fixture`.

**The POC’s flat findings are a display model, not a replacement for every tool’s domain data.** A production response should preserve typed domain payloads as well: skill maps need taught/practised/exposed distinctions and unit evidence; comparisons need common factors and comparable periods; trend results need period and geography; funding needs fee, eligibility and estimated cost separately. Add a versioned `data` schema per tool and adapt it into these display components. Do not throw away domain fields to fit a generic text box.

## Recommended next connection

Keep the existing main prompt as the counsellor and initial answer producer. Add a separate backend micro-tool executor; there is no reason to replace that prompt to test this interaction.

1. Start with **COURSE_007**, **COURSE_008** and **COURSE_002**, using one real course provider or a controlled provider dataset. Keep fees unavailable until a dated fee/funding source exists.
2. Replace sample IDs with canonical provider IDs, course version/intake, typed entity relations and evidence provenance.
3. Define request, domain-output and display-output JSON schemas for those three tools, including maximum sizes, missing-input and unavailable/error states. Validate on the server, then validate untrusted responses again before rendering. The current fixture renderer is not a production untrusted-output validator. The separate live counselling envelope now has server and client shape validation; this does not add domain/evidence validation to all micro-tools.
4. The backend validates the event, authorisation, parent context and enabled tool; resolves missing fields; retrieves only required data; then invokes the selected registry mini-prompt with that evidence and bounded context. Fetch the evidence before asking a model to analyse it. Independent source requests may run concurrently. Do not have a prompt invent facts while waiting for them.
5. If evidence is absent, return `unavailable` or a clarification. If it conflicts, show both sources, dates and what remains unresolved. Derivations must not appear as confirmed facts. Do not stream partially validated factual output into the answer card.
6. Return the structured micro-result and validated next actions. Use a renderer adapter beside the current chat component only after the concept is accepted. Keeping this entire concept on port 3001 means no integration has occurred yet.
7. Add deadlines, cancellation, safe retry, request IDs/idempotency, rate limits, versioned caching, source freshness rules, consent-aware profile use and per-user isolation. Restore conversations only through an explicitly designed storage policy.
8. Run real usability sessions before expanding the catalog. Only consider a small model for reranking already eligible options if those sessions show deterministic ranking is inadequate. It must not invent IDs or bypass input/source constraints.

The supplied note discusses a later Spring/Angular/Ionic architecture. This local project currently uses Express/React. The request/response contracts can cross either stack; no Spring service has been created or assumed.

## Scope of the 22 adapters

| Area | Enabled IDs |
|---|---|
| Course | COURSE_001, COURSE_002, COURSE_007, COURSE_008, COURSE_011 |
| Skill | SKILL_001, SKILL_002, SKILL_003, SKILL_009 |
| Career | CAREER_001, CAREER_002, CAREER_003, JOB_004 |
| Company | COMP_001, COMP_002, COMP_003 |
| Curriculum | INST_004, INST_006, INST_007 |
| Industry | IND_001, IND_003, IND_004 |

The remaining 83 tools are catalogued, not enabled. Core routing and action-execution tools are intentionally outside this first interaction slice. Some registry paths therefore have fewer than two next actions or end early; the interface offers returning to earlier answers and stopping rather than fabricating unsupported actions. The 40 shared rules are design requirements, **not a claim that all 40 have been implemented or verified**.

## Local commands

Run from the repository root using the existing dependencies:

```sh
node node_modules/vite/bin/vite.js --config concepts/microtools/vite.config.ts
node --import ./node_modules/tsx/dist/loader.mjs concepts/microtools/server/chat.ts
node --import ./node_modules/tsx/dist/loader.mjs concepts/microtools/tests/engine.test.ts
node --import ./node_modules/tsx/dist/loader.mjs concepts/microtools/tests/stream.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build --config concepts/microtools/vite.config.ts
```

The concept build goes to `concepts/microtools/build`, which is ignored. It does not replace the current application’s build output. Read `SCENARIOS.md` for acceptance checks and remaining user research.
