# Warehouse connection inventory

Checked 19 September 2026 against the local application source, read-only SQLite metadata/aggregates, and HTTP endpoints. This is an integration inventory, not a certification of course facts.

## Current state

The warehouse and chat run independently. The warehouse is available on port 8090; the chat on port 3000 uses prompt v1.8. No warehouse evidence is yet inserted into Gemini requests or BGE retrieval. No records have been published, edited or enriched as part of this inspection. Starting the warehouse uses its normal startup migrations/cache warming.

| Component | Location |
|---|---|
| Warehouse project | `/Users/freshfuturesaustralia/My Drive/06 Backend Development/yuzee-monitor/training-gov-db` |
| Server | `src/server.js` within that project |
| Database | `/Users/freshfuturesaustralia/.yuzee-monitor/training_gov.db` |
| Chat project | `/Users/freshfuturesaustralia/Documents/Codex/2026-09-14/https-github-com-ashik-yuzee-yuzee/Yuzee-AI-Lab` |
| Historical reports | Google Drive folder `06 Backend Development/01 Databases/RAG` |

The historical MongoDB audit and this SQLite database are different inspected sources. Do not treat old audit counts as current SQLite findings.

## Starting the warehouse

Run from the warehouse directory, not the home directory. Preserve the existing environment configuration; do not copy credentials into prompts.

```sh
cd "/Users/freshfuturesaustralia/My Drive/06 Backend Development/yuzee-monitor/training-gov-db"
PORT=8090 HOST=127.0.0.1 node --experimental-sqlite src/server.js
```

The listener was changed from `app.listen(PORT, ...)` to `app.listen(PORT, process.env.HOST || '127.0.0.1', ...)`. This keeps the existing development authentication bypass on loopback. A production deployment needs authenticated service access. Do not use the old command that kills every process on port 3000; that port belongs to the chat.

## Read endpoints identified

| Endpoint | Use | Caveat |
|---|---|---|
| `GET /api/health` | Availability | A healthy process does not prove search performance or data quality. |
| `GET /api/live-courses?q=...&limit=...` | Candidate lookup | Broad SQL text matching, not semantic retrieval. Returns large enrichment fields and global dashboard counts. Both initial and follow-up attempts exceeded 20 seconds. |
| `GET /api/live-courses/:id` | Exact provider-course record | Returns stored fields and `govData`; none is automatically fresh or verified. |
| `GET /api/live-courses/compare?national_code=...` | Same qualification across providers | A national code is not a unique provider offering or intake. |
| `GET /api/live-courses/:id/units` | Course structure | Check source, version and actual availability. |
| `GET /api/live-institutions` | Provider candidates | Must project an approved set of public fields, not forward complete administrative records. |
| `GET /api/live-institutions/:id` | Exact institution | Verify the identifier relationship to course `institution_id`. |
| `GET /api/courses/:code` | NRT reference course | Keep national qualification requirements distinct from provider-specific delivery. |

Other routes exist, including private learner/user records, mutations, and a GraphRAG module. They are outside this read-only pilot. The GraphRAG query route has not been validated or called; its existence does not establish a working RAG connection.

### Observed performance

After cache warming, health returned in 35 ms and course ID 1 returned in 5 ms. A search for `plumbing` with only two requested results exceeded the 20-second client timeout. An institution-list request made afterwards also timed out; this does not isolate its own cost because a prior synchronous database query may still occupy the server.

`EXPLAIN QUERY PLAN` confirms that course search performs a full table scan for the count, another scan for results, and a temporary sort. The server uses synchronous SQLite calls, so expensive searches can delay unrelated endpoints even after a client aborts. These are warehouse execution issues, independent of BGE or Gemini. The plan explains a likely bottleneck; it is not a complete database performance profile. No search/index changes have been applied. A compact indexed search projection, exact-ID fetches and bounded/background query execution should be evaluated before chat integration. Raw checks and query plans are saved in `output/phase1/warehouse-verification.json`.

## Proposed evidence mapping

