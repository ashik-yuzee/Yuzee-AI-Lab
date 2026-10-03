/**
 * Precomputed warehouse intelligence for chat: Neo4j graph connections and TimesFM forecasts.
 * Port of Yuzee Dev's WarehouseIntelligenceService.java. Never runs a model or writes the graph during
 * a request; only allowlisted, bounded, read-mode queries against a READY release. Any failure fails
 * open (status UNAVAILABLE) so chat continues without it.
 *
 * Configuration (env wins, otherwise data/intelligence/current.json written by the worker pipeline):
 *   WAREHOUSE_NEO4J_URI|NEO4J_URI, WAREHOUSE_NEO4J_USER|NEO4J_USER, WAREHOUSE_NEO4J_PASSWORD|NEO4J_PASSWORD,
 *   WAREHOUSE_NEO4J_DATABASE, WAREHOUSE_INTELLIGENCE_RELEASE, WAREHOUSE_FORECAST_FILE, WAREHOUSE_FORECAST_SHA256,
 *   WAREHOUSE_GRAPH_GENERATION (optional pin).
 * Kill switches: INTELLIGENCE_GRAPH=off, INTELLIGENCE_FORECASTS=off (status DISABLED). Per-request toggles come from
 * the client; both default on. The driver is loaded only when a graph is configured, and an unreachable graph is
 * skipped for GRAPH_COOLDOWN_MS so chat never waits on a dead connection twice.
 */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import type {Driver} from 'neo4j-driver';
import {validateForecastArtifact,isCurrent,currentRange,type ForecastRun,type ForecastResult} from './forecastArtifact';

export const ENTITY_TYPES=new Set(['Qualification','CourseOffering','Occupation','Skill','ProviderRegistration','Institution','RegionKey','StateOrNation','ForecastSeries','ONetOccupation','ONetSkill','ONetSubject','SOCOccupation']);
export const RELATIONS=new Set(['','OFFERS_QUALIFICATION','REQUIRES_SKILL','MAPS_TO_OCCUPATION','OBSERVED_EMPLOYER_DEMAND','OBSERVED_REGIONAL_DEMAND','MATCHES_WORK','OVERLAPS_OFFERINGS','REGISTERED_AS','LEADS_TO','DELIVERED_BY','HAS_FORECAST','WITHIN_REGION','CROSSWALKS_TO','USES_ONET_SKILL','USES_ONET_SUBJECT','RELATED_OCCUPATION','TITLE_MATCHES_ONET']);

export interface Connection{relation:string;entityType:string;sourceId:string;name:string;scope?:string|null;period?:string|null;method?:string|null;sourceConfidence?:number|null;sourceName?:string|null;
  historicalEvidence?:boolean|null;forecastThrough?:string|null;regionKey?:string|null;state?:string|null;currentAdviceEligible?:boolean|null;sourceTable?:string;sourceOrdinal?:number}
type Config={uri:string;user:string;password:string;database:string;release:string;forecastFile:string;forecastSha:string;generation:string};

export const graphEnabled=()=>process.env.INTELLIGENCE_GRAPH!=='off';
export const forecastsEnabled=()=>process.env.INTELLIGENCE_FORECASTS!=='off';
const GRAPH_COOLDOWN_MS=60_000;
type Neo4j=typeof import('neo4j-driver').default;
let neo4jModule:Promise<Neo4j>|undefined;
const loadNeo4j=()=>neo4jModule??=import('neo4j-driver').then(m=>(m.default??m) as Neo4j).catch(e=>{neo4jModule=undefined;throw e;});

