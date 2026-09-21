"""Package the isolated harness checkpoint, never the production app or keys."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path.cwd()
output = root / "outputs/2026-09-18-objective-harness"
report = json.loads((root / "qa/objectives/reports/phase-a-smoke-2026-09-18/reports/results.json").read_text())
archive = root / "output/handover/Yuzee-316-Objective-Validation-Checkpoint-2026-09-18.zip"
archive.parent.mkdir(parents=True, exist_ok=True)
members = {}
for file in (root / "qa/objectives").rglob("*"):
    if file.is_file() and "__pycache__" not in file.parts:
        members[str(file.relative_to(root))] = file.read_bytes()
for name in ["Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL.xlsx", "Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL_ObjectivePrompts.csv", "writeback.json", "writeback-v0.2.2.json"]:
    members["updated-workbook/" + name] = (output / name).read_bytes()
members["Yuzee-316-Objective-Harness-Results.html"] = (root / "output/html/Yuzee-316-Objective-Harness-Results.html").read_bytes()
for name in ["update.mjs", "preserve_filters.py", "verify.py", "changes.json", "preservation.json", "local-tests.txt", "before.png", "after.png", "objective-status.png", "case-status.png"]:
    members["workbook-audit/" + name] = (root / "tmp/objective-workbook" / name).read_bytes()
members["package.json"] = (json.dumps({"name": "yuzee-objective-harness-checkpoint", "private": True,
    "type": "module", "scripts": {"test": "node qa/objectives/harness.test.mjs"},
    "dependencies": {"ajv": "8.20.0", "dotenv": "17.4.2"}}, indent=2) + "\n").encode()
members["requirements.txt"] = b"openpyxl==3.1.5\n"
members["README-FIRST.md"] = f"""# Yuzee 316-objective validation checkpoint — 18 September 2026

This package is the isolated validation harness and its evidence. It is not the full Yuzee application or a production-ready 316-objective release.

## Current result

- 316 workbook objectives and 20 approved primitives loaded.
- 96 prepared cases across 10 objectives plus 12 separate synthetic cases executed against Gemini 3.7 Flash.
- {report['hard_pass']}/108 hard checks pass under objective-harness-0.2.3.
- 49 PASS, 46 FIXTURE_BLOCKED, 3 NEEDS_HUMAN_REVIEW, 10 FAIL.
- 61 local harness checks pass.
- Full 3,140-case run not completed. Zero objectives marked production validated.
- V2 prompts and the production app are unchanged.

Open `Yuzee-316-Objective-Harness-Results.html` for the readable results and expandable saved outputs.

## Files to use

`updated-workbook/` contains the updated final XLSX and matching CSV. These same files were saved back to the original Dropbox locations. `writeback.json` records hashes and original backup locations.

`qa/objectives/source/` contains original source snapshots, the supplied master instructions and original static validation. The static validation file is historical, not evidence that live tests passed.

`qa/objectives/reports/phase-a-smoke-2026-09-18/reports/` contains the current JSON/CSV summary, failure triage, the 1,375-case preflight review list, ambiguous contracts and additional evidence review notes. Prior v0.2.2 derived results and every raw run remain archived for comparison.

`qa/objectives/runs/` contains exact requests, raw model responses, attempts, separate evaluator calls and source/prompt hashes. Never overwrite them. Results combine two runs whose 96 prepared request schemas and system instructions were verified equivalent after an API compatibility fix.

`qa/objectives/README.md` maps the code, architecture, known limitations and integration gates. `workbook-audit/` records the controlled workbook edits and preservation verification. The workbook authoring script uses Codex's bundled artifact-tool; it is supplied as an audit aid and is not needed to execute the harness.

## Running the harness

Use Node with native fetch support (Node 22 or newer) and Python with openpyxl. Install the pinned Node dependencies and Python requirements in an isolated environment. Set GEMINI_API_KEY in your own environment; no key is included.

```text
npm install
python3 -m pip install -r requirements.txt
npm test
node qa/objectives/runner.mjs --test DISCOVER_001-T01 --judge
node qa/objectives/runner.mjs --smoke --supplemental --judge --concurrency 4
```

The compiled registry is pinned to the original source workbook for this checkpoint. Recompile a deliberately versioned workbook with `compile_workbook.py` before testing a newer prompt revision. Do not replace snapshots from a prior run.

`--all` currently stops at preflight. Resolve the recorded fixture and contract gaps before the full acceptance run. Do not remove that check to manufacture a pass rate, alter expectations, or silently replace prepared cases with synthetic ones. Materialising a fixture must preserve the original prompt and expectation and receive a separate version and review record.

## Next engineering work

1. Make missing prior facts, conflict states, completed results and source evidence concrete in versioned test fixtures.
2. Finalise typed payloads for the 20 primitives and the closed action/source-reference catalogues. Resolve GOAL_001 and GOAL_004 contract annotations.
3. Reproduce the 10 failures, including repeated summaries, incomplete results, table shape, unbound buttons and unresolved references. Review the SUP-05 unknown-versus-absent evidence error missed by the model evaluator.
4. Rerun full affected objective suites and shared-contract regressions. Run all 3,140 prepared cases only once the harness is stable.
5. Separately validate routing, cumulative sessions, tool evidence and browser/mobile behaviour. Keep production unchanged until hard, safety and semantic gates pass.

The model evaluator is a separate Gemini call, not independent human certification. No read connector, external write, profile save or navigation action is executed by this harness.
""".encode()

# Check actual locally configured secrets without printing their values.
secrets = []
for env in [root / ".env", root / ".env.local"]:
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                if any(s in key.upper() for s in ("KEY", "TOKEN", "SECRET", "PASSWORD")):
                    value = value.strip().strip('"').strip("'")
                    if len(value) > 12:
                        secrets.append(value.encode())
for name, content in members.items():
    if Path(name).name.startswith(".env") or any(secret in content for secret in secrets):
        raise SystemExit("Credential check failed; archive was not created")
manifest = {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in sorted(members.items())}
members["MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(members.items()):
        z.writestr("Yuzee-316-Validation-Checkpoint/" + name, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name, entry in manifest.items():
        assert hashlib.sha256(z.read("Yuzee-316-Validation-Checkpoint/" + name)).hexdigest() == entry["sha256"]
info = {"archive": str(archive), "files": len(members), "bytes": archive.stat().st_size,
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "crc_and_hashes_verified": True, "configured_secrets_found": False}
(output / "archive-verification.json").write_text(json.dumps(info, indent=2) + "\n")
print(json.dumps(info, indent=2))
