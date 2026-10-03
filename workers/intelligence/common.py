"""Read-only RDS landing access. No application credentials or data writes."""
import hashlib
import json
import math
import os
import re
import ssl
import struct
from datetime import datetime, timezone
from pathlib import Path
from schema import CONTRACTS


def now():
    return datetime.now(timezone.utc).isoformat()


def identifier(value):
    if not re.fullmatch(r"[A-Za-z0-9_]{1,64}", value):
        raise ValueError("Invalid database identifier")
    return "`" + value + "`"


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def content_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                    ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def bundle_identity(manifest):
    # Export timestamps are provenance, not a change to the underlying data.
    return content_digest({k: manifest[k] for k in ("format", "source_release", "tables")})


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")
    temporary.replace(path)


def decode(kind, value):
    if kind == "n" and value is None:
        return None
    if value is None:
        raise ValueError("Invalid landing null")
    raw = bytes(value)
    if kind == "t":
        return raw.decode("utf-8")
    if kind == "i":
        return int(raw.decode("ascii"))
    if kind == "r":
        return struct.unpack(">d", raw)[0]
    raise ValueError("Unsupported landing type in intelligence projection")


class Landing:
    def __init__(self, schema):
        import pymysql
        self.schema = identifier(schema)
        self.connection = pymysql.connect(
            host=os.environ["WAREHOUSE_MYSQL_HOST"],
            port=int(os.getenv("WAREHOUSE_MYSQL_PORT", "3306")),
            user=os.environ["WAREHOUSE_MYSQL_USER"],
            password=os.environ["WAREHOUSE_MYSQL_PASSWORD"],
            ssl=ssl.create_default_context(cafile=os.environ["WAREHOUSE_MYSQL_CA"]),
            charset="utf8mb4", autocommit=True, connect_timeout=10,
            read_timeout=60, write_timeout=30,
        )
        with self.connection.cursor() as c:
            c.execute("SET SESSION TRANSACTION READ ONLY")
        self.release = self.read_release()

    def read_release(self):
        with self.connection.cursor() as c:
            c.execute(f"SELECT manifest_sha,status FROM {self.schema}._wh_release WHERE slot=1")
            row = c.fetchone()
        if not row or row[1] != "KNOWLEDGE_LANDING_VERIFIED":
            raise ValueError("Warehouse release is not verified")
        return row[0]

    def rows(self, table, fields):
        target = identifier("src_" + table)
        with self.connection.cursor() as c:
            c.execute(f"SELECT row_count FROM {self.schema}._wh_tables WHERE source_table=%s", (table,))
            expected = int(c.fetchone()[0])
            c.execute(f"SELECT * FROM {self.schema}.{target} LIMIT 0")
            names = [x[0] for x in c.description if not x[0].startswith("__wh_")]
            positions = [names.index(f) for f in fields]
            selected = ",".join(identifier(f) for f in fields)
            last, total = 0, 0
            while True:
                c.execute(f"SELECT __wh_ordinal,__wh_types,{selected} FROM {self.schema}.{target} "
                          "WHERE __wh_ordinal>%s ORDER BY __wh_ordinal LIMIT 2000", (last,))
                batch = c.fetchall()
                if not batch:
                    break
                for row in batch:
                    types = bytes(row[1]).decode("ascii")
                    record = {f: decode(types[pos], value) for f, pos, value in zip(fields, positions, row[2:])}
                    record["source_ordinal"] = row[0]
                    yield record
                last = batch[-1][0]
                total += len(batch)
            if total != expected:
                raise ValueError(f"Incomplete table export: {table} ({total}/{expected})")

    def close(self):
        self.connection.close()


def read_bundle(path):
    path = Path(path)
    manifest = json.loads((path / "manifest.json").read_text())
    if manifest.get("status") != "COMPLETE" or manifest.get("format") not in CONTRACTS:
        raise ValueError("Incomplete or unsupported input bundle")
    if "ivi_refresh" in manifest:
        lineage = manifest["ivi_refresh"]
        if (lineage.get("format") != "yuzee-ivi-overlay-v1"
                or content_digest(lineage) != manifest.get("source_release")):
            raise ValueError("Invalid IVI composite source lineage")
    tables = CONTRACTS[manifest["format"]]
    if not re.fullmatch(r"[a-f0-9]{64}", manifest.get("source_release", "")):
        raise ValueError("Invalid source release")
    if set(manifest.get("tables", {})) != set(tables):
        raise ValueError("Missing or unexpected input tables")
    for name, table in manifest["tables"].items():
        if table.get("fields") != tables[name] or type(table.get("rows")) is not int or table["rows"] < 0:
            raise ValueError("Invalid table contract: " + name)
        if digest(path / (name + ".jsonl")) != table["sha256"]:
            raise ValueError("Input fingerprint mismatch: " + name)
        count, previous = 0, 0
        for row in records(path, name):
            if set(row) != set(tables[name]) | {"source_ordinal"}:
                raise ValueError("Invalid row fields: " + name)
            ordinal = row["source_ordinal"]
            if type(ordinal) is not int or ordinal <= previous:
                raise ValueError("Duplicate or unordered source ordinal: " + name)
            if any(isinstance(v, (dict, list, bool)) or (isinstance(v, float) and not math.isfinite(v)) for v in row.values()):
                raise ValueError("Non-scalar source value: " + name)
            previous, count = ordinal, count + 1
        if count != table["rows"]:
            raise ValueError("Input row count mismatch: " + name)
    return manifest


def records(path, name):
    def reject_constant(value):
        raise ValueError("Non-finite JSON: " + value)
    with (Path(path) / (name + ".jsonl")).open() as f:
        for line in f:
            yield json.loads(line, parse_constant=reject_constant)
