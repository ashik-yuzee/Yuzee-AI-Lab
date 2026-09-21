# Connected skills, jobs and learning — evaluation and implementation

19 September 2026 · Node chat runtime · Prompt v1.11

## Finding

The warehouse contains enough connected information to support useful exploration now. The previous runtime mainly started from a named course or career. It did not reliably support the reverse journey: what I have done → work I could explore → skills to build → learning options → evidence from my area.

The main gaps were in access and interpretation: a keyword gate skipped misspelled follow-ups, different occupational titles did not resolve consistently, common skills retrieved unrelated occupations, and workspace choices did not express whether a skill was experience, a learning intention or uncertainty. This evaluation inspected schema and integration behaviour. It did not re-audit the user's approved source data.

## What is connected now

| User need | Runtime capability | Existing activity examples |
|---|---|---|
| What jobs could use my skills? | Retrieve occupation profiles by skill/title/alias; rank bounded candidates locally with pinned BGE | JOB_DISCOVER_002; SKILL_SIDE_005 |
| What does this work involve? | Occupation tasks, skill descriptions and stored Australian occupation mappings | JOB_SKILL_001 |
| What should I develop? | Combine selected roles with self-reported skill states, learning interests and unknowns | SKILL_SIDE_001; LEARN_002 |
| Where could I learn it? | Follow qualification-to-skill/unit links to course records and course intelligence | LEARN_002; SCHOOL_039 |
| What is happening around me? | Dated public Australian job adverts, recorded occupation demand and regional/national signals | JOB_DISCOVER_010; EMP_SKILL_001 |
| Can my choices inform the conversation? | Save role/skill choices and area changes in the existing versioned workspace; include them in the next Oala turn | Shared conversation context |

Three reusable data capabilities were added in `src/warehouse/capabilities.json`. The catalogue remains 316 objectives. Existing objectives receive the new records rather than being duplicated. Targeted activity selection metadata was expanded; the workbook execution contracts are retained.

## Responsibilities

1. Gemini interprets the current question, recent relevant context and corrections into bounded search phrases and data facets.
2. The application retrieves whitelisted fields through fixed SQL and relationship joins. It owns geographic resolution, public-record filtering and evidence identifiers.
3. BGE runs locally to rank occupation candidates by relevance. The existing BGE activity search plus Gemini selector separately chooses a useful objective.
4. Gemini explains the supplied records and their practical implications. It does not write SQL or claim access to data that was not returned.
5. The right workspace provides role choices, skill states, learning links, job examples and area refinement. Saved inputs become available to the next left-side answer without a send-to-chat step.

No extra external model call was added for occupation ranking. The pinned BGE model is loaded from the existing local cache with local-files-only enabled. Model weights were not trained or changed.

## Evidence and meaning

These concepts are deliberately separate:

- **I've used this:** the user reports experience; it is not verified competence.
- **I want to learn:** an intention; it does not establish lack of ability.
- **I'm not sure / not answered:** unknown; it is not a negative assessment.
- **Occupation skill:** a typical requirement in a general profile; it is not evidence about the user.
- **Qualification link:** related skill/unit content; it is not proof of a particular provider's delivery, assessment or user completion.
- **Job skill observation:** a structured skill listed in a retrieved advert. Counts retain the sample denominator, geographic scope and dates.
- **Occupation demand:** a dated occupation/region indicator, not a local skill-specific demand score.

Similarity, course quality and demand are not converted into user confidence. User confidence/readiness remains governed by the existing evidence and decision rules. Saving a checkbox does not automatically increase it.

## Data accessed

The source stays read-only. A derived local full-text index contains only the public fields needed for retrieval.

- Occupational profiles/tasks/aliases: `onet_occupation`; skills: `onet_job_skill`.
- Australian mapping: `onet_anzsco_crosswalk` and existing canonical occupation links.
- Learning: `course_skill_edge` → national qualification code → `live_courses` and course intelligence.
- Public advertisements: `outside_jobs`, restricted to PUBLIC, active, Australian records; expired records are excluded at retrieval. Private contacts, user IDs and notes are not projected.
- Locality: `region_spine`, `dim_location_asgs`. Exact suburb/state is attempted before postcode, wider SA4 and state fallbacks; broader scope stays labelled. Ambiguous areas do not silently become unrestricted searches.
- Existing industry, provider, funding, occupation demand and projection links remain available.

