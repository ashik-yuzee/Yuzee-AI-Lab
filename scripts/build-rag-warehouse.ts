/**
 * Builds the EXP-RAG warehouse semantic index (data/rag/warehouse-index.sqlite) from the read-only
 * Yuzee warehouse. Incremental and resumable: chunks are content-hashed and only new/changed text is
 * re-embedded; an interrupted run keeps its committed progress. Vectors are local BGE-small (CLS,
 * L2-normalised) stored as int8 with a per-vector scale; FTS5 provides BM25.
 *
 *   npm run rag:index -- [--source path] [--out path] [--threads 8] [--limit 500] [--only qualification,unit]
 */
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {embed,EMBEDDING_MODEL,embedderAvailable} from '../src/rag/embedder';
import {estimateTokens} from '../src/services/TokenBudgetMemoryManager';
import {CHUNKER_VERSION,type IndexChunk,type ChunkKind,qualificationChunk,courseChunk,occupationChunk,anzscoChunk,unitChunk,providerChunk,shortCourseChunk,levelLabel} from '../src/rag/warehouse/chunks';

const arg=(name:string,fallback?:string)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const SOURCE=arg('source',process.env.YUZEE_WAREHOUSE_DB||path.join(os.homedir(),'.yuzee-monitor/training_gov.db'))!;
const OUT=path.resolve(arg('out','data/rag/warehouse-index.sqlite')!);
const THREADS=Number(arg('threads',String(Math.max(2,Math.min(12,os.cpus().length-2)))));
const LIMIT=Number(arg('limit','0'))||Infinity;
const ONLY=new Set((arg('only','')||'').split(',').filter(Boolean)) as Set<ChunkKind>;
const PARTIAL=LIMIT!==Infinity||ONLY.size>0;
if(!fs.existsSync(SOURCE))throw Error(`Warehouse source not found: ${SOURCE} (set YUZEE_WAREHOUSE_DB or --source).`);
if(!embedderAvailable())throw Error('BGE model files are missing. Run: npm run download:bge');

