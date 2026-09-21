# Linked warehouse guidance — Phase 3

The running Node chat now retrieves connected information across course intelligence, vocational/university courses, providers, careers, industries and geographic signals. It uses the existing approved records; this change does not audit their accuracy or modify the warehouse.

The useful path is **user need → relevant records → stored relationships → explanation and interactive workspace → saved choices → next conversational answer**. The model receives a bounded selection, not the full warehouse or every column.

## What changed

- The query planner can request courses, careers, industries and local context, with only the relevant facets. SQL templates and joins remain application-owned.
- Course intelligence now includes learning, practical experience, portfolio suggestions, skill gaps, entry/stretch roles, progression, additional costs, delivery, professional requirements and AI readiness when supplied.
- Stable IDs and stored mappings connect courses to institutions and occupations. Detailed occupations retain their group scope when group data is used. Occupational profiles are selected by the stored crosswalk strength rather than arbitrary row order.
- Industry information uses both named industry records and the existing course-to-sector mappings. Searching an industry can explore linked roles; asking about one course does not automatically expand to unrelated occupations in that sector.
- User-stated suburb/state or postcode resolves to an unambiguous region. Demand lookup can fall back through parent regions while preserving the actual area label. National projections remain national. Unmatched/ambiguous locations remain unresolved.
- Employer signals keep their date and state/region. They are not represented as live vacancies.
- University provider entitlements and vocational course funding remain conditional. Unknown flags stay unknown, and each course retains its own funding record.
- All returned entities have approved evidence references for the objective validator.

## Experience

The useful result stays first. **How the options connect** provides careers, industries, regional information and expandable provider support. **Change area** saves a correction in the same conversation and refreshes the result. Course selection and expanded intelligence remain available below the explanation. The next left-side answer can use those saved choices without copying the result back or clicking “send to chat”.

Purple marks navigation and broader information; green identifies signals matched to the selected geographic area. Text labels and dates carry the meaning, so colour is not the only cue. The existing font and drawer controls remain in use.

BGE still helps find the activity among the 316 objectives. Gemini plans the bounded data lookup and explains the retrieved records. Application rules enforce identity, evidence references, scope, persistence and presentation. No embedding weights were changed by this work. Course scores, relationship strength and user confidence remain different measures.

## Prompt and source contract

The default prompt is **v1.10**, generated from the preserved v1.7 baseline plus current modules. The new connected-data module instructs Gemini to explain useful relationships, preserve locality/date, separate claimed and inferred roles, and use saved workspace choices. Earlier v1.7, v1.8 and v1.9 files are retained. A matching Spring prompt resource is supplied, but the retrieval adapter is connected to Node only.

`docs/warehouse/Linked-Data-Contract.json` lists source domains, join keys, intended uses and interpretation rules. Private learner/contact records are excluded. The source database is opened read-only; a rebuildable local index holds course search and projected mappings. Its source fingerprint is checked on worker startup. Restart after importing new identifiers/mappings; live continuous index refresh is not yet implemented.

## Tests and how to try it

Use the existing 316-activity preview. Ask to compare two named courses, choose one on the right, then request how it connects to careers and your area. In the right-side result, use **Change area** and send a follow-up in chat to exercise shared context.

Fictional test example:

> Keep the selected Box Hill plumbing course. Use Ringwood, VIC as my area and explain how the course skills connect to careers, industries and the local outlook.

Regression coverage includes source immutability, zero/unknown values, exact course/provider searches, saved selections, retries, detailed/group occupation mappings, crosswalk ordering, selected-course scope, ambiguous locations, geographic fallback, national projections, dated employer signals, university funding, standalone career/industry queries and approved evidence references.

The local integration smoke test reads one vocational course, one university course, a standalone career and a standalone industry. It checks that the connection returns usable records, not that all records have every relationship. Missing links remain missing; the code does not invent them to fill a diagram. Outputs are saved under `output/phase3/`.

## Remaining broader platform work

This is connected retrieval over the current local warehouse, not a claim that every table has been vector-indexed. Remaining work includes semantic entity retrieval and unseen-query evaluation, a complete current-vacancy/company adapter, automatic index refresh after imports, production access controls around deployment, and an equivalent adapter for any Spring deployment. Those are separate from the working Node connection delivered here.

## Completion evidence — 19 September 2026

- **73 regression tests passed**: 12 warehouse, 52 objective, 9 shared-context tests.
- Production build and prompt generation checks passed; existing bundle-size warnings remain.
- Four real-warehouse connection checks passed: vocational/local, university, career-only and industry-only. Warm lookups in this small sample took 1–23 ms; this is not an end-to-end latency benchmark.
- The fictional workspace completed its connected local result and saved an area through the new control. The next chat answer correctly used the saved Box Hill course and Ringwood area, separating local context from national projections.
- The live test exposed and fixed arbitrary crosswalk ordering and over-expansion from course-linked industries. Regression cases cover both.
- Results: `output/phase3/acceptance-results.json`; final saved activity: `output/phase3/live-workspace-final.json`.
- The standalone v1.10 prompt was saved alongside prior versions in the user's Dropbox Final folder.