The inspected source contained 241,090 stored advertisement records, 19,579 occupation-skill rows and 68,164 course-skill edges. Those counts describe available tables, not records sent to Gemini. The dedicated `fact_job_skill_demand` table was empty at evaluation time. Therefore this release does **not** manufacture an authoritative local skill-demand ranking; it can expose structured skills in a bounded retrieved sample and clearly distinguish that from occupation-level demand.

## Interaction and recovery

Users can choose up to three displayed roles and mark displayed skills. The server validates the IDs and supplies names from the retrieved records, ignoring client-supplied labels. A save creates a correction receipt before model execution. Failed generation retains the choices for retry. Historical answers remain available, and the next main-chat turn recalls saved user contributions as self-reported information.

Selecting a linked course opens it through the existing course-focus operation. Course selection is exploration, not enrolment. Nothing writes to the warehouse, submits a job application or changes an external user profile.

## Validation

- 81 regression checks passed: 20 warehouse/skills checks, 52 objective checks and 9 shared-context checks.
- Production build passed. Existing large-bundle warnings remain.
- Read-only source smoke checks covered customer service skills, plumbing learning links and IT support.
- Live Gemini checks used fictional retail-to-work and misspelled IT-support scenarios, plus a no-search boundary. A real objective execution returned valid, complete workspace output.
- Seven fictional BGE/Gemini routing checks: expected activity present in all five positive shortlists; acceptable final activity selected in all five; both opt-out/social cases returned NONE.
- Persistence tests cover invalid IDs, failed generation, retry, reload and next-chat recall. Data tests cover private/draft/expired/overseas adverts, exact suburb matching, broader-area labels, evidence references and unknown skill states.

Browser acceptance used a new fictional retail worker in Ringwood. BGE shortlisted the skills-to-jobs activity and Gemini selected it; an explicit request now opens the workspace without relying on the generic proactive similarity cutoff. The user selected Customer Service Representative, marked Active Listening as experience, Complex Problem Solving as a learning intention and Critical Thinking as unsure. Those controls survived reload/restart. The next Oala response used the saved role and skill states without repeating the inventory, and labelled stored adverts as historical observations.

A live wording failure initially described the learning intention as a gap and over-implied a diploma requirement. Both conversation and workspace instructions were strengthened; the repeated save described it as a chosen learning area. This is a prompt-level improvement, not proof that unsupported claims can never recur.

These are focused development checks, not an independent estimate of real-user satisfaction or all-316 routing accuracy. Test outputs are in `output/skills-exploration`; scripts are `scripts/test-skills-connection.ts`, `test-skills-live.ts`, and `test-skills-routing.ts`.

## Remaining limits and next work

This is a working bounded retrieval connection, not an unrestricted vector index of the whole warehouse. Occupation retrieval still depends on the initial candidate pool and stored aliases; BGE cannot recover a role omitted from it. The local ranking cut-offs are conservative development settings, not calibrated probabilities.

1. Extend canonical skill identity/alias alignment across O*NET, the skill dictionary, course units and job requirements. Course unit codes and skill dictionary IDs must not be assumed interchangeable.
2. Connect a populated, dated, geographically scoped skill-demand aggregate before offering market-wide learning-priority scores. Keep structured sample observations as a separate measure.
3. Add indexed semantic retrieval across remaining public job/company and university intelligence fields, with public projections and evidence lineage retained.
4. Add change-driven index refresh; currently the derived index rebuilds on source fingerprint change when the worker starts.
5. Expand independent tests across unseen conversations, occupations, regions, ambiguous locations, sparse records, changed goals, short replies and long histories. Measure retrieval coverage, final activity selection and usefulness separately.
6. Reduce browser cold-start activity-index latency and test interrupted workspace preparation; model loading and index construction can delay the first automatic activity.
7. Remove remaining internal enum labels from generated tables and constrain one-next-step guidance. The browser follow-up gave a main recommendation with three sub-actions; that is still more than the requested one step. Independently assess evidence-to-claim fidelity, rather than treating schema-valid output as factually correct.
8. Complete a corresponding Spring retrieval adapter before claiming backend parity.

The default Node prompt and matching Spring prompt resource are v1.11. Older prompt versions remain preserved. Updating a prompt file does not itself implement warehouse retrieval in a different backend.
