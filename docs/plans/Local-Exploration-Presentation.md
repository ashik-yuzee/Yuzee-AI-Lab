# Local exploration presentation

20 September 2026 · Node preview · Quiz prompt v1.11 / protocol v1.3

## Counselling correction, 20 September

The initial local-first chat instruction below made a readable answer behave like a regional report. It is superseded by the counselling-first rules in `src/warehouse/localGuidanceSnippet.ts`. The preserved v1.7 human-counsellor and person-before-process principles remain authoritative for the conversation. The runtime still uses v1.11; this change does not replace the baseline file.

- Treat uncertainty as a request for help finding a starting point, not a request for an area profile.
- Use one manageable activity contrast, explain why it helps, and connect subsequent answers to evidenced local possibilities.
- If a user cannot answer the discovery question, stop the intake for that turn and offer an optional everyday observation. Do not simply switch to asking what they dislike.
- Use retrieval as evidence, not a mandatory list of facts to display. Answer explicit demand/statistics questions fully, with area/date/forecast boundaries.
- Keep community, work and outlook information accessible in the workspace under a closed disclosure. Preserve saved answers and exploration controls.

Validation: nine warehouse/presentation tests and the existing counselling policy suite passed. Four final synthetic Gemini 3.7 Flash cases were reviewed: unsure Horsham resident, unable to answer, a practical-interest follow-up, and an explicit request for demand figures. All returned accepted protocol, no hub/geography lecture, and statistics appropriate to the request. The unable-to-answer case returned no active question. Earlier iterations that still produced broad/dislike questionnaires were retained as diagnostic evidence, not counted as final passes.

Final live evidence: `output/local-counselling/2026-09-20T04-04-42-157Z/`. Prompt hash: `4553f17688881c5bed927d474b89eefac46d1115ef42d30b3a1e232215c022db`. These are four synthetic planner tests using the same public warehouse fixture, not a satisfaction study or a full BGE routing evaluation. The workspace disclosure was checked in the running app. Saved older assistant text is not rewritten. User preference remains uncertain until the user supplies evidence; one example is a clue, not proof of personality or ability.

## Result

Interest discovery with a resolved location now starts with a readable local guide: introduction, community places, recorded work and employer counts, then dated demand and future outlook. The existing “Explore this further” interaction remains. Saved interests, answer history and context corrections continue to work.

The main chat renders legacy literal bullet paragraphs as separate semantic list items and supplies explicit paragraph/list spacing. New prompt instructions request structured lists, short sections and one question in the interaction rather than repeating it in the prose.

The workspace uses a single column, restrained purple icons, section dividers and a small jobs table. Source details, longer role descriptions and the roles/skills explorer are expandable. The repeated raw Unknowns result inventory no longer precedes the question. Confirmed interest themes and their summary remain visible after answers.

## Data connection

- `local_area_exploration` / `01F_LOCAL_EXPLORATION` connects the existing DISCOVER_001 activity to the regional hierarchy, regional profiles, public community directory, recorded occupation demand and employment projections.
- Public community fields are projected explicitly. Emails, phone numbers, addresses and private notes are not included. Proposed organisations are excluded. Exact name/type/place duplicates are removed; remaining counts describe named records, not an audited organisation census.
- Region and year are retained on profiles. Community names use the matched region or exact suburb plus state. Ambiguous locations do not borrow records from another area.
- Counts of advertisements and employers retain their region and period. Employer counts are not summed across roles, and stored advertisements are not presented as confirmed open vacancies.
- Regional archetype names resolve the numeric-only occupation label seen in the Horsham example. Projections remain separate from current demand and personal suitability.
- The source warehouse was read only. The current projection changes do not modify its records.

## Validation

26 warehouse/presentation checks and 52 objective checks passed. Production build passed, with the existing large-bundle warnings. Tests include bullet repair, unchanged code/decimals, missing data, ambiguous geography, duplicate and proposed organisations, private-field exclusion, ordered presentation, separate forecast scope, saved selections and model request validation.

A fictional Horsham conversation was tested live through Gemini and the browser. The main response used readable sections and separate work options. BGE/Gemini suggested the existing interest activity; opening it displayed the local guide and interest question. Two selected interests were saved, the activity completed, and subsequent guidance retained Horsham and produced two interest themes. The final layout was checked with a narrow right-side drawer, and the longer skill controls were collapsed by default.

Fictional evidence is saved in `output/local-exploration-ux/`. This is an implementation and focused usability check, not a measured user-satisfaction study or validation of all regions. Existing answers get the rendering repair without regeneration; additional community context and prompt wording enter when the warehouse/model is next called. The new reader is implemented in the Node preview; the mirrored Spring prompt does not by itself add a Spring warehouse adapter.
