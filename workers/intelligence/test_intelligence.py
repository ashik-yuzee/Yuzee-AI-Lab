import json
import struct
import tempfile
import unittest
from datetime import date
from pathlib import Path
import numpy as np
from common import decode, digest, read_bundle, write_json, bundle_identity
from schema import TABLES
from forecast_contract import validate_forecast, forecast_identity, MODEL, REVISION, WEIGHTS_SHA, POLICY
from forecast import prepare, future_periods, baseline, check_outputs
from graph import key, edge_endpoints


class IntelligenceTests(unittest.TestCase):
    def rows(self):
        periods=["2021-01"]+future_periods("2021-01",59)
        return [dict(period=p,value=float(i),source_table="stg_abs_time_series") for i,p in enumerate(periods)]

    def prepare(self,rows=None,series="IVI__VIC__SL1__SA__MONTHLY",as_of=date(2026,9,28)):
        return prepare(series,self.rows() if rows is None else rows,6,as_of)

    def test_landing_retains_leading_zero_ids(self):
        self.assertEqual(decode("t",b"0275"),"0275")
        self.assertEqual(decode("i",b"275"),275)
        self.assertEqual(decode("r",struct.pack(">d",1.5)),1.5)
        self.assertIsNone(decode("n",None))

    def test_invalid_landing_null(self):
        with self.assertRaises(ValueError):decode("t",None)

    def test_rejects_gaps(self):
        rows=self.rows();del rows[4]
        self.assertEqual(self.prepare(rows)["reason"],"MISSING_PERIOD")

    def test_rejects_duplicate_month(self):
        rows=self.rows();rows.append(rows[1])
        self.assertEqual(self.prepare(rows)["reason"],"DUPLICATE_PERIOD")

    def test_rejects_short_history_without_padding(self):
        self.assertEqual(self.prepare(self.rows()[:1])["reason"],"INSUFFICIENT_HISTORY")

    def test_rejects_unknown_daily_series(self):
        self.assertFalse(self.prepare(series="JOBS__VIC__DAILY")["eligible"])

    def test_rejects_nonfinite_and_negative(self):
        for value in (float("nan"),float("inf"),-1):
            rows=self.rows();rows[2]["value"]=value
            self.assertEqual(self.prepare(rows)["reason"],"INVALID_VALUE")

    def test_rejects_mixed_source(self):
        rows=self.rows();rows[2]["source_table"]="outside_jobs"
        self.assertEqual(self.prepare(rows)["reason"],"MIXED_SOURCE")

    def test_future_observation_not_accepted(self):
        self.assertEqual(self.prepare(as_of=date(2024,1,1))["reason"],"FUTURE_OBSERVATION")

    def test_stale_history_explicit(self):
        self.assertEqual(self.prepare()["freshness"],"HISTORICAL_ONLY")
        self.assertEqual(self.prepare(as_of=date(2026,1,1))["freshness"],"CURRENT")
        self.assertEqual(self.prepare()["scope"],"STATE")

    def test_month_rollover(self):
        self.assertEqual(future_periods("2025-11",3),["2025-12","2026-01","2026-02"])

    def test_baseline_publishes_same_algorithm_as_evaluation(self):
        self.assertEqual(baseline([1,2,100],2,"last_value").tolist(),[100,100])
        self.assertEqual(baseline(np.arange(24),14,"seasonal_naive_12").tolist(),list(range(12,24))+[12,13])

    def test_quantile_indices_and_crossing(self):
        q=np.arange(10,dtype=float).reshape(1,1,10)
        check_outputs(np.array([[5.]]),q,1,1)
        with self.assertRaises(ValueError):check_outputs(np.array([[4.]]),q,1,1)
        q[0,0,2]=20
        with self.assertRaises(ValueError):check_outputs(np.array([[5.]]),q,1,1)

    def make_bundle(self, root):
        tables={}
        for name, fields in TABLES.items():
            file=root/(name+".jsonl");file.write_text("")
            tables[name]={"sha256":digest(file),"fields":fields,"rows":0}
        manifest={"status":"COMPLETE","format":"yuzee-intelligence-input-v1","source_release":"a"*64,"tables":tables}
        write_json(root/"manifest.json",manifest)
        return manifest

    def test_corrupt_input_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);self.make_bundle(root);read_bundle(root)
            (root/"live_courses.jsonl").write_text("changed")
            with self.assertRaises(ValueError):read_bundle(root)

    def test_missing_table_rejected_even_with_valid_remaining_hashes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);m=self.make_bundle(root);del m["tables"]["course_skill_edge"]
            write_json(root/"manifest.json",m)
            with self.assertRaises(ValueError):read_bundle(root)

    def test_count_and_duplicate_identity_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);m=self.make_bundle(root)
            row={f:None for f in TABLES["live_courses"]}|{"source_ordinal":1}
            file=root/"live_courses.jsonl";file.write_text(json.dumps(row)+"\n"+json.dumps(row)+"\n")
            m["tables"]["live_courses"].update(rows=2,sha256=digest(file))
            write_json(root/"manifest.json",m)
            with self.assertRaisesRegex(ValueError,"ordinal"):read_bundle(root)
            file.write_text("");m["tables"]["live_courses"]["sha256"]=digest(file)
            write_json(root/"manifest.json",m)
            with self.assertRaisesRegex(ValueError,"count"):read_bundle(root)

    def test_export_timestamp_does_not_change_content_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            m=self.make_bundle(Path(tmp))
            self.assertEqual(bundle_identity(m),bundle_identity(m|{"created_at":"tomorrow"}))

    def test_short_horizon_already_in_past_is_historical(self):
        self.assertEqual(prepare("IVI__VIC__SL1__SA__MONTHLY",self.rows(),1,date(2026,2,1))["freshness"],"HISTORICAL_ONLY")

    def test_bad_period_and_boolean_are_quarantined(self):
        for field,value in (("period",None),("value",True)):
            rows=self.rows();rows[0][field]=value
            self.assertFalse(self.prepare(rows)["eligible"])

    def forecast_fixture(self):
        return json.loads((Path(__file__).parent/"fixtures/forecast-valid.json").read_text())

    def test_forecast_fixture_and_mismatched_exact_bundle(self):
        f=self.forecast_fixture();validate_forecast(f)
        with tempfile.TemporaryDirectory() as tmp:
            m=self.make_bundle(Path(tmp))
            with self.assertRaisesRegex(ValueError,"exact input"):validate_forecast(f,Path(tmp),m)

    def test_forecast_corruption_and_false_provenance_rejected(self):
        mutations=[lambda f:f["results"].append(f["results"][0]),
            lambda f:f["model"].update(model_id="google/timesfm-1.0"),
            lambda f:f["results"][0]["forecast_points"][0].update(value=float("nan")),
            lambda f:f["results"][0]["forecast_points"].pop(),
            lambda f:f["results"][0]["forecast_points"][0].update(q90=9),
            lambda f:f["results"][0].update(current_advice_eligible=False)]
        for mutation in mutations:
            f=self.forecast_fixture();mutation(f)
            with self.assertRaises((ValueError,KeyError)):validate_forecast(f)

    def test_run_timestamp_and_read_time_age_do_not_duplicate_graph(self):
        f=self.forecast_fixture();identity=forecast_identity(f)
        f.update(started_at="tomorrow",completed_at="later",as_of="2027-01-01")
        f["results"][0].update(freshness="HISTORICAL_ONLY",current_advice_eligible=False,source_lag_months=13)
        self.assertEqual(identity,forecast_identity(f))

    def test_identity_namespaces_do_not_collide(self):
        self.assertNotEqual(key("g","CourseOffering","123"),key("g","Qualification","123"))
        self.assertNotEqual(key("a:b","c"),key("a","b:c"))

    def test_missing_job_target_quarantined(self):
        with self.assertRaises(ValueError):edge_endpoints("course_job_match_edge",{"national_code":"ABC","anzsco_code":None,"job_id":None})

    def test_employer_names_are_mentions_not_canonical_company_ids(self):
        base=dict(employer_name="Same name",source_name="source",state_code="VIC",anzsco_code="1234")
        _,a,_=edge_endpoints("employer_job_edge",base)
        _,b,_=edge_endpoints("employer_job_edge",base|{"state_code":"NSW"})
        self.assertEqual(a["entityType"],"EmployerMention")
        self.assertNotEqual(a["sourceId"],b["sourceId"])


if __name__=="__main__":unittest.main()
