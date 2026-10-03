# Warehouse intelligence: Neo4j graph + TimesFM forecasts

Ported from Yuzee Dev (`Yuzee Dev/yuzee-backend-ai-lab/workers/warehouse_intelligence` and
`service/warehouse/WarehouseIntelligenceService.java`, commit `3c681bb`). Same contracts, same
pinned model, same graph model. Two differences: the source is this project's SQLite warehouse
(Yuzee Dev reads a verified RDS release), and here the chat actually uses the results — in Yuzee
Dev the read API is off unless `warehouse.intelligence.api-enabled=true` and nothing in chat calls it.

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Worker (Python, Docker) | `workers/intelligence/` | Export → optional official IVI refresh → TimesFM evaluation/forecast → Neo4j projection → `data/intelligence/current.json` |
| Neo4j 5.26.27 Community | `docker-compose.intelligence.yml` | Graph store, localhost-only ports, persistent volume |
| Reader (TypeScript) | `src/intelligence/service.ts`, `forecastArtifact.ts` | Port of the Java read layer: allowlisted, bounded, read-mode queries; artifact SHA + contract checks |
| Chat enrichment | `src/intelligence/enrich.ts`, `server.ts` | Adds graph links and vacancy forecasts to the warehouse pack for every mode |

### Graph (`graph.py`, projection `warehouse-graph-v4`)

Every source row becomes one `WarehouseFact` with exactly one subject and one object
`WarehouseEntity` (Qualification, CourseOffering, Institution, ProviderRegistration, Occupation
(ANZSCO), Skill, RegionKey, ONetOccupation/Skill/Subject, SOCOccupation, EmployerMention,
ForecastSeries…), keeping its source table, ordinal, method, scope and period. A build is a new
`generation`; `WarehousePointer {id:'current'}` moves only after fact counts and endpoints
reconcile, under a renewable single-writer lease. Unchanged inputs reuse the READY generation.
Unresolvable rows are quarantined, never guessed.

Local run: 600,266 facts, 1,200,532 endpoint links. Quarantined: 562 course-job matches with no
target, 11,817 unresolved related occupations, 23 unmapped course maps. SOC: 1,016 identities,
140 derived exact-title links to O*NET, 876 unlinked, 0 identity merges.

### Forecasts (`forecast.py`, artifact `yuzee-forecast-run-v2`)

Pinned TimesFM 2.5 (`google/timesfm-2.5-200m-pytorch@1d95242`, Apache-2.0 weights, SHA-256
checked, runtime `timesfm==2.0.2`, CPU). Only the 45 monthly IVI series (state/national × ANZSCO
skill level 1–5) are eligible; 280 other series are skipped with a reason. Each series gets three
chronological six-month holdouts against last-value and seasonal-naive baselines; the published
method is whichever has the lower error (TimesFM on 33, last-value on 11, seasonal on 1). Only
TimesFM rows carry q10/q50/q90. Freshness is re-evaluated at read time: current advice needs the
last observation within two months and a horizon covering this month.

**Today every series is `HISTORICAL_ONLY`**: the warehouse history ends April 2026. The official
JSA refresh (`ivi_refresh.py`) is built in, but `jobsandskills.gov.au` resets connections from
this network (host and container), so the pipeline recorded `REFUSED_OR_FAILED` and kept the
validated April data. Run the worker from a network that can reach the site to get current
forecasts; no code change is needed.

## Chat use (all modes)

After the warehouse lookup returns READY, `intelligenceForTurn()` (≤2.5 s budget, ~80 ms observed):

- graph links for up to 3 looked-up qualifications (mapped occupations, skills, matched work) and
  3 careers (qualifications, recorded regional demand, O*NET crosswalk);
- for outlook/demand questions, the vacancy-index series for the user's resolved state (else
  Australia) at the skill levels of the careers in play. A current forecast includes method,
  holdout errors and points; a historical series only says no current forecast exists.

The result is `WAREHOUSE_DATA.intelligence` for the existing modes and labelled evidence chunks in
EXP-RAG (forecasts and qualification links anchored). Yuzee Dev's "LOCAL DEMAND, GRAPH LINKS AND
FORECASTS" rules are added to the turn (and to the teaching review) whenever intelligence is
present. Telemetry: `requestTrace.intelligence` (ms, entities, series status).

Endpoints (behind existing auth): `GET /api/intelligence/status`,
`/api/intelligence/connections?entityType=Qualification&sourceId=CPC30220&relation=MAPS_TO_OCCUPATION&limit=10`,
`/api/intelligence/forecast?seriesId=IVI__VIC__SL3__SA__MONTHLY[&includeHistorical=true]`.

## Switches and failure behaviour

- **Per browser:** Settings → Data intelligence & RAG has a *Neo4j relationship graph* and a
  *TimesFM vacancy forecasts* switch (both on by default), sent with each chat turn. With the graph
  off, forecasts are still served from the SHA-verified artifact without the graph consistency check.
- **Per server:** `INTELLIGENCE_GRAPH=off` / `INTELLIGENCE_FORECASTS=off` disable them for everyone
  (status `DISABLED`).
- **Unavailable services never block chat.** Without configuration nothing is attempted
  (`NOT_CONFIGURED`). An unreachable graph fails open (`UNAVAILABLE`) and is skipped for 60 s,
  so later turns pay nothing. The release pointer is cached for 60 s. `neo4j-driver` is loaded
  only when a graph is configured. The whole enrichment has a 2.5 s budget (1.5 s on Vercel).
- **Vercel (free tier):** no Docker there, so leave `NEO4J_*` unset (chat runs without the graph),
  or point `NEO4J_URI` at a hosted Neo4j (e.g. AuraDB) and ship a forecast artifact via
  `WAREHOUSE_FORECAST_FILE` + `WAREHOUSE_FORECAST_SHA256` + `WAREHOUSE_INTELLIGENCE_RELEASE`.

## Running it

```bash
npm run intelligence:up
```

```bash
docker compose -f docker-compose.intelligence.yml run --rm worker cache
```

```bash
npm run intelligence:run
```

The first command starts Neo4j; the second downloads and verifies the pinned weights once; the
third runs the pipeline (~4 minutes). The app picks up the new `current.json` without restarting.
If the numeric history is unchanged, the next run reuses the evaluated forecast and only rebinds it.

`.env` needs `NEO4J_PASSWORD`, `NEO4J_URI`, `NEO4J_USER` and `YUZEE_WAREHOUSE_DB`. Pinning
overrides as in Yuzee Dev: `WAREHOUSE_INTELLIGENCE_RELEASE`, `WAREHOUSE_FORECAST_FILE`,
`WAREHOUSE_FORECAST_SHA256`, `WAREHOUSE_GRAPH_GENERATION`.

Without Neo4j or a forecast artifact the chat behaves exactly as before (status `NOT_CONFIGURED`
or `UNAVAILABLE`, nothing attached).

## Tests

```bash
docker compose -f docker-compose.intelligence.yml run --rm --no-deps worker test
```

```bash
npm run test:intelligence
```

59 vendored worker tests (1 skipped). The Node test covers the artifact contract and tampering,
read-time freshness, enrichment bounds, EXP-RAG chunks and — when the pipeline has published —
live graph and forecast reads.

## Not done

- No schedule. Yuzee Dev also has none in production; trigger the pipeline after warehouse updates.
- Enrolment, council-level and occupation-level forecasts need their own evaluated policies
  (Yuzee Dev's `series_readiness.py` gates); only monthly IVI is forecast.
- Community edition has no role separation; ports are bound to localhost only.
