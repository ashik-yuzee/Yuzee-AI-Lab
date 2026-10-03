"""Reuse evaluated predictions only when the exact numeric input is unchanged."""
import copy
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from common import read_bundle, records, bundle_identity, digest, write_json, now
from forecast_contract import validate_forecast, forecast_identity
from forecast import prepare


def reuse(previous_bundle, previous_forecast, bundle, output, horizon=6, as_of=None):
    old = read_bundle(previous_bundle)
    new = read_bundle(bundle)
    report = json.loads(Path(previous_forecast).read_text())
    validate_forecast(report, previous_bundle, old)
    table = 'timesfm_series_observation'
    if old['tables'][table] != new['tables'][table] or report['horizon'] != horizon:
        return None
    as_of = as_of or datetime.now(timezone.utc).date()
    grouped = defaultdict(list)
    for row in records(bundle, table): grouped[row['series_id']].append(row)
    prepared = {sid: prepare(sid, rows, horizon, as_of) for sid, rows in grouped.items()}
    # Calendar changes can make formerly future observations eligible. Re-evaluate then.
    if {sid for sid, p in prepared.items() if p['eligible']} != {r['series_id'] for r in report['results']}:
        return None
    if {sid: p['reason'] for sid,p in prepared.items() if not p['eligible']} != {r['series_id']: r['reason'] for r in report['skipped']}:
        return None
    result = copy.deepcopy(report)
    result.update(source_release=new['source_release'], input_content_sha256=bundle_identity(new),
                  input_manifest_sha256=digest(Path(bundle)/'manifest.json'), as_of=str(as_of),
                  reused_at=now(), reused_from_artifact_sha256=digest(previous_forecast),
                  inference_executed_this_run=False)
    for row in result['results']:
        current = prepared[row['series_id']]
        row.update(freshness=current['freshness'],source_lag_months=current['source_lag_months'],
                   current_advice_eligible=current['freshness']=='CURRENT')
    result['current_advice_series'] = sum(r['current_advice_eligible'] for r in result['results'])
    result['content_sha256'] = forecast_identity(result)
    validate_forecast(result, bundle, new)
    out = Path(output); out.mkdir(parents=True,exist_ok=False)
    write_json(out/'forecasts.json',result)
    write_json(out/'status.json',{k:v for k,v in result.items() if k not in ('results','skipped')})
    return result
