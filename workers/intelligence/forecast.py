"""TimesFM 2.5 runner with real model provenance and chronological holdouts.

Only understood monthly IVI series are forecast. No padding fabricated histories,
implicit gap filling, confidence percentages, or neural labels on baseline results.
"""
import argparse
import collections
import importlib.metadata
import math
import re
from datetime import date, datetime, timezone
from pathlib import Path
import numpy as np
from common import digest, now, read_bundle, records, write_json, bundle_identity
from memory_budget import require_available_memory

from forecast_contract import (MODEL, REVISION, WEIGHTS_SHA, PACKAGE_VERSION, POLICY,
                               month_number, future_periods, forecast_identity, validate_forecast)


def prepare(series_id, rows, horizon, as_of):
    result = {"series_id": series_id, "observations": len(rows)}
    if not re.fullmatch(r"IVI__(ACT|NSW|NT|QLD|SA|TAS|VIC|WA|AUST)__SL[1-5]__SA__MONTHLY", series_id):
        return result | {"eligible": False, "reason": "UNSUPPORTED_METRIC_OR_FREQUENCY"}
    try:
        rows = sorted(rows, key=lambda r: r["period"])
        if any(isinstance(r["value"], bool) for r in rows):
            raise ValueError("INVALID_VALUE")
        months = [month_number(r["period"]) for r in rows]
        values = [float(r["value"]) for r in rows]
        if len(set(months)) != len(months):
            raise ValueError("DUPLICATE_PERIOD")
        if any(b != a + 1 for a, b in zip(months, months[1:])):
            raise ValueError("MISSING_PERIOD")
        if any(not math.isfinite(v) or v < 0 for v in values):
            raise ValueError("INVALID_VALUE")
        if any(r["source_table"] != "stg_abs_time_series" for r in rows):
            raise ValueError("MIXED_SOURCE")
        if len(values) < 32 + 3 * horizon:
            raise ValueError("INSUFFICIENT_HISTORY")
        if months[-1] > as_of.year * 12 + as_of.month - 1:
            raise ValueError("FUTURE_OBSERVATION")
    except (ValueError, TypeError, KeyError) as exc:
        return result | {"eligible": False, "reason": str(exc)}
    # Conservative operational freshness policy; not a statistical confidence measure.
    lag = as_of.year * 12 + as_of.month - 1 - months[-1]
    region = series_id.split("__")[1]
    return result | {"eligible": True, "values": values, "last_period": rows[-1]["period"],
                     "metric": "internet_vacancy_index", "geography": region,
                     "scope": "NATIONAL" if region == "AUST" else "STATE",
                     "frequency": "MONTHLY", "seasonally_adjusted": True,
                     "freshness": "CURRENT" if lag <= 2 and horizon >= lag else "HISTORICAL_ONLY",
                     "source_lag_months": lag}


def baseline(values, horizon, method):
    values = np.asarray(values)
    if method == "last_value":
        return np.repeat(values[-1], horizon)
    if method == "seasonal_naive_12":
        return np.resize(values[-12:], horizon)
    raise ValueError("Unknown baseline")


def check_outputs(point, quantiles, count, horizon):
    if point.shape != (count, horizon) or quantiles.shape != (count, horizon, 10):
        raise ValueError("Unexpected TimesFM output shape")
    if not np.isfinite(point).all() or not np.isfinite(quantiles).all():
        raise ValueError("Non-finite model output")
    if (np.diff(quantiles[..., 1:], axis=-1) < -1e-5).any():
        raise ValueError("Crossed model quantiles")
    if not np.allclose(point, quantiles[..., 5], atol=1e-4):
        raise ValueError("Point forecast differs from median contract")


def load_model(horizon):
    require_available_memory(2 * 1024**3)
    import timesfm
    import torch
    from huggingface_hub import hf_hub_download
    if importlib.metadata.version("timesfm") != PACKAGE_VERSION:
        raise RuntimeError("Unexpected TimesFM runtime version")
    weights = hf_hub_download(MODEL, "model.safetensors", revision=REVISION, local_files_only=True)
    if digest(weights) != WEIGHTS_SHA:
        raise RuntimeError("Checkpoint weights fingerprint mismatch")
    torch.set_num_threads(2)
    torch.set_float32_matmul_precision("high")
    model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
        MODEL, revision=REVISION, local_files_only=True, torch_compile=False)
    model.compile(timesfm.ForecastConfig(
        max_context=512, max_horizon=max(128, horizon), per_core_batch_size=1,
        normalize_inputs=True, use_continuous_quantile_head=True,
        force_flip_invariance=True, infer_is_positive=True, fix_quantile_crossing=True))
    provenance = {"model_id": MODEL, "model_revision": REVISION, "model_weights_sha256": digest(weights),
                  "runtime_version": PACKAGE_VERSION, "torch_version": torch.__version__,
                  "weights_license": "Apache-2.0", "max_context": 512, "torch_compile": False}
    return model, provenance


