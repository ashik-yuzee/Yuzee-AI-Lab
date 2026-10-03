"""One local batch run: SQLite warehouse -> (official IVI refresh) -> evaluated forecasts -> Neo4j graph.

Mirrors Yuzee Dev's pipeline.py with the SQLite exporter. On success it atomically updates
<runs-root>/current.json, which the Node reader uses to pin the exact forecast artifact
(path + SHA-256) and source release. A failed stage never changes current.json.
"""
import argparse
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from common import digest, now, write_json
from export_sqlite import export, FORMAT
from forecast import run
from forecast_cache import reuse
from graph import project


def refresh_ivi(base, run_root, output):
    """Fetch the latest official JSA IVI workbook and overlay it. Returns lineage or raises."""
    import ivi_refresh
    url = ivi_refresh.discover(ivi_refresh.fetch(ivi_refresh.PAGE).decode('utf-8'))
    body = ivi_refresh.fetch(url)
    with tempfile.TemporaryDirectory() as temp:
        file = Path(temp) / 'source.xlsx'
        file.write_bytes(body)
        release = ivi_refresh.release(file, url, run_root / 'ivi-release')
    ivi_refresh.overlay(base, run_root / 'ivi-release', output)
    return {'status': 'APPLIED', 'reference_period': release['reference_period'], 'release_id': release['release_id'], 'source_url': url}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', default=os.getenv('WAREHOUSE_SQLITE', '/warehouse/training_gov.db'))
    p.add_argument('--runs-root', default=os.getenv('INTELLIGENCE_RUNS', '/runs'))
    p.add_argument('--run-id', default=datetime.now(timezone.utc).strftime('run-%Y%m%dT%H%M%SZ'))
    p.add_argument('--horizon', type=int, default=6)
    p.add_argument('--ivi', choices=['latest', 'none'], default='latest',
                   help='latest: fetch and validate the newest official JSA IVI workbook (keeps the base data if refused)')
    p.add_argument('--no-reuse', action='store_true', help='Always rerun TimesFM even if the numeric input is unchanged')
    p.add_argument('--stage-only', action='store_true', help='Reconcile the graph candidate without moving the serving pointer')
    a = p.parse_args()
    os.umask(0o077)
    runs = Path(a.runs_root)
    root = runs / a.run_id
    root.mkdir(parents=True, exist_ok=False)
    stage, ivi = 'export', {'status': 'NOT_REQUESTED'}
    try:
        export(a.source, root / 'base-input', FORMAT)
        input_dir = root / 'base-input'
        if a.ivi == 'latest':
            stage = 'ivi_refresh'
            try:
                ivi = refresh_ivi(root / 'base-input', root, root / 'input')
                input_dir = root / 'input'
            except Exception as exc:  # The unchanged warehouse history remains a valid, older input.
                ivi = {'status': 'REFUSED_OR_FAILED', 'error_type': type(exc).__name__, 'detail': str(exc)[:200]}
                print('IVI refresh not applied: ' + ivi['detail'], flush=True)
        stage = 'forecast'
        reused = None
        current = runs / 'current.json'
        if current.exists() and not a.no_reuse:
            previous = json.loads(current.read_text())
            prior = runs / previous['run']
            try:
                reused = reuse(prior / previous['input'], runs / previous['forecast']['file'], input_dir, root / 'forecast', a.horizon)
            except Exception as exc:
                print(f'Previous forecast not reusable ({type(exc).__name__}); evaluating again', flush=True)
        if reused is None:
            run(input_dir, root / 'forecast', a.horizon)
        stage = 'graph'
        forecast_file = root / 'forecast' / 'forecasts.json'
        report = project(input_dir, root / 'graph.json', forecast_file, stage_only=a.stage_only)
        forecast = json.loads(forecast_file.read_text())
        summary = {'status': 'STAGED' if a.stage_only else 'COMPLETE', 'completed_at': now(), 'ivi_refresh': ivi,
                   'forecast_reused': reused is not None, 'graph_generation': report['generation'], 'graph_facts': report.get('facts')}
        write_json(root / 'pipeline.json', summary)
        if not a.stage_only:
            write_json(current, {'run': a.run_id, 'input': input_dir.name, 'source_release': forecast['source_release'],
                                 'forecast': {'file': f'{a.run_id}/forecast/forecasts.json', 'sha256': digest(forecast_file),
                                              'content_sha256': forecast['content_sha256'], 'as_of': forecast['as_of'],
                                              'eligible_series': forecast['eligible_series'], 'current_advice_series': forecast['current_advice_series']},
                                 'graph': {'generation': report['generation'], 'version': report['version'], 'facts': report.get('facts')},
                                 'ivi_refresh': ivi, 'published_at': summary['completed_at']})
        print(json.dumps(summary), flush=True)
    except Exception as exc:
        write_json(root / 'pipeline.json', {'status': 'FAILED', 'stage': stage, 'error_type': type(exc).__name__, 'failed_at': now()})
        raise


if __name__ == '__main__':
    main()
