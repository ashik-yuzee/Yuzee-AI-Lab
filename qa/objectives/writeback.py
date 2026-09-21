"""Guarded workbook/CSV writeback. Original source snapshots remain immutable."""
import argparse
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-directory", required=True)
    parser.add_argument("--updated-directory", required=True)
    parser.add_argument("--source-directory", required=True)
    parser.add_argument("--backup-name", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--previous-manifest", help="Previously verified writeback, when revising our own QA update")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    target, updated, source = map(Path, (args.target_directory, args.updated_directory, args.source_directory))
    if Path(args.backup_name).name != args.backup_name:
        raise SystemExit("Backup name must be one directory name")
    backup = target / "backups" / args.backup_name
    names = ["Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL.xlsx",
             "Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL_ObjectivePrompts.csv"]
    previous = {x["name"]: x for x in json.loads(Path(args.previous_manifest).read_text())["files"]} if args.previous_manifest else {}
    entries = []
    for name in names:
        original_hash, final_hash, current_hash = digest(source / name), digest(updated / name), digest(target / name)
        previous_hash = previous.get(name, {}).get("after_sha256")
        if previous_hash and previous[name].get("destination") != str(target / name):
            raise SystemExit("Previous manifest belongs to a different destination")
        if current_hash not in (original_hash, final_hash, previous_hash):
            raise SystemExit(f"Source changed since inspection; refusing to overwrite: {name}")
        saved = backup / name
        if saved.exists() and digest(saved) != original_hash:
            raise SystemExit(f"Backup does not match the original source: {saved}")
        entries.append(dict(name=name, before_sha256=original_hash, previous_sha256=current_hash, after_sha256=final_hash,
                            destination=str(target / name), backup=str(saved)))
    if args.apply:
        backup.mkdir(parents=True, exist_ok=True)
        for entry in entries:
            saved = Path(entry["backup"])
            if not saved.exists():
                with saved.open("xb") as handle:
                    handle.write((source / entry["name"]).read_bytes())
            if digest(saved) != entry["before_sha256"]:
                raise SystemExit("Backup verification failed")
        for entry in entries:
            destination = Path(entry["destination"])
            if digest(destination) == entry["after_sha256"]:
                continue
            fd, temporary = tempfile.mkstemp(prefix=".yuzee-qa-", suffix=destination.suffix, dir=target)
            os.close(fd)
            try:
                shutil.copy2(updated / entry["name"], temporary)
                if digest(Path(temporary)) != entry["after_sha256"]:
                    raise RuntimeError("Staged file verification failed")
                # Recheck immediately before replacement to protect a concurrent edit.
                if digest(destination) != entry["previous_sha256"]:
                    raise RuntimeError("Destination changed during writeback")
                os.replace(temporary, destination)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)
        for entry in entries:
            assert digest(Path(entry["destination"])) == entry["after_sha256"]
    result = dict(applied=args.apply, files=entries,
                  note="QA results only. Static validation JSON and runtime prompts unchanged.")
    Path(args.manifest).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
