/**
 * Rejects malformed or mislabelled forecast artifacts before they become chat evidence.
 * Port of Yuzee Dev's ForecastArtifact.java (contract shared with workers/intelligence/forecast_contract.py).
 */
export const FORECAST_FORMAT='yuzee-forecast-run-v2';
export const FORECAST_POLICY='ivi-monthly-three-holdouts-v2';
export const TIMESFM={model:'google/timesfm-2.5-200m-pytorch',revision:'1d952420fba87f3c6dee4f240de0f1a0fbc790e3',weightsSha:'2f776efe6245e42b24bc4153ffdf61810140210e4bd3b01fb21f7aa779ab6ce8',runtime:'2.0.2'};
const METHODS=new Set(['timesfm_2.5','last_value','seasonal_naive_12']);
export const SERIES_RX=/^IVI__(ACT|NSW|NT|QLD|SA|TAS|VIC|WA|AUST)__SL[1-5]__SA__MONTHLY$/;

export interface ForecastPoint{period:string;value:number;q10?:number;q50?:number;q90?:number}
export interface ForecastResult{series_id:string;observations:number;last_period:string;metric:string;geography:string;scope:string;frequency:string;
  seasonally_adjusted:boolean;freshness:string;source_lag_months:number;method:string;holdout_mae:Record<string,number>;holdout_folds:number;holdout_points:number;
  timesfm_q10_q90_observed_coverage:number;current_advice_eligible:boolean;forecast_points:ForecastPoint[]}
export interface ForecastRun{format:string;status:string;policy:string;source_release:string;input_manifest_sha256:string;input_content_sha256:string;content_sha256:string;
  horizon:number;as_of:string;model:Record<string,unknown>;results:ForecastResult[];skipped:Array<{series_id:string;reason:string}>;eligible_series:number;skipped_series:number;current_advice_series:number}

const monthIndex=(period:string)=>{
  if(typeof period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Invalid monthly period');
  const [y,m]=period.split('-').map(Number);return y*12+m-1;
};
const periodOf=(index:number)=>`${String(Math.floor(index/12)).padStart(4,'0')}-${String(index%12+1).padStart(2,'0')}`;
const nowIndex=(now=new Date())=>now.getUTCFullYear()*12+now.getUTCMonth();
const require_=(ok:unknown)=>{if(!ok)throw Error('Invalid forecast artifact contract');};
const number=(v:unknown)=>{require_(typeof v==='number'&&Number.isFinite(v)&&v>=0);return v as number;};

/** Current advice needs a recent last observation and a horizon that still covers this month (re-evaluated at read time). */
export function currentRange(last:string,through:string,now=new Date()){
  try{const lag=nowIndex(now)-monthIndex(last);return lag>=0&&lag<=2&&monthIndex(through)>=nowIndex(now);}catch{return false;}
}
export function isCurrent(row:ForecastResult,now=new Date()){
  const points=row.forecast_points;return Array.isArray(points)&&points.length>0&&currentRange(row.last_period,points[points.length-1].period,now);
}

export function validateForecastArtifact(f:any,release:string):ForecastRun{
  require_(f?.format===FORECAST_FORMAT&&f.status==='COMPLETE'&&f.policy===FORECAST_POLICY&&f.source_release===release);
  for(const field of ['source_release','input_manifest_sha256','input_content_sha256','content_sha256'])require_(/^[a-f0-9]{64}$/.test(String(f[field])));
  const h=f.horizon;require_(Number.isInteger(h)&&h>=1&&h<=12);
  const asOf=new Date(f.as_of+'T00:00:00Z');require_(!Number.isNaN(asOf.getTime()));
  require_(Array.isArray(f.results)&&Array.isArray(f.skipped));
  if(f.results.length){
    const m=f.model||{};
    require_(m.model_id===TIMESFM.model&&m.model_revision===TIMESFM.revision&&m.model_weights_sha256===TIMESFM.weightsSha&&m.runtime_version===TIMESFM.runtime);
  }
  const seen=new Set<string>();let fresh=0;
  for(const row of f.results){
    const id=String(row.series_id);require_(SERIES_RX.test(id)&&!seen.has(id));seen.add(id);
    const region=id.split('__')[1];
    require_(row.geography===region&&row.scope===(region==='AUST'?'NATIONAL':'STATE')&&row.metric==='internet_vacancy_index'&&row.frequency==='MONTHLY');
    require_(METHODS.has(row.method)&&row.holdout_folds===3&&row.holdout_points===3*h);
    const s=row.holdout_mae;require_(s&&Object.keys(s).length===3);for(const k of METHODS)number(s[k]);
    const best=s.last_value<=s.seasonal_naive_12?'last_value':'seasonal_naive_12';
    require_(row.method===(s['timesfm_2.5']<s[best]?'timesfm_2.5':best));
    require_(number(row.timesfm_q10_q90_observed_coverage)<=1);
    const last=monthIndex(row.last_period);
    require_(Array.isArray(row.forecast_points)&&row.forecast_points.length===h);
    row.forecast_points.forEach((p:ForecastPoint,i:number)=>{
      require_(p.period===periodOf(last+i+1));const value=number(p.value);
      if(row.method==='timesfm_2.5'){const lo=number(p.q10),mid=number(p.q50),hi=number(p.q90);require_(lo<=mid&&mid<=hi&&Math.abs(mid-value)<=1e-4);}
      else require_(!('q10' in p)&&!('q50' in p)&&!('q90' in p));
    });
    const lag=asOf.getUTCFullYear()*12+asOf.getUTCMonth()-last;
    const current=lag>=0&&lag<=2&&last+h>=asOf.getUTCFullYear()*12+asOf.getUTCMonth();
    require_(row.current_advice_eligible===current&&row.freshness===(current?'CURRENT':'HISTORICAL_ONLY'));
    if(current)fresh++;
  }
  for(const row of f.skipped){require_(row?.series_id&&!seen.has(row.series_id)&&row.reason);seen.add(row.series_id);}
  require_(f.eligible_series===f.results.length&&f.skipped_series===f.skipped.length&&f.current_advice_series===fresh);
  return f as ForecastRun;
}