const RUNS=path.resolve(process.env.INTELLIGENCE_RUNS_DIR||'data/intelligence');
function readConfig():Config{
  let pinned:any={};
  try{pinned=JSON.parse(fs.readFileSync(path.join(RUNS,'current.json'),'utf8'));}catch{}
  const env=(...names:string[])=>names.map(n=>process.env[n]).find(v=>v&&v.trim())?.trim()||'';
  const generation=env('WAREHOUSE_GRAPH_GENERATION');
  if(generation&&!/^[a-f0-9]{64}$/.test(generation))throw Error('Invalid warehouse graph generation');
  return {
    uri:env('WAREHOUSE_NEO4J_URI','NEO4J_URI'),user:env('WAREHOUSE_NEO4J_USER','NEO4J_USER')||'neo4j',password:env('WAREHOUSE_NEO4J_PASSWORD','NEO4J_PASSWORD'),
    database:env('WAREHOUSE_NEO4J_DATABASE','NEO4J_DATABASE')||'neo4j',
    release:env('WAREHOUSE_INTELLIGENCE_RELEASE')||pinned.source_release||'',
    forecastFile:env('WAREHOUSE_FORECAST_FILE')||(pinned.forecast?.file?path.join(RUNS,pinned.forecast.file):''),
    forecastSha:env('WAREHOUSE_FORECAST_SHA256')||pinned.forecast?.sha256||'',
    generation,
  };
}

export class IntelligenceService{
  private driver?:Driver;private driverKey='';private config:Config;private configStamp=-1;private downUntil=0;
  private forecastCache?:{file:string;sha:string;run:ForecastRun};
  private pointer?:{key:string;at:number;rows:Record<string,any>[]};
  // A malformed env pin must not stop the server from booting; the service reports NOT_CONFIGURED instead.
  constructor(private configSource:()=>Config=readConfig){
    try{this.config=configSource();}catch(e){console.error('[intelligence] Invalid configuration:',(e as Error).message);this.config={uri:'',user:'',password:'',database:'neo4j',release:'',forecastFile:'',forecastSha:'',generation:''};}
  }

