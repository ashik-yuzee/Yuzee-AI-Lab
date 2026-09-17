# Input handling for all 103 user-facing skills

Reviewed 17 September 2026. The two internal CORE tools remain excluded.

The individual review is `docs/plans/skill-input-review.tsv`; the runtime contracts are `src/routing/skillInputContracts.json`. Categories are default task modes, not mandatory forms:

- 29 explanation skills: explain a known topic without personal intake.
- 53 scoped skills: resolve the subject, comparison endpoints or market. Reuse conversation context. Missing source evidence is a retrieval limitation, not a user-profile question.
- 21 personal assessment/planning skills: need relevant evidence about the person or team for a tailored conclusion. General teaching remains available without that information.

`skillInputInstruction` is included by `scopedInstruction` after the existing task and learning-depth instructions. It refines legacy required-input lists without replacing the master prompt or canonical JSON schema. It is also sent to the bounded teaching reviewer, which cannot change the interaction.

Gemini must distinguish what is known from explicit relevant user context, what needs clarification, and what needs external evidence. MiniLM ranks topics; its score does not establish field completeness or answer reliability. These contracts guide Gemini; they are not deterministic entity extraction or a new retrieval connector.

The chat should answer first where useful, ask one decision-changing missing question only when necessary, reuse known facts, allow uncertainty or declining, and never request system IDs or unnecessary identifying details. Location must be user-entered. Full service forms are not opened by these skill rules. Suggestions remain hidden whenever a Gemini question is active.

`continueSkillQuestion` carries the allowlisted selected skill across a validated structured answer to the latest skill-owned question. It rejects mismatched IDs, empty or invalid answers, failed responses, service/safety boundaries, topic navigation menus and explicit direction changes. It does not force ordinary free-text follow-ups into a previous skill; those retain normal conversational handling. If ownership metadata is unavailable, it safely abstains.

Verification: `npm run test:skill-inputs`, existing routing/skill/needs/learning/tool tests, and `npm run build`. The new tests cover all 103 request assemblies and question-continuation boundaries. They do not certify all 103 live Gemini answers. Before production approval, evaluate each skill with enough context, missing essential context, unavailable sources, correction and uncertainty scenarios, and verify factual claims separately.

Rebuild the HTML report with `python3 scripts/build-skill-input-report.py`. Report: `output/html/Yuzee-103-Skill-Input-Review.html`. The project CSV and original Dropbox CSV were synchronised on 17 September 2026. All 103 user-facing rows include the exact runtime input contract and assembled selected-skill instruction. The existing 2 internal tools and 57 rules are preserved. This was a verified export, not automatic cloud synchronisation.