def run(bundle, output, horizon=6, as_of=None):
    if not 1 <= horizon <= 12:
        raise ValueError("Monthly horizon must be 1..12")
    as_of = as_of or datetime.now(timezone.utc).date()
    manifest = read_bundle(bundle)
    out = Path(output)
    out.mkdir(parents=True, exist_ok=False)
    started = now()
    grouped = collections.defaultdict(list)
    for row in records(bundle, "timesfm_series_observation"):
        grouped[row["series_id"]].append(row)
    prepared = [prepare(k, v, horizon, as_of) for k, v in sorted(grouped.items())]
    eligible = [s for s in prepared if s["eligible"]]
    skipped = [{k: v for k, v in s.items() if k != "values"} for s in prepared if not s["eligible"]]
    report = {"format": "yuzee-forecast-run-v2", "status": "RUNNING", "started_at": started,
              "source_release": manifest["source_release"], "input_manifest_sha256": digest(Path(bundle)/"manifest.json"),
              "input_content_sha256": bundle_identity(manifest), "policy": POLICY, "horizon": horizon, "as_of": str(as_of), "skipped": skipped, "results": [],
              "inference_executed_this_run": bool(eligible)}
    write_json(out / "status.json", report | {"results": []})
    try:
        model, provenance = load_model(horizon) if eligible else (None, {})
        report["model"] = provenance
        for series in eligible:
            values = np.asarray(series.pop("values"), dtype=np.float32)
            scores = {k: [] for k in ("timesfm_2.5", "last_value", "seasonal_naive_12")}
            coverage = []
            for fold in (3, 2, 1):
                cutoff = len(values) - horizon * fold
                train, actual = values[:cutoff], values[cutoff:cutoff+horizon]
                p, q = model.forecast(horizon=horizon, inputs=[train])
                check_outputs(p, q, 1, horizon)
                scores["timesfm_2.5"].append(float(np.mean(np.abs(p[0] - actual))))
                coverage.extend(((actual >= q[0, :, 1]) & (actual <= q[0, :, 9])).tolist())
                for method in ("last_value", "seasonal_naive_12"):
                    scores[method].append(float(np.mean(np.abs(baseline(train, horizon, method) - actual))))
            mae = {k: float(np.mean(v)) for k, v in scores.items()}
            best_baseline = min(("last_value", "seasonal_naive_12"), key=mae.get)
            # Strict improvement; an exact tie favours the simpler baseline.
            selected = "timesfm_2.5" if mae["timesfm_2.5"] < mae[best_baseline] else best_baseline
            point, quantiles = model.forecast(horizon=horizon, inputs=[values])
            check_outputs(point, quantiles, 1, horizon)
            points = point[0] if selected == "timesfm_2.5" else baseline(values, horizon, selected)
            result = series | {"method": selected, "holdout_mae": mae, "holdout_folds": 3,
                               "holdout_points": 3*horizon, "timesfm_q10_q90_observed_coverage": float(np.mean(coverage)),
                               "current_advice_eligible": series["freshness"] == "CURRENT",
                               "forecast_points": []}
            for i, period in enumerate(future_periods(series["last_period"], horizon)):
                point_result = {"period": period, "value": float(points[i])}
                if selected == "timesfm_2.5":
                    point_result |= {"q10": float(quantiles[0,i,1]), "q50": float(quantiles[0,i,5]), "q90": float(quantiles[0,i,9])}
                result["forecast_points"].append(point_result)
            report["results"].append(result)
            print(f"{series['series_id']}: {selected}, {series['freshness']}", flush=True)
        report |= {"status": "COMPLETE", "completed_at": now(), "eligible_series": len(eligible),
                   "skipped_series": len(skipped), "current_advice_series": sum(r["current_advice_eligible"] for r in report["results"])}
        report["content_sha256"] = forecast_identity(report)
        validate_forecast(report, bundle, manifest)
        write_json(out / "forecasts.json", report)
        write_json(out / "status.json", {k: v for k, v in report.items() if k not in ("results", "skipped")})
        return report
    except Exception as exc:
        write_json(out / "status.json", {"status": "FAILED", "started_at": started, "failed_at": now(), "error_type": type(exc).__name__})
        raise


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--bundle", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--horizon", type=int, default=6)
    a = p.parse_args()
    run(a.bundle, a.output, a.horizon)
