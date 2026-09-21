# Yuzee objective harness smoke results

Run: 1789719819172-822584

Model: gemini-3.7-flash, Interactions API. Original workbook V2 prompts unchanged.

Executed 12/12 selected cases: 0 prepared, 12 separate synthetic cases.

Hard validator passes: 7/12. First-attempt hard passes: 6/12. Retries: 1.

- PASS: 6
- FAIL: 6

## Interpretation

Schema passes are not production validation. Missing fixtures are not counted as model-only failures. Semantic evaluator responses are independent calls to the same model, not human certification. No production code, routing, 103-skill registry or right-side workspace behaviour was changed.

The full 3,140-case acceptance run is gated on concrete context/evidence fixtures and resolved schema annotations. Single-turn tests cannot establish multi-turn stopping, persistence, current-data connectors or BGE objective selection.

## Objective results

| Objective | Prepared runs | Hard pass | Overall pass | Fixture gaps |
|---|---:|---:|---:|---:|
| SCHOOL_003 | 0/10 | 0 | 0 | 0 |
| DISCOVER_001 | 0/8 | 0 | 0 | 0 |
| PROFILE_005 | 0/10 | 0 | 0 | 0 |
| STUDY_005 | 0/10 | 0 | 0 | 0 |
| SKILL_SIDE_001 | 0/10 | 0 | 0 | 0 |
| IND_DISCOVER_001 | 0/10 | 0 | 0 | 0 |
| EMP_COMPARE_001 | 0/10 | 0 | 0 | 0 |
| DISCOVER_004 | 0/8 | 0 | 0 | 0 |
| EMP_REALITY_004 | 0/10 | 0 | 0 | 0 |
| EMP_SAFE_001 | 0/10 | 0 | 0 | 0 |

## Next work

1. Review failures against raw responses and separate contract/fixture defects from model defects.
2. Materialise missing confirmed facts, completed results, conflicts and current-source fixtures without changing prepared user prompts or expected behaviour.
3. Finalise typed UI payloads and approved read/tool/navigation catalogues.
4. Re-run complete affected objective suites before promoting any objective.
5. Run full validation, human review of decision-critical failures and separate router/multi-turn tests before integration.
