"""Strict, versioned forecast artifact contract shared by writer and graph reader."""
import math
import re
from datetime import date
from common import bundle_identity, content_digest, digest, records
from collections import defaultdict
from pathlib import Path

MODEL = "google/timesfm-2.5-200m-pytorch"
REVISION = "1d952420fba87f3c6dee4f240de0f1a0fbc790e3"
WEIGHTS_SHA = "2f776efe6245e42b24bc4153ffdf61810140210e4bd3b01fb21f7aa779ab6ce8"
PACKAGE_VERSION = "2.0.2"
POLICY = "ivi-monthly-three-holdouts-v2"
SERIES = r"IVI__(ACT|NSW|NT|QLD|SA|TAS|VIC|WA|AUST)__SL[1-5]__SA__MONTHLY"
METHODS = {"timesfm_2.5", "last_value", "seasonal_naive_12"}


def month_number(period):
    if not isinstance(period, str) or not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period):
        raise ValueError("Invalid monthly period")
    y, m = map(int, period.split("-"))
    if not 1 <= y <= 9998:
        raise ValueError("Invalid monthly year")
    return y * 12 + m - 1


def future_periods(last, horizon):
    start = month_number(last)
    return [f"{(start + i) // 12:04d}-{(start + i) % 12 + 1:02d}" for i in range(1, horizon + 1)]


def forecast_identity(report):
    # Runtime timestamps and age flags change without new observations/predictions.
    # Keep the model, policy, data and actual predictions/evaluation in this identity.
    rows = [{k: v for k, v in row.items() if k not in
             {"freshness", "current_advice_eligible", "source_lag_months"}} for row in report["results"]]
    return content_digest({"input": report["input_content_sha256"], "policy": report["policy"],
                           "model": report["model"], "horizon": report["horizon"],
                           "results": sorted(rows, key=lambda r: r["series_id"]),
                           "skipped": sorted(report["skipped"], key=lambda r: r["series_id"])})


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError("Invalid forecast number")
    return value


def validate_forecast(report, bundle=None, manifest=None):
    if report.get("format") != "yuzee-forecast-run-v2" or report.get("status") != "COMPLETE" or report.get("policy") != POLICY:
        raise ValueError("Incomplete or unsupported forecast run")
    for field in ("source_release", "input_manifest_sha256", "input_content_sha256", "content_sha256"):
        if not re.fullmatch(r"[a-f0-9]{64}", report.get(field, "")):
            raise ValueError("Missing forecast provenance: " + field)
    if manifest is not None and (report["source_release"] != manifest["source_release"] or
                                report["input_content_sha256"] != bundle_identity(manifest) or
                                report["input_manifest_sha256"] != digest(Path(bundle) / "manifest.json")):
        raise ValueError("Forecast does not belong to this exact input bundle")
    horizon = report.get("horizon")
    if type(horizon) is not int or not 1 <= horizon <= 12:
        raise ValueError("Invalid forecast horizon")
    as_of = date.fromisoformat(report["as_of"])
    if not isinstance(report.get("results"), list) or not isinstance(report.get("skipped"), list):
        raise ValueError("Missing result inventory")
    if report["results"]:
        model = report.get("model", {})
        for field, value in {"model_id": MODEL, "model_revision": REVISION, "model_weights_sha256": WEIGHTS_SHA,
                             "runtime_version": PACKAGE_VERSION}.items():
            if model.get(field) != value:
                raise ValueError("Unsupported model provenance: " + field)
    seen = set()
    for row in report["results"]:
        sid = row.get("series_id", "")
        if not re.fullmatch(SERIES, sid) or sid in seen:
            raise ValueError("Invalid or duplicate forecast series")
        seen.add(sid)
        region = sid.split("__")[1]
        if row.get("geography") != region or row.get("scope") != ("NATIONAL" if region == "AUST" else "STATE") or row.get("metric") != "internet_vacancy_index" or row.get("frequency") != "MONTHLY":
            raise ValueError("Forecast geography/metric contract mismatch")
        if row.get("method") not in METHODS or row.get("holdout_folds") != 3 or row.get("holdout_points") != 3*horizon:
            raise ValueError("Missing evaluation contract")
        scores = row.get("holdout_mae", {})
        if set(scores) != METHODS:
            raise ValueError("Missing baseline evaluation")
        for score in scores.values(): number(score)
        best = min(("last_value", "seasonal_naive_12"), key=scores.get)
        selected = "timesfm_2.5" if scores["timesfm_2.5"] < scores[best] else best
        if row["method"] != selected:
            raise ValueError("Published method does not match evaluated selection")
        if not 0 <= number(row["timesfm_q10_q90_observed_coverage"]) <= 1:
            raise ValueError("Invalid interval coverage")
        points = row.get("forecast_points", [])
        if [p.get("period") for p in points] != future_periods(row["last_period"], horizon):
            raise ValueError("Incomplete or unordered forecast periods")
        for p in points:
            number(p["value"])
            if row["method"] == "timesfm_2.5":
                quantiles = [number(p[q]) for q in ("q10", "q50", "q90")]
                if quantiles != sorted(quantiles) or not math.isclose(p["value"], p["q50"], abs_tol=1e-4):
                    raise ValueError("Invalid model quantiles")
            elif any(q in p for q in ("q10", "q50", "q90")):
                raise ValueError("Baseline incorrectly labelled with model quantiles")
        lag = as_of.year*12 + as_of.month-1 - month_number(row["last_period"])
        current = 0 <= lag <= 2 and month_number(points[-1]["period"]) >= as_of.year*12+as_of.month-1
        if row.get("current_advice_eligible") is not current or row.get("freshness") != ("CURRENT" if current else "HISTORICAL_ONLY"):
            raise ValueError("Incorrect forecast freshness")
    for skipped in report["skipped"]:
        if not skipped.get("series_id") or skipped["series_id"] in seen or not skipped.get("reason"):
            raise ValueError("Invalid skipped series inventory")
        seen.add(skipped["series_id"])
    if report.get("eligible_series") != len(report["results"]) or report.get("skipped_series") != len(report["skipped"]) or report.get("current_advice_series") != sum(r["current_advice_eligible"] for r in report["results"]):
        raise ValueError("Forecast counts do not reconcile")
    if bundle is not None:
        source = defaultdict(list)
        for row in records(bundle, "timesfm_series_observation"):
            source[row["series_id"]].append(row)
        if seen != set(source):
            raise ValueError("Forecast inventory omits or invents input series")
        for row in report["results"] + report["skipped"]:
            if row.get("observations") != len(source[row["series_id"]]):
                raise ValueError("Forecast observation counts do not reconcile")
        for row in report["results"]:
            if row["last_period"] != max(r["period"] for r in source[row["series_id"]]):
                raise ValueError("Forecast uses a different history end")
    if forecast_identity(report) != report["content_sha256"]:
        raise ValueError("Forecast content identity mismatch")
    return report
