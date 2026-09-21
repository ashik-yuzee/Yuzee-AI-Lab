# Yuzee objective harness smoke results

Run: 1789718879077-6c0698

Model: gemini-3.7-flash, Interactions API. Original workbook V2 prompts unchanged.

Executed 47/108 selected cases: 47 prepared, 0 separate synthetic cases.

Hard validator passes: 31/47. First-attempt hard passes: 31/47. Retries: 0.

- PASS: 12
- FIXTURE_BLOCKED: 18
- NEEDS_HUMAN_REVIEW: 1
- FAIL: 15
- API_BLOCKED: 1

## Interpretation

Schema passes are not production validation. Missing fixtures are not counted as model-only failures. Semantic evaluator responses are independent calls to the same model, not human certification. No production code, routing, 103-skill registry or right-side workspace behaviour was changed.

The full 3,140-case acceptance run is gated on concrete context/evidence fixtures and resolved schema annotations. Single-turn tests cannot establish multi-turn stopping, persistence, current-data connectors or BGE objective selection.

## Objective results

| Objective | Prepared runs | Hard pass | Overall pass | Fixture gaps |
|---|---:|---:|---:|---:|
| DISCOVER_001 | 8/8 | 8 | 3 | 4 |
| DISCOVER_004 | 8/8 | 8 | 4 | 4 |
| STUDY_005 | 10/10 | 3 | 0 | 4 |
| SKILL_SIDE_001 | 10/10 | 6 | 3 | 4 |
| PROFILE_005 | 10/10 | 6 | 2 | 4 |
| SCHOOL_003 | 1/10 | 0 | 0 | 0 |

## Next work

1. Review failures against raw responses and separate contract/fixture defects from model defects.
2. Materialise missing confirmed facts, completed results, conflicts and current-source fixtures without changing prepared user prompts or expected behaviour.
3. Finalise typed UI payloads and approved read/tool/navigation catalogues.
4. Re-run complete affected objective suites before promoting any objective.
5. Run full validation, human review of decision-critical failures and separate router/multi-turn tests before integration.