const src=new DatabaseSync(SOURCE,{readOnly:true});
fs.mkdirSync(path.dirname(OUT),{recursive:true});
const db=new DatabaseSync(OUT);
db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS chunks(rowid INTEGER PRIMARY KEY,id TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,entity TEXT,title TEXT,text TEXT,meta TEXT,hash TEXT,tokens INTEGER,vec BLOB,run INTEGER);
CREATE INDEX IF NOT EXISTS chunks_kind ON chunks(kind);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(title,text,content='chunks',content_rowid='rowid',tokenize='porter unicode61 remove_diacritics 2');`);
const has=(t:string)=>!!src.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const run=Date.now();
const MODEL_KEY=`${EMBEDDING_MODEL.id}@${EMBEDDING_MODEL.revision}`;
const getRow=db.prepare('SELECT hash,vec IS NOT NULL AS ready FROM chunks WHERE id=?');
const touch=db.prepare('UPDATE chunks SET run=? WHERE id=?');
const upsert=db.prepare(`INSERT INTO chunks(id,kind,entity,title,text,meta,hash,tokens,vec,run) VALUES(?,?,?,?,?,?,?,?,NULL,?)
 ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,entity=excluded.entity,title=excluded.title,text=excluded.text,meta=excluded.meta,hash=excluded.hash,tokens=excluded.tokens,vec=NULL,run=excluded.run`);
const setVec=db.prepare('UPDATE chunks SET vec=? WHERE id=?');

/** int8 symmetric quantisation with a float32 scale prefix (388 bytes per 384-d vector). */
function quantise(v:Float32Array):Uint8Array{
  let max=0;for(const x of v)max=Math.max(max,Math.abs(x));
  const scale=max/127||1,buf=new ArrayBuffer(4+v.length),view=new DataView(buf);view.setFloat32(0,scale,true);
  const q=new Int8Array(buf,4);for(let i=0;i<v.length;i++)q[i]=Math.round(v[i]/scale);
  return new Uint8Array(buf);
}

const stats:Record<string,{total:number;embedded:number}>={};
let pending:IndexChunk[]=[];let inTx=false;
const begin=()=>{if(!inTx){db.exec('BEGIN');inTx=true;}};
const commit=()=>{if(inTx){db.exec('COMMIT');inTx=false;}};
async function flush(){
  if(!pending.length)return;
  const batch=pending;pending=[];
  // Similar lengths per batch reduce padding work.
  batch.sort((a,b)=>a.text.length-b.text.length);
  const vectors=await embed(batch.map(c=>`${c.title}\n${c.text}`),'passage',{threads:THREADS,batch:32});
  begin();batch.forEach((c,i)=>setVec.run(quantise(vectors[i]),c.id));commit();
  for(const c of batch)stats[c.kind].embedded++;
}
async function add(c:IndexChunk){
  const s=stats[c.kind]??={total:0,embedded:0};s.total++;
  const hash=createHash('sha1').update(`${CHUNKER_VERSION}|${MODEL_KEY}|${c.title}|${c.text}`).digest('hex');
  const row=getRow.get(c.id) as any;
  begin();
  if(row&&row.hash===hash&&row.ready){touch.run(run,c.id);return;}
  upsert.run(c.id,c.kind,c.entity,c.title,c.text,JSON.stringify(c.meta),hash,estimateTokens(c.text),run);
  pending.push(c);
  if(pending.length>=256){commit();await flush();}
}
const wanted=(k:ChunkKind)=>!ONLY.size||ONLY.has(k);
const t0=Date.now();
const progress=(k:string)=>console.log(`[${((Date.now()-t0)/1000).toFixed(0)}s] ${k}: ${stats[k]?.total??0} chunks, ${stats[k]?.embedded??0} embedded`);

// Provider names/states are reused by qualification grouping.
const institutions=new Map<number,{name:string;state:string}>();
if(has('live_institutions'))for(const r of src.prepare('SELECT id,legal_name,business_name,public_known_as,state FROM live_institutions').iterate() as any)institutions.set(r.id,{name:r.public_known_as||r.business_name||r.legal_name,state:r.state||''});

// National (training.gov.au) codes decide grouping: any offering of a national qualification, including
// one delivered by a university, joins its qualification group; everything else is a provider-specific course.
const VET_TYPES=new Set(['Qualification','Skill set','Accredited course']);
const tga=new Map<string,any>();
if(has('courses'))for(const r of src.prepare(`SELECT national_code,national_title,nrt_type,qualification_level_name,usage_recommendation,nrt_status,description,asced4_name,taxonomy_occupation,taxonomy_industry,anzsco_name FROM courses WHERE nrt_type IN ('Qualification','Skill set','Accredited course')`).iterate() as any)tga.set(String(r.national_code).toUpperCase(),r);
const nationalCode=(r:any)=>{
  const declared=String(r.national_code||'').trim().toUpperCase();
  if(declared&&(tga.has(declared)||VET_TYPES.has(r.course_type)))return declared;
  const named=String(r.course_name||'').toUpperCase().match(/\b([A-Z]{3}\d{5}|[A-Z]{3,5}SS\d{5}|\d{5}NAT)\b/)?.[1];
  return named&&tga.has(named)?named:null;
};
const groups=new Map<string,{offerings:number;providers:Map<string,string>;best:number;score:number;name:string;level:string|null}>();
const providerSpecific=new Set<number>();
for(const r of src.prepare('SELECT id,national_code,course_name,course_type,aqf_level,institution_id,institution_name,yuzee_readiness_score,data_trust_score FROM live_courses').iterate() as any){
  const code=nationalCode(r);
  if(!code){providerSpecific.add(r.id);continue;}
  const g=groups.get(code)??{offerings:0,providers:new Map(),best:r.id,score:-1,name:r.course_name,level:r.aqf_level};
  g.offerings++;
  const inst=institutions.get(r.institution_id);const name=inst?.name||r.institution_name;
  if(name&&!g.providers.has(name))g.providers.set(name,inst?.state||'');
  const score=(Number(r.yuzee_readiness_score)||0)+(Number(r.data_trust_score)||0)/10+(VET_TYPES.has(r.course_type)?1:0);
  if(score>g.score){g.score=score;g.best=r.id;g.name=r.course_name;g.level=r.aqf_level;}
  groups.set(code,g);
}

// 1. Qualifications, skill sets and accredited courses grouped by national code.
if(wanted('qualification')){
  const core=new Map<string,string[]>();
  if(has('qualification_units'))for(const r of src.prepare(`SELECT qualification_code,unit_title FROM qualification_units WHERE unit_type='CORE' ORDER BY qualification_code,sort_order`).iterate() as any){const k=String(r.qualification_code).toUpperCase();const l=core.get(k)??[];if(l.length<12)l.push(r.unit_title);core.set(k,l);}
  const intelOf=src.prepare('SELECT intelligence_json FROM live_courses WHERE id=?');
  const codes=new Set([...groups.keys(),...[...tga].filter(([,r])=>r.nrt_type!=='Skill set'&&r.usage_recommendation==='Current').map(([k])=>k)]);
  let n=0;
  for(const code of codes){
    if(n++>=LIMIT)break;
    const g=groups.get(code),t=tga.get(code);
    let intel=null;if(g){try{intel=JSON.parse((intelOf.get(g.best) as any)?.intelligence_json||'null');}catch{}}
    await add(qualificationChunk({code,title:t?.national_title||g?.name||code,nrtType:t?.nrt_type||null,level:t?.qualification_level_name||levelLabel(g?.level)||null,status:t?.usage_recommendation||t?.nrt_status||null,description:t?.description||null,field:t?.asced4_name||null,occupations:t?.taxonomy_occupation||null,industry:t?.taxonomy_industry||null,anzsco:t?.anzsco_name||null,coreUnits:core.get(code)||[],offerings:g?.offerings||0,providers:g?[...g.providers].map(([name,state])=>({name,state})):[],intel}));
  }
  progress('qualification');
}
// 2. Higher-education and other provider-specific course records (no national code).
if(wanted('course')){
  let n=0;
  for(const r of src.prepare(`SELECT id,course_name,institution_name,institution_id,course_type,aqf_level,national_code,course_code,duration_text,delivery_modes_json,locations_json,entry_requirements,description,intelligence_json,updated_at FROM live_courses WHERE course_type NOT IN ('Qualification','Skill set','Accredited course')`).iterate() as any){
    if(!providerSpecific.has(r.id))continue;
    if(n++>=LIMIT)break;
    const c=courseChunk(r);
    // Single subjects are labelled so they never pass for a whole program.
    if(!/\b(bachelor|diploma|certificate|master|graduate|associate degree|doctor|honours|juris|phd|course in)\b/i.test(r.course_name||'')){c.meta.subject=true;c.text=c.text.replace(' — ',' — single subject/unit · ');}
    await add(c);
  }
  progress('course');
}
// 3. O*NET occupation profiles with skills and Australian mappings.
if(wanted('occupation')&&has('onet_occupation')){
  const skills=new Map<string,string[]>();
  for(const r of src.prepare('SELECT job_id,skill_name FROM onet_job_skill ORDER BY job_id,confidence DESC').iterate() as any){const l=skills.get(r.job_id)??[];if(l.length<10&&!l.includes(r.skill_name))l.push(r.skill_name);skills.set(r.job_id,l);}
  const cross=new Map<string,string[]>();
  if(has('onet_anzsco_crosswalk'))for(const r of src.prepare('SELECT job_id,anzsco_code,anzsco_title FROM onet_anzsco_crosswalk WHERE confidence>=0.6 ORDER BY confidence DESC').iterate() as any){const l=cross.get(r.job_id)??[];if(l.length<4)l.push(`${r.anzsco_title} (${r.anzsco_code})`);cross.set(r.job_id,l);}
  let n=0;for(const r of src.prepare('SELECT * FROM onet_occupation').iterate() as any){if(n++>=LIMIT)break;await add(occupationChunk(r,skills.get(r.job_id)||[],cross.get(r.job_id)||[]));}
  progress('occupation');
}
// 4. ANZSCO occupation groups with the national JSA projection.
if(wanted('anzsco')&&has('canonical_occupation')){
  const proj=new Map<string,any>();
  if(has('jsa_employment_projection'))for(const r of src.prepare(`SELECT * FROM jsa_employment_projection WHERE state_code='AUS' ORDER BY release_date`).iterate() as any)proj.set(String(r.anzsco_code),r);
  let n=0;for(const r of src.prepare('SELECT * FROM canonical_occupation').iterate() as any){if(n++>=LIMIT)break;await add(anzscoChunk(r,proj.get(String(r.anzsco_code))));}
  progress('anzsco');
}
// 5. Current units of competency and the qualifications that contain them.
if(wanted('unit')&&has('units_of_competency')){
  const titles=new Map<string,string>();
  if(has('courses'))for(const r of src.prepare(`SELECT national_code,national_title FROM courses WHERE nrt_type='Qualification'`).iterate() as any)titles.set(String(r.national_code).toUpperCase(),r.national_title);
  const quals=new Map<string,Array<{code:string;title:string}>>();
  if(has('qualification_units'))for(const r of src.prepare('SELECT unit_code,qualification_code FROM qualification_units').iterate() as any){const code=String(r.qualification_code).toUpperCase();const t=titles.get(code);if(!t)continue;const l=quals.get(r.unit_code)??[];if(l.length<6&&!l.some(q=>q.code===code))l.push({code,title:t});quals.set(r.unit_code,l);}
  let n=0;for(const r of src.prepare(`SELECT unit_code,unit_title,parent_package_title,description,application FROM units_of_competency WHERE nrt_status='Current' AND (length(description)>40 OR length(application)>40)`).iterate() as any){if(n++>=LIMIT)break;await add(unitChunk(r,quals.get(r.unit_code)||[]));}
  progress('unit');
}
// 6. Providers: public identity, place and recorded support only (no contacts).
if(wanted('provider')&&has('live_institutions')){
  const counts=new Map<number,number>();for(const r of src.prepare('SELECT institution_id,count(*) n FROM live_courses GROUP BY institution_id').iterate() as any)counts.set(r.institution_id,r.n);
  let n=0;for(const r of src.prepare('SELECT id,legal_name,business_name,public_known_as,rto_type,city,state,rto_code,cricos_code,higher_education_code,has_student_support,has_disability_support,has_indigenous_support,has_library,has_apprenticeships FROM live_institutions').iterate() as any){if(n++>=LIMIT)break;await add(providerChunk(r,counts.get(r.id)||0));}
  progress('provider');
}
// 7. Short courses.
if(wanted('short_course')&&has('live_short_courses')){
  let n=0;for(const r of src.prepare('SELECT id,course_name,institution_name,institution_id,category,level_code,description,duration_value,duration_unit,delivery_type FROM live_short_courses').iterate() as any){if(n++>=LIMIT)break;await add(shortCourseChunk(r));}
  progress('short_course');
}

commit();await flush();
begin();
if(!PARTIAL){const removed=db.prepare('DELETE FROM chunks WHERE run<>?').run(run);console.log(`Removed ${removed.changes} stale chunks.`);}
db.exec(`INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')`);
const stat=fs.statSync(SOURCE);
const counts=Object.fromEntries((db.prepare('SELECT kind,count(*) n FROM chunks GROUP BY kind').all() as any[]).map(r=>[r.kind,r.n]));
const meta={chunker:CHUNKER_VERSION,model:MODEL_KEY,dimensions:EMBEDDING_MODEL.dimensions,pooling:EMBEDDING_MODEL.pooling,quantisation:'int8+scale',builtAt:new Date().toISOString(),source:{path:path.resolve(SOURCE),size:stat.size,mtime:stat.mtimeMs},partial:PARTIAL,counts};
const setMeta=db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
for(const [k,v] of Object.entries(meta))setMeta.run(k,JSON.stringify(v));
commit();
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();src.close();
console.log(`Done in ${((Date.now()-t0)/1000).toFixed(0)}s:`,JSON.stringify(stats));
