"""Read-only export from the Yuzee SQLite warehouse into the versioned intelligence input bundle.

Adapted from Yuzee Dev's export_local_acceptance.py: in this project the SQLite warehouse is the
source of record (Yuzee Dev reads a verified RDS landing instead). Same contract and fingerprints,
so forecast.py, graph.py and the readers apply unchanged.
"""
import argparse
import json
import os
import sqlite3
from pathlib import Path
from urllib.parse import quote
from common import digest, content_digest, write_json, now
from schema import CONTRACTS

FORMAT = 'yuzee-intelligence-input-v3'


def export(source, output, fmt=FORMAT):
    os.umask(0o077)
    root = Path(output)
    root.mkdir(parents=True, exist_ok=False)
    # Read-only URI plus one read transaction: a consistent snapshot, never a write. On a read-only
    # mount SQLite cannot create its lock/shm files; the snapshot is then opened as immutable.
    flags = '?mode=ro' + ('' if os.access(Path(source).parent, os.W_OK) else '&immutable=1')
    connection = sqlite3.connect('file:' + quote(str(Path(source).resolve()), safe='/:') + flags, uri=True)
    tables = {}
    try:
        connection.execute('BEGIN')
        for table, fields in CONTRACTS[fmt].items():
            path = root / (table + '.jsonl')
            count = 0
            with path.open('x') as out:
                query = 'SELECT ' + ','.join('"' + f + '"' for f in fields) + ' FROM "' + table + '" ORDER BY rowid'
                for count, row in enumerate(connection.execute(query), 1):
                    out.write(json.dumps(dict(zip(fields, row)) | {'source_ordinal': count}, allow_nan=False) + '\n')
            tables[table] = dict(fields=fields, rows=count, sha256=digest(path))
            print(f'Exported {table}: {count}', flush=True)
        manifest = dict(format=fmt, status='COMPLETE', tables=tables, source_release=content_digest(tables),
                        source_schema='YUZEE_SQLITE_WAREHOUSE',
                        origin='Read-only SQLite warehouse snapshot (token lab source of record)', created_at=now())
        write_json(root / 'manifest.json', manifest)
    finally:
        connection.rollback()
        connection.close()
    return manifest


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--format', choices=CONTRACTS, default=FORMAT)
    a = p.parse_args()
    m = export(a.source, a.output, a.format)
    print(json.dumps({'tables': len(m['tables']), 'rows': sum(t['rows'] for t in m['tables'].values()), 'source_release': m['source_release']}))