  /** A new pipeline run (current.json) is picked up without restart; each artifact is still verified by SHA-256. */
  private refresh(){
    let stamp=0;try{stamp=fs.statSync(path.join(RUNS,'current.json')).mtimeMs;}catch{}
    if(stamp!==this.configStamp){this.configStamp=stamp;try{this.config=this.configSource();}catch{/* keep last valid */}}
    return this.config;
  }
  private async graph(c:Config){
    const neo4j=await loadNeo4j();
    const key=`${c.uri}|${c.user}|${crypto.createHash('sha256').update(c.password).digest('hex')}`;
    if(!this.driver||this.driverKey!==key){
      this.driver?.close().catch(()=>{});
      this.driver=neo4j.driver(c.uri,neo4j.auth.basic(c.user,c.password),{connectionTimeout:2000,connectionAcquisitionTimeout:2000,maxConnectionPoolSize:4,maxTransactionRetryTime:0,disableLosslessIntegers:true});
      this.driverKey=key;
    }
    return this.driver;
  }
  private async query(c:Config,cypher:string,params:Record<string,unknown>){
    if(Date.now()<this.downUntil)throw Error('Graph unavailable (cooling down)');
    const neo4j=await loadNeo4j();
    const session=(await this.graph(c)).session({database:c.database,defaultAccessMode:neo4j.session.READ});
    try{return (await session.run(cypher,{...params,...('limit' in params?{limit:neo4j.int(Number(params.limit))}:{})},{timeout:3000})).records.map(r=>r.toObject());}
    catch(e:any){
      // Connection-level failures (server down, DNS, auth, timeouts) back off; query errors do not.
      if(/ServiceUnavailable|SessionExpired|Unauthorized|Neo\.ClientError\.Security|connect|ECONNREFUSED|ENOTFOUND|timed? ?out/i.test(`${e?.code} ${e?.message}`))this.downUntil=Date.now()+GRAPH_COOLDOWN_MS;
      throw e;
    }finally{await session.close().catch(()=>{});}
  }
  private graphConfigured(c:Config){return graphEnabled()&&!!(c.uri&&c.release&&c.password);}
  /** READY releases only; STAGED/BUILDING generations are never served. */
  private async selectedRelease(c:Config){
    // The pointer changes only when the worker publishes; caching it for 60 s saves a round trip per lookup.
    const key=`${c.uri}|${c.release}|${c.generation}`;
    if(this.pointer?.key===key&&Date.now()-this.pointer.at<60_000)return this.pointer.rows;
    const rows=await this.readRelease(c);
    this.pointer={key,at:Date.now(),rows};
    return rows;
  }
  private async readRelease(c:Config){
    const projection=' WHERE r.sourceRelease=$release RETURN r.id AS generation,r.forecastContentSha AS forecastContentSha';
    return c.generation
      ?this.query(c,"MATCH(r:WarehouseRelease {id:$generation,status:'READY'})"+projection,{generation:c.generation,release:c.release})
      :this.query(c,"MATCH(p:WarehousePointer {id:'current'}) MATCH(r:WarehouseRelease {id:p.generation,status:'READY'})"+projection,{release:c.release});
  }
  private forecasts(c:Config):ForecastRun{
    if(this.forecastCache&&this.forecastCache.file===c.forecastFile&&this.forecastCache.sha===c.forecastSha)return this.forecastCache.run;
    const bytes=fs.readFileSync(c.forecastFile);
    if(bytes.length>10*1024*1024)throw Error('Forecast artifact exceeds read budget');
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==c.forecastSha)throw Error('Forecast artifact fingerprint mismatch');
    const run=validateForecastArtifact(JSON.parse(bytes.toString('utf8')),c.release);
    this.forecastCache={file:c.forecastFile,sha:c.forecastSha,run};
    return run;
  }
  private forecastMatches(c:Config,pointer:Record<string,any>){
    if(!c.forecastFile||!c.forecastSha)return false;
    try{return this.forecasts(c).content_sha256===pointer.forecastContentSha;}catch{return false;}
  }

  async connections(entityType:string,sourceId:string,relation='',limit=10):Promise<{status:string;sourceRelease?:string;generation?:string;connections:Connection[]}>{
    if(!ENTITY_TYPES.has(entityType)||!RELATIONS.has(relation)||!sourceId?.trim()||sourceId.length>120||!Number.isInteger(limit)||limit<1||limit>50)throw Error('Invalid connection query');
    if(!graphEnabled())return {status:'DISABLED',connections:[]};
    const c=this.refresh();
    if(!c.uri||!c.release||!c.password)return {status:'NOT_CONFIGURED',connections:[]};
    try{
      const pointer=await this.selectedRelease(c);
      if(!pointer.length)return {status:'NOT_READY',connections:[]};
      const forecastBound=this.forecastMatches(c,pointer[0]);
      if(relation==='HAS_FORECAST'&&!forecastBound)return {status:'ARTIFACT_MISMATCH',connections:[]};
      const rows=await this.query(c,"MATCH(c:WarehouseEntity {generation:$generation,entityType:$kind,sourceId:$id}) "+
        "MATCH(c)<-[:WH_SUBJECT|WH_OBJECT]-(f:WarehouseFact)-[:WH_SUBJECT|WH_OBJECT]->(other:WarehouseEntity) "+
        "WHERE other.id<>c.id AND ($relation='' OR f.relation=$relation) AND ($forecastBound OR f.relation<>'HAS_FORECAST') RETURN f.relation AS relation,other.entityType AS entityType,other.sourceId AS sourceId,"+
        "other.name AS name,f.scope AS scope,f.period AS period,f.method AS method,f.confidence_score AS sourceConfidence,f.source_name AS sourceName,f.historicalEvidence AS historicalEvidence,"+
        "f.forecastThrough AS forecastThrough,f.region_key AS regionKey,coalesce(f.state_code,f.delivery_state) AS state,f.currentAdviceEligible AS currentAdviceEligible,"+
        "f.sourceTable AS sourceTable,f.sourceOrdinal AS sourceOrdinal ORDER BY "+
        "CASE relation WHEN 'MAPS_TO_OCCUPATION' THEN 0 WHEN 'REQUIRES_SKILL' THEN 1 WHEN 'OFFERS_QUALIFICATION' THEN 2 ELSE 3 END,"+
        "relation,entityType,sourceId,sourceOrdinal LIMIT $limit",
        {generation:pointer[0].generation,kind:entityType,id:sourceId,relation,limit,forecastBound});
      const safe=rows.map(r=>r.relation==='HAS_FORECAST'?{...r,currentAdviceEligible:currentRange(String(r.period),String(r.forecastThrough))}:r) as Connection[];
      return {status:safe.length?'READY':'NO_MATCH',sourceRelease:c.release,generation:pointer[0].generation,connections:safe};
    }catch{return {status:'UNAVAILABLE',connections:[]};}
  }

  /** checkGraph=false (graph toggled off) serves the SHA-verified artifact without the graph consistency check. */
  async forecast(seriesId:string,includeHistorical=false,checkGraph=true):Promise<{status:string;seriesId?:string;lastPeriod?:string;message?:string;sourceRelease?:string;model?:Record<string,unknown>;result?:ForecastResult}>{
    if(!seriesId?.trim()||seriesId.length>120)throw Error('Invalid series ID');
    if(!forecastsEnabled())return {status:'DISABLED'};
    const c=this.refresh();
    if(!c.forecastFile||!c.forecastSha||!c.release)return {status:'NOT_CONFIGURED'};
    try{
      const run=this.forecasts(c);
      if(checkGraph&&this.graphConfigured(c)){
        const pointer=await this.selectedRelease(c);
        if(!pointer.length||!this.forecastMatches(c,pointer[0]))return {status:'ARTIFACT_MISMATCH'};
      }
      const row=run.results.find(r=>r.series_id===seriesId);
      if(!row){const skipped=run.skipped.find(s=>s.series_id===seriesId);return skipped?{status:'NOT_FORECAST',seriesId,message:skipped.reason}:{status:'NO_MATCH'};}
      const fresh=isCurrent(row);
      if(!fresh&&!includeHistorical)return {status:'HISTORICAL_ONLY',seriesId,lastPeriod:row.last_period,message:'More recent observations are needed for current advice.'};
      const now=new Date();const lag=now.getUTCFullYear()*12+now.getUTCMonth()-(Number(row.last_period.slice(0,4))*12+Number(row.last_period.slice(5))-1);
      return {status:fresh?'READY':'HISTORICAL_ONLY',sourceRelease:c.release,model:run.model,
        result:{...row,current_advice_eligible:fresh,freshness:fresh?'CURRENT':'HISTORICAL_ONLY',source_lag_months:lag}};
    }catch{return {status:'UNAVAILABLE'};}
  }

  async status():Promise<Record<string,unknown>&{graph:string;forecasts:string;sourceRelease:string|null;graphSelection:string}>{
    const c=this.refresh();const out:Record<string,unknown>={};
    let graph=graphEnabled()?'NOT_CONFIGURED':'DISABLED',forecasts=forecastsEnabled()?'NOT_CONFIGURED':'DISABLED';
    if(this.graphConfigured(c)){
      try{
        const pointer=await this.selectedRelease(c);graph=pointer.length?'READY':'NOT_READY';
        if(pointer.length){out.artifactConsistency=this.forecastMatches(c,pointer[0])?'MATCHED':'ARTIFACT_MISMATCH';out.graphGeneration=pointer[0].generation;}
      }catch{graph='UNAVAILABLE';}
    }
    if(forecastsEnabled()&&c.forecastFile&&c.forecastSha&&c.release){
      try{
        const run=this.forecasts(c);const fresh=run.results.filter(r=>isCurrent(r)).length;
        forecasts=fresh?'READY':'HISTORICAL_ONLY';
        Object.assign(out,{forecastSeries:run.results.length,currentForecastSeries:fresh,model:run.model,forecastAsOf:run.as_of});
      }catch{forecasts='UNAVAILABLE';}
    }
    if(this.graphConfigured(c)&&graph!=='READY'&&forecasts!=='DISABLED'&&c.forecastFile)forecasts=graph;
    if(out.artifactConsistency==='ARTIFACT_MISMATCH')forecasts='ARTIFACT_MISMATCH';
    return {...out,graph,forecasts,sourceRelease:c.release||null,graphSelection:c.generation?'PINNED_GENERATION':'CURRENT_POINTER'};
  }
  async close(){await this.driver?.close();}
}
export const intelligenceService=new IntelligenceService();
