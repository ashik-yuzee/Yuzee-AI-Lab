# Yuzee objective harness smoke results

Run: 1789719236865-5be60d

Model: gemini-3.7-flash, Interactions API. Original workbook V2 prompts unchanged.

Executed 101/108 selected cases: 96 prepared, 5 separate synthetic cases.

Hard validator passes: 94/101. First-attempt hard passes: 94/101. Retries: 1.

- PASS: 46
- FIXTURE_BLOCKED: 45
- NEEDS_HUMAN_REVIEW: 3
- FAIL: 6
- API_BLOCKED: 1

## Interpretation

Schema passes are not production validation. Missing fixtures are not counted as model-only failures. Semantic evaluator responses are independent calls to the same model, not human certification. No production code, routing, 103-skill registry or right-side workspace behaviour was changed.

The full 3,140-case acceptance run is gated on concrete context/evidence fixtures and resolved schema annotations. Single-turn tests cannot establish multi-turn stopping, persistence, current-data connectors or BGE objective selection.

## Objective results

| Objective | Prepared runs | Hard pass | Overall pass | Fixture gaps |
|---|---:|---:|---:|---:|
| DISCOVER_001 | 8/8 | 8 | 4 | 4 |
| DISCOVER_004 | 8/8 | 8 | 4 | 4 |
| STUDY_005 | 10/10 | 10 | 5 | 4 |
| SKILL_SIDE_001 | 10/10 | 9 | 5 | 4 |
| PROFILE_005 | 10/10 | 10 | 6 | 4 |
| SCHOOL_003 | 10/10 | 10 | 5 | 4 |
| IND_DISCOVER_001 | 10/10 | 10 | 5 | 4 |
| EMP_REALITY_004 | 10/10 | 9 | 3 | 6 |
| EMP_COMPARE_001 | 10/10 | 10 | 4 | 6 |
| EMP_SAFE_001 | 10/10 | 8 | 3 | 6 |

## Next work

1. Review failures against raw responses and separate contract/fixture defects from model defects.
2. Materialise missing confirmed facts, completed results, conflicts and current-source fixtures without changing prepared user prompts or expected behaviour.
3. Finalise typed UI payloads and approved read/tool/navigation catalogues.
4. Re-run complete affected objective suites before promoting any objective.
5. Run full validation, human review of decision-critical failures and separate router/multi-turn tests before integration.
