import json
import shutil
import tempfile
import unittest
from pathlib import Path
from datetime import date
from common import digest,write_json,bundle_identity,read_bundle
from forecast_contract import forecast_identity,future_periods,validate_forecast
from forecast_cache import reuse
from schema import TABLES

class ForecastCacheTests(unittest.TestCase):
    def setup_bundle(self, root):
        root.mkdir()
        tables={}
        for table, fields in TABLES.items():
            path=root/(table+'.jsonl');path.write_text('')
            tables[table]=dict(fields=fields,rows=0,sha256=digest(path))
        rows=[dict(series_id='IVI__VIC__SL1__SA__MONTHLY',period=p,value=i,source_table='stg_abs_time_series',quality_score=1,source_ordinal=i+1)
              for i,p in enumerate(['2021-01']+future_periods('2021-01',59))]
        path=root/'timesfm_series_observation.jsonl';path.write_text(''.join(json.dumps(r)+'\n' for r in rows))
        tables['timesfm_series_observation'].update(rows=len(rows),sha256=digest(path))
        m=dict(status='COMPLETE',format='yuzee-intelligence-input-v1',source_release='a'*64,tables=tables)
        write_json(root/'manifest.json',m)
        f=json.loads((Path(__file__).parent/'fixtures/forecast-valid.json').read_text())
        f['input_manifest_sha256']=digest(root/'manifest.json');f['input_content_sha256']=bundle_identity(m)
        f['results'][0]['observations']=60;f['content_sha256']=forecast_identity(f)
        validate_forecast(f,root,m)
        write_json(root/'forecasts.json',f)
        return m

    def test_graph_change_reuses_predictions_but_rebinds_exact_bundle_and_ages(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);old=base/'old';m=self.setup_bundle(old);new=base/'new';shutil.copytree(old,new)
            m['source_release']='b'*64;write_json(new/'manifest.json',m)
            result=reuse(old,old/'forecasts.json',new,base/'out',as_of=date(2026,9,28))
            self.assertFalse(result['inference_executed_this_run'])
            self.assertFalse(result['results'][0]['current_advice_eligible'])
            self.assertEqual(result['source_release'],'b'*64)
            validate_forecast(result,new,read_bundle(new))
            self.assertEqual(result['results'][0]['forecast_points'],json.loads((old/'forecasts.json').read_text())['results'][0]['forecast_points'])

    def test_new_numeric_data_and_horizon_require_new_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);old=base/'old';m=self.setup_bundle(old);new=base/'new';shutil.copytree(old,new)
            self.assertIsNone(reuse(old,old/'forecasts.json',new,base/'out',horizon=3))
            p=new/'timesfm_series_observation.jsonl';p.write_text(p.read_text().replace('"value": 0,','"value": 20,'))
            m['tables']['timesfm_series_observation']['sha256']=digest(p);write_json(new/'manifest.json',m)
            self.assertIsNone(reuse(old,old/'forecasts.json',new,base/'out'))
            self.assertFalse((base/'out').exists())

    def test_corrupt_previous_predictions_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);old=base/'old';self.setup_bundle(old)
            f=json.loads((old/'forecasts.json').read_text());f['results'][0]['forecast_points'][0]['value']=999
            write_json(old/'forecasts.json',f)
            with self.assertRaises(ValueError):reuse(old,old/'forecasts.json',old,base/'out')

if __name__=='__main__':unittest.main()