| Evidence concept | Candidate stored fields | Integration rule |
|---|---|---|
| Exact identity | `id`, `national_code`, `course_code`, `cricos_code`, `institution_id` | Resolve stable IDs first; distinguish a qualification, provider course, offering and intake. |
| Name and provider | `course_name`, `institution_name` | Display labels; never use them as unique IDs. |
| Course level/type | `aqf_level`, `course_type`, `is_apprenticeship_traineeship` | Typed filters and explanatory labels. Unknown remains unknown. |
| Delivery and location | `delivery_modes_json`, `delivery_options_json`, `locations_json`, `study_load` | Preserve applicability and provider/intake scope; do not infer availability. |
| Duration | `duration_weeks`, `duration_text` | Distinguish full/part-time and actual intake conditions before comparing. |
| Cost | `domestic_fee`, `international_fee`, `fees_json`, `funding_options_json` | Preserve currency, year, student category, subsidy eligibility and what the fee covers. Missing qualifiers block a definitive personal fee claim. |
| Entry | `entry_requirements`, `prerequisites_json`, `english_requirements_json` | Separate general guidance from actual provider and intake requirements. |
| Source and time | `data_source`, `canonical_url`, `website`, `web_collect_url`, `scraped_at`, `web_collect_at`, `updated_at`, `validated_at` | An update or enrichment date is not a verification date. A source URL alone does not prove each claim. |
| Publication and review | `published`, `yuzee_status`, `hold_publish`, `promotion_state`, rejection metadata | Enforce eligibility before data reaches the model. Current course projection omits several of these controls. |
| Generated analysis | `intelligence_json`, `intelligence_enriched_at`, readiness scores and generated skill/pathway fields | Keep separate from source evidence; preserve origin and uncertainty. Do not relabel as confirmed facts. |

The warehouse spells one field `availabilty`. Map it deliberately at the adapter boundary; do not silently assume a differently spelled field exists.

The initial normalized evidence pack should carry an evidence ID, exact entity ID/type, claim and value, applicability, source URL/type, observation/verification timestamps, publication eligibility, origin (source or generated), and explicit unknowns/conflicts. The model receives a small allowlisted pack, never raw database access or the full administrative record.

## Current data findings

| Read-only aggregate | Result |
|---|---:|
| Live courses | 147,410 |
| Draft courses | 147,409 |
| Published courses | 1 |
| Courses with `hold_publish = 1` | 0 |
| Courses with a non-empty `validated_at` | 0 |
| Courses with a non-empty `canonical_url` | 0 |
| Courses with a non-empty `intelligence_json` | 147,410 |
| Live institutions | 4,119 |
| Published institutions | 0 |

These counts do not prove that every intelligence JSON value is meaningful, that every record lacks all alternative source links, or that every course is factually wrong. They show that publication and verification cannot be assumed. One inspected draft course also lacked scrape/web-collection dates and URLs. A test pilot may use an explicitly labelled, approved draft subset; production must not silently bypass publication or verification policy.

## Connection sequence

1. Define the pilot's eligible data subset and what may be stated as evidence. Establish claim-level provenance for cost, availability and entry requirements.
2. Provide narrow, bounded course/institution lookup and exact-ID retrieval. Include hold/validation metadata and avoid returning full enrichment payloads for every search candidate. Measure cold and warm latency.
3. Add a server-owned adapter to the chat with timeouts, input validation, entity resolution and an evidence allowlist. Keep private contacts, learner records, internal notes and credentials out of model context.
4. Supply evidence to the main answer or one selected objective. Change runtime capability flags only when this path is actually connected. Shared user answers remain a separate source of context.
5. Test exact names, ambiguous providers, unmatched courses, different locations/intakes, unknown fees, stale evidence, draft/held records and timeouts. Confirm failure never becomes an invented answer.
6. Then evaluate BGE retrieval and final activity selection independently. The embedding model retrieves candidates; Gemini and application rules choose useful actions and use evidence.

The next step is a constrained read-only retrieval pilot, not importing every field into embeddings or promising that all 316 objectives now have live data.
