"""Read-only original SQLite snapshot for parity tests. Not a verified RDS release."""
import argparse
import json
import os
import sqlite3
from pathlib import Path
from urllib.parse import quote
from common import digest,content_digest,write_json,now
from schema import TABLES_V3


def export(source, output):
    os.umask(0o077)
    root=Path(output);root.mkdir(parents=True,exist_ok=False)
    connection=sqlite3.connect('file:'+quote(str(Path(source).resolve()),safe='/')+'?mode=ro',uri=True)
    tables={}
    try:
        connection.execute('BEGIN')
        for table,fields in TABLES_V3.items():
            path=root/(table+'.jsonl');count=0
            with path.open('x') as out:
                query='SELECT '+','.join('"'+f+'"' for f in fields)+' FROM "'+table+'" ORDER BY rowid'
                for count,row in enumerate(connection.execute(query),1):
                    out.write(json.dumps(dict(zip(fields,row))|{'source_ordinal':count},allow_nan=False)+'\n')
            tables[table]=dict(fields=fields,rows=count,sha256=digest(path))
        manifest=dict(format='yuzee-intelligence-input-v3',status='COMPLETE',tables=tables,
            source_release=content_digest(tables),source_schema='LOCAL_SQLITE_ACCEPTANCE_ONLY',
            origin='Original laptop SQLite read transaction; not an RDS publication',created_at=now())
        write_json(root/'manifest.json',manifest)
    finally:
        connection.rollback();connection.close()
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
    a=p.parse_args();m=export(a.source,a.output);print(json.dumps({'origin':m['origin'],'tables':len(m['tables']),'rows':sum(t['rows'] for t in m['tables'].values())}))
