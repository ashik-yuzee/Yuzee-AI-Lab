// Public, bounded projections for skills → occupations → learning and stored job advertisements.
// This index is derived locally. The source database is never changed.
const clean=(v,n=600)=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const norm=v=>clean(v,160).toLowerCase();
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v;}catch{return null;}};
const list=(v,max=12)=>(Array.isArray(parse(v))?parse(v):[]).map(x=>clean(typeof x==='object'?x.name||x.skill_name||x.label:x,160)).filter(Boolean).slice(0,max);
const tokens=v=>(norm(v).match(/[\p{L}\p{N}]+/gu)||[]).slice(0,8);
const clause=v=>tokens(v).map(w=>'"'+w+'"'+(w.length>2?'*':'')).join(' AND ');
const tables=db=>new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
function buildOpportunityIndex(source,index){
 const available=tables(source);
 index.exec(`CREATE VIRTUAL TABLE role_search USING fts5(role_id UNINDEXED,title,skills,description,aliases,tokenize='unicode61 remove_diacritics 2');
 CREATE TABLE role_skills(role_id TEXT,skill_id TEXT,name TEXT,description TEXT); CREATE INDEX role_skill_lookup ON role_skills(role_id);
 CREATE VIRTUAL TABLE learning_search USING fts5(code UNINDEXED,name,kind UNINDEXED,method UNINDEXED,tokenize='unicode61 remove_diacritics 2');
 CREATE VIRTUAL TABLE job_search USING fts5(job_id UNINDEXED,title,skills,description,tokenize='unicode61 remove_diacritics 2');
 CREATE TABLE job_geo(job_id TEXT PRIMARY KEY,city TEXT,state TEXT,postcode TEXT,sa4 TEXT); CREATE INDEX job_area ON job_geo(state,city); CREATE INDEX job_postcode ON job_geo(postcode); CREATE INDEX job_sa4 ON job_geo(sa4);`);
 const skillInsert=index.prepare('INSERT INTO role_skills VALUES(?,?,?,?)'),skillGroups=new Map();
 if(available.has('onet_job_skill')){
  const cols=new Set(source.prepare('PRAGMA table_info(onet_job_skill)').all().map(c=>c.name));
  for(const r of source.prepare('SELECT job_id,skill_name'+(cols.has('skill_desc')?',skill_desc':'')+' FROM onet_job_skill').iterate()){
   const id=String(r.job_id),name=clean(r.skill_name,120);if(!name)continue;
   const skillId='skill:'+norm(name);skillInsert.run(id,skillId,name,clean(r.skill_desc));
   if(!skillGroups.has(id))skillGroups.set(id,[]);skillGroups.get(id).push(name);
  }
 }
 if(available.has('onet_occupation')){
  const insert=index.prepare('INSERT INTO role_search VALUES(?,?,?,?,?)'),cols=new Set(source.prepare('PRAGMA table_info(onet_occupation)').all().map(c=>c.name));
  for(const r of source.prepare('SELECT job_id,job_title,description'+(cols.has('keywords')?',keywords':'')+' FROM onet_occupation').iterate())insert.run(String(r.job_id),clean(r.job_title,180),(skillGroups.get(String(r.job_id))||[]).join(' | '),clean(r.description,800),clean(r.keywords,1000));
 }
 if(available.has('course_skill_edge')){
  const insert=index.prepare('INSERT INTO learning_search VALUES(?,?,?,?)');
  for(const r of source.prepare('SELECT national_code,skill_name,skill_type,method FROM course_skill_edge').iterate())if(r.national_code&&r.skill_name)insert.run(r.national_code,clean(r.skill_name,240),clean(r.skill_type,80),clean(r.method,100));
 }
 if(available.has('outside_jobs')){
  const geoInsert=index.prepare('INSERT OR IGNORE INTO job_geo VALUES(?,?,?,?,?)'),insert=index.prepare('INSERT INTO job_search VALUES(?,?,?,?)'),postcodes=new Map();
  if(available.has('dim_location_asgs'))for(const r of source.prepare('SELECT DISTINCT postcode,state_code,sa4_code FROM dim_location_asgs').iterate()){
   const key=r.state_code+':'+r.postcode;if(!postcodes.has(key))postcodes.set(key,new Set());if(r.sa4_code)postcodes.get(key).add(String(r.sa4_code));
  }
  for(const r of source.prepare("SELECT id,title,skills_json,description,city,state,postal_code FROM outside_jobs WHERE privacy_level='PUBLIC' AND status='active' AND upper(country) IN ('AU','AUSTRALIA','AUS')").iterate()){
   insert.run(String(r.id),clean(r.title,200),list(r.skills_json,30).join(' | '),clean(r.description,1800));
   const sa4=postcodes.get(r.state+':'+r.postal_code);geoInsert.run(String(r.id),norm(r.city),clean(r.state,3).toUpperCase(),clean(r.postal_code,4),sa4?.size===1?[...sa4][0]:'');
  }
 }
}
function createOpportunityReader(source,index){
 const available=tables(source),query=(t,sql,args=[])=>available.has(t)?source.prepare(sql).all(...args):[];
 function read(plan={},location){
  const facets=new Set(plan.facets||[]),requested=facets.has('SKILLS')||facets.has('JOBS')||facets.has('LEARNING')||(plan.skill_queries||[]).length;
  if(!requested)return null;
  const skills=(plan.skill_queries||[]).map(q=>clean(q,100)).filter(Boolean).slice(0,6),roleTerms=(plan.occupation_queries||[]).slice(0,3),roles=new Map();
  // Match each concept separately: someone can bring several transferable skills, not necessarily every skill in one title.
  for(const [kind,phrases] of [['role',roleTerms],['related',roleTerms.length?[]:[...(plan.role_queries||[]),...(plan.job_queries||[])]],['hint',skills],['skill',skills]])for(const phrase of phrases){
   let match=clause(phrase);if(!match)continue;
   const search=(q,alias=false)=>index.prepare('SELECT role_id,title,bm25(role_search,0,8,4,1,6) rank FROM role_search WHERE role_search MATCH ? ORDER BY rank LIMIT 12').all((kind==='skill'?'skills : ':alias?'aliases : ':'title : ')+'('+q+')');
   let found=search(match);
   if(!found.length&&kind!=='skill'&&kind!=='hint'){const reduced=tokens(phrase).filter(w=>!new Set(['officer','assistant','technician','representative','specialist','analyst','worker','workers','career']).has(w));if(reduced.length>=2)found=search(clause(reduced.join(' ')));if(!found.length)found=search(match,true);}
   for(const r of found){if(!roles.has(r.role_id))roles.set(r.role_id,{...r,score:0,matchedSkills:[],named:false});const hit=roles.get(r.role_id);hit.score+=kind==='skill'?1:100;hit.named ||=kind==='role';hit.hint ||=kind==='hint';hit.related ||=kind==='related'||kind==='hint';if(kind==='skill'&&!hit.matchedSkills.includes(phrase))hit.matchedSkills.push(phrase);}
  }
  const values=[...roles.values()],focused=roleTerms.length?values.filter(r=>r.named||r.hint):values.some(r=>r.related)?values.filter(r=>r.related):(plan.role_queries||[]).length?[]:values;
  const candidates=focused.sort((a,b)=>b.score-a.score||a.rank-b.rank||a.title.localeCompare(b.title)).slice(0,12);
  const selectedRoles=(Array.isArray(plan.role_ids)?candidates.filter(r=>plan.role_ids.includes('role:'+r.role_id)).sort((a,b)=>plan.role_ids.indexOf('role:'+a.role_id)-plan.role_ids.indexOf('role:'+b.role_id)):plan.candidate_pool?candidates:candidates.slice(0,4)).map(r=>{
   const row=query('onet_occupation','SELECT job_id,job_title,description,tasks FROM onet_occupation WHERE job_id=?',[r.role_id])[0];
   const mappings=query('onet_anzsco_crosswalk','SELECT anzsco_code,anzsco_title,method,confidence FROM onet_anzsco_crosswalk WHERE job_id=? ORDER BY confidence DESC LIMIT 2',[r.role_id]);
   const requirements=index.prepare('SELECT skill_id AS id,name,description FROM role_skills WHERE role_id=? LIMIT 18').all(r.role_id);
   return {id:'role:'+r.role_id,evidenceId:'warehouse_role_'+r.role_id,title:r.title,description:clean(row?.description),tasks:list(row?.tasks,4),matchedSkills:r.matchedSkills,skills:requirements,mappings,source:'O*NET occupation profile',scope:'General occupational context; stored Australian crosswalks are shown separately',matchReason:r.named?'Matches the occupation requested':'Uses one or more of the skills being explored; personal suitability is not established'};
  });
  const learning=[];
  if(facets.has('LEARNING'))for(const phrase of skills){
   const match=clause(phrase);if(!match)continue;
   for(const r of index.prepare('SELECT code,name,kind,method FROM learning_search WHERE learning_search MATCH ? ORDER BY rank LIMIT 8').all(match)){
    if(learning.some(x=>x.code===r.code&&x.skill===r.name))continue;
    const courses=index.prepare('SELECT course_id,course_name,institution_name FROM catalogue WHERE national_code=? LIMIT 2').all(r.code);
    learning.push({id:'learning:'+r.code+':'+learning.length,evidenceId:'warehouse_learning_'+r.code+'_'+learning.length,code:r.code,skill:r.name,kind:r.kind,method:r.method,query:phrase,courses:courses.map(c=>({id:c.course_id,name:c.course_name,provider:c.institution_name})),scope:'Stored qualification-to-skill or unit link; delivery and assessment are not established by this link'});
   }
  }
  const jobs=[],observedSkills=[];let geography=null,sampleSize=0,withSkills=0;
  const jobTerms=[...new Set((plan.job_queries||[]).length?plan.job_queries:roleTerms.length?roleTerms:(plan.role_queries||[]).length?plan.role_queries:skills)].filter(x=>clause(x)).slice(0,8);
  if(facets.has('JOBS')&&available.has('outside_jobs')&&jobTerms.length){
   const local=plan.location||{},region=location?.region,stages=[];
   if(region){
    if(local.name)stages.push({where:'g.city=? AND g.state=?',args:[norm(local.name),region.state],scope:'SUBURB',name:clean(local.name),local:true});
    if(/^\d{4}$/.test(local.postcode||''))stages.push({where:'g.postcode=? AND g.state=?',args:[local.postcode,region.state],scope:'POSTCODE',name:local.postcode,local:true});
    const sa4=(location.chain||[]).find(x=>x.tier==='SA4');if(sa4)stages.push({where:'g.sa4=?',args:[String(sa4.region_key)],scope:'SA4',name:sa4.name,local:region.tier==='SA4'});
    if(region.state)stages.push({where:'g.state=?',args:[region.state],scope:'STATE',name:region.state,local:region.tier==='STATE'});
   }else if(!location?.requested)stages.push({where:'1=1',args:[],scope:'NATIONAL',name:'Australia',local:false});
   // Unresolved/ambiguous user locations never silently become an unrestricted search.
   for(const stage of stages){
    const candidateIds=new Set();
    for(const phrase of jobTerms){
     for(const r of index.prepare('SELECT j.job_id FROM job_search j JOIN job_geo g ON g.job_id=j.job_id WHERE job_search MATCH ? AND '+stage.where+' ORDER BY rank LIMIT 100').all(clause(phrase),...stage.args))candidateIds.add(r.job_id);
    }
    if(!candidateIds.size)continue;
    const ids=[...candidateIds].slice(0,800);
    const found=query('outside_jobs',`SELECT id,title,company_name,city,state,postal_code,skills_json,requirements_json,description,employment_type,work_mode,salary_text,posted_at,updated_at,expired_at,job_url,source FROM outside_jobs WHERE id IN (${ids.map(()=>'?').join(',')}) AND privacy_level='PUBLIC' AND status='active' AND upper(country) IN ('AU','AUSTRALIA','AUS') AND (expired_at IS NULL OR expired_at='' OR julianday(expired_at)>julianday('now')) ORDER BY COALESCE(NULLIF(posted_at,''),updated_at) DESC,id DESC LIMIT 40`,ids);
    if(!found.length)continue;
    geography={scope:stage.scope,name:stage.name,localMatch:stage.local};sampleSize=found.length;
    const counts=new Map();
    for(const r of found){const names=[...new Set(list(r.skills_json,30))];if(names.length)withSkills++;for(const name of names){const k=norm(name);if(!counts.has(k))counts.set(k,{name,count:0});counts.get(k).count++;}}
    observedSkills.push(...[...counts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,8).map((s,i)=>({...s,id:'observed:'+i,evidenceId:'warehouse_observed_skill_'+i,denominator:sampleSize,scope:'Structured skills in the retrieved advertisement sample only',geography:stage.name})));
    jobs.push(...found.slice(0,6).map(r=>({id:String(r.id),evidenceId:'warehouse_job_'+r.id,title:clean(r.title,200),company:clean(r.company_name,160),area:[r.city,r.state,r.postal_code].filter(Boolean).join(', '),skills:list(r.skills_json),requirements:list(r.requirements_json,6),description:clean(r.description,800),employmentType:clean(r.employment_type,100),workMode:clean(r.work_mode,100),salary:clean(r.salary_text,160),postedAt:r.posted_at||null,updatedAt:r.updated_at||null,url:/^https?:\/\//i.test(r.job_url||'')?r.job_url:null,source:clean(r.source),availability:'NOT_CONFIRMED_CURRENT',geography})));
    break;
   }
  }
  const skillsById=new Map();for(const r of selectedRoles)for(const s of r.skills){if(!skillsById.has(s.id))skillsById.set(s.id,{...s,roleIds:[]});skillsById.get(s.id).roleIds.push(r.id);}
  const displayedSkills=[...skillsById.values()].sort((a,b)=>b.roleIds.length-a.roleIds.length||a.name.localeCompare(b.name)).slice(0,12);
  return {roles:selectedRoles,skills:displayedSkills,learning:learning.slice(0,8),jobs,observedSkills,geography,coverage:{sampleSize,withStructuredSkills:withSkills,returnedJobs:jobs.length,localSkillDemand:'NOT_ESTABLISHED',note:'Job records are dated observations. Skill counts describe only the retrieved sample, not overall local demand. Missing skill fields do not mean a skill is not requested. Role matching is exploratory, not evidence the user has a skill or is eligible for a job.'}};
 }
 return {read};
}
module.exports={buildOpportunityIndex,createOpportunityReader};
