/** Warehouse intelligence: forecast artifact contract, freshness, chat enrichment bounds and (when the
 * local pipeline has published) live Neo4j graph + forecast reads. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateForecastArtifact,currentRange,isCurrent} from '../src/intelligence/forecastArtifact';
import {intelligenceService,IntelligenceService} from '../src/intelligence/service';
import {intelligenceForTurn,INTELLIGENCE_INSTRUCTION} from '../src/intelligence/enrich';
import {packEvidence} from '../src/rag/evidence';

// 1. The shared fixture (from Yuzee Dev's Java tests) validates; tampering is rejected.
const fixture=JSON.parse(fs.readFileSync('workers/intelligence/fixtures/forecast-valid.json','utf8'));
assert.equal(validateForecastArtifact(structuredClone(fixture),fixture.source_release).results.length,1);
const reject=(mutate:(f:any)=>void,why:string)=>{const f=structuredClone(fixture);mutate(f);assert.throws(()=>validateForecastArtifact(f,fixture.source_release),undefined,why);};
reject(f=>{f.source_release='b'.repeat(64);},'another release');
reject(f=>{f.results[0].method='timesfm_2.5';},'method must match the holdout selection');
reject(f=>{f.results[0].forecast_points[0].q10=1;},'baselines never carry model quantiles');
reject(f=>{f.results[0].freshness='HISTORICAL_ONLY';},'freshness must match the as_of rule');
reject(f=>{f.model.model_revision='main';},'unpinned model revision');
reject(f=>{f.results[0].series_id='IVI__XYZ__SL1__SA__MONTHLY';},'unsupported series');
reject(f=>{f.current_advice_series=0;},'counts must reconcile');
assert.throws(()=>validateForecastArtifact(fixture,'c'.repeat(64)));

// 2. Freshness is re-evaluated at read time, independent of the stored flag.
assert.equal(currentRange('2026-08','2027-02',new Date('2026-10-15T00:00:00Z')),true);
assert.equal(currentRange('2026-04','2026-10',new Date('2026-10-15T00:00:00Z')),false,'six months old is historical');
assert.equal(currentRange('2026-09','2026-09',new Date('2026-10-15T00:00:00Z')),false,'horizon must cover this month');
assert.equal(isCurrent(fixture.results[0],new Date('2030-01-01T00:00:00Z')),false);

// 3. Enrichment is skipped for packs it cannot help, and never throws.
assert.equal(await intelligenceForTurn(null,'jobs'),null);
assert.equal(await intelligenceForTurn({status:'NO_MATCH',queries:[],courses:[],retrievedAt:'',message:'',sourcePolicy:'USER_APPROVED_CATALOGUE'},'demand'),null);
assert.match(INTELLIGENCE_INSTRUCTION,/HISTORICAL_ONLY and absent results cannot supply a current forecast/);

// 3b. Switches: both off → nothing attached; env kill switches report DISABLED without touching Neo4j.
const ready={status:'READY' as const,queries:[],courses:[{code:'CPC30220',name:'Certificate III in Carpentry'}] as any,retrievedAt:'',message:'',sourcePolicy:'USER_APPROVED_CATALOGUE' as const};
assert.equal(await intelligenceForTurn(ready,'what is the job outlook',{graph:false,forecasts:false}),null);
process.env.INTELLIGENCE_GRAPH='off';process.env.INTELLIGENCE_FORECASTS='off';
assert.equal((await intelligenceService.connections('Qualification','CPC30220','',5)).status,'DISABLED');
assert.equal((await intelligenceService.forecast('IVI__VIC__SL3__SA__MONTHLY')).status,'DISABLED');
assert.deepEqual([(await intelligenceService.status()).graph,(await intelligenceService.status()).forecasts],['DISABLED','DISABLED']);
assert.equal(await intelligenceForTurn(ready,'what is the job outlook'),null);
delete process.env.INTELLIGENCE_GRAPH;delete process.env.INTELLIGENCE_FORECASTS;

// 3c. An unreachable graph fails open fast and is skipped while cooling down (no 2 s wait per turn).
{
  const dead=new IntelligenceService(()=>({uri:'bolt://127.0.0.1:1',user:'neo4j',password:'x',database:'neo4j',release:'r'.repeat(64),forecastFile:'',forecastSha:'',generation:''}));
  assert.equal((await dead.connections('Qualification','CPC30220','',5)).status,'UNAVAILABLE');
  const t=Date.now();assert.equal((await dead.connections('Qualification','CPC30220','',5)).status,'UNAVAILABLE');
  assert.ok(Date.now()-t<50,`cooldown skips the network (${Date.now()-t} ms)`);
  await dead.close();
}
// A malformed pin does not throw at construction.
assert.equal((await new IntelligenceService(()=>{throw Error('Invalid warehouse graph generation');}).status()).graph,'NOT_CONFIGURED');

// 4. EXP-RAG evidence: forecasts become anchored chunks; historical-only series forbid figures.
const base={status:'READY' as const,queries:[],courses:[],retrievedAt:'',message:'',sourcePolicy:'USER_APPROVED_CATALOGUE' as const};
const chunks=packEvidence({...base,intelligence:{status:'READY',source:'test',notes:[],
  graph:[{entityType:'Qualification',sourceId:'CPC30220',name:'Certificate III in Carpentry',connections:[{relation:'MAPS_TO_OCCUPATION',entityType:'Occupation',sourceId:'3312',name:'Carpenters and Joiners',method:'official_qualification_map'}]}],
  forecasts:[{seriesId:'IVI__VIC__SL3__SA__MONTHLY',geography:'VIC',skillLevel:'skill level 3',relevantCareers:['Carpenters'],status:'READY',lastObservedPeriod:'2026-08',method:'TimesFM 2.5',points:[{period:'2026-09',value:5000,q10:4800,q90:5200}]},
             {seriesId:'IVI__AUST__SL1__SA__MONTHLY',geography:'Australia',skillLevel:'skill level 1',relevantCareers:[],status:'HISTORICAL_ONLY',lastObservedPeriod:'2026-04',note:'No current forecast.'}]}});
assert.match(chunks.find(c=>c.id==='graph:Qualification:CPC30220')!.text,/mapped occupations: Carpenters and Joiners \(ANZSCO 3312\)/);
assert.ok(chunks.find(c=>c.id==='forecast:IVI__VIC__SL3__SA__MONTHLY')!.anchor);
assert.match(chunks.find(c=>c.id==='forecast:IVI__VIC__SL3__SA__MONTHLY')!.text,/80% range 4800-5200/);
assert.match(chunks.find(c=>c.id==='forecast:IVI__AUST__SL1__SA__MONTHLY')!.text,/Do not present any outlook figure/);

// 5. Live reads when the local pipeline has published (docker compose ... run --rm worker pipeline).
if(fs.existsSync('data/intelligence/current.json')&&process.env.NEO4J_PASSWORD){
  const status=await intelligenceService.status();
  assert.equal(status.graph,'READY',JSON.stringify(status));
  assert.equal(status.artifactConsistency,'MATCHED');
  const carpentry=await intelligenceService.connections('Qualification','CPC30220','MAPS_TO_OCCUPATION',5);
  assert.equal(carpentry.status,'READY');
  assert.ok(carpentry.connections.every(c=>c.relation==='MAPS_TO_OCCUPATION'));
  assert.equal((await intelligenceService.connections('Qualification','NOPE00000','',5)).status,'NO_MATCH');
  await assert.rejects(intelligenceService.connections('User','x','',5),/Invalid/,'only allowlisted entity types');
  const vic=await intelligenceService.forecast('IVI__VIC__SL3__SA__MONTHLY',true);
  assert.ok(['READY','HISTORICAL_ONLY'].includes(vic.status),vic.status);
  console.log('live:',JSON.stringify({graph:status.graph,forecasts:status.forecasts,series:status.forecastSeries,current:status.currentForecastSeries,vic:vic.status,method:vic.result?.method}));
  await intelligenceService.close();
}
console.log('PASS intelligence');
