import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {WarehouseService} from '../src/warehouse/service';import {WarehouseConnections} from '../src/warehouse/WarehouseConnections';import {warehouseEvidence} from '../src/warehouse/types';import {normalizeCourse} from '../src/warehouse/normalize';
async function fixture(run:(w:WarehouseService)=>Promise<void>){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'warehouse-linked-')),source=path.join(root,'source.sqlite');
 const fields=fs.readFileSync('src/warehouse/catalogue-worker.cjs','utf8').match(/const fields=`([^`]+)`/)![1].split(',');const db=new DatabaseSync(source);
 db.exec('CREATE TABLE live_courses ('+fields.map(k=>k==='id'?'id INTEGER PRIMARY KEY':k+' TEXT').join(',')+')');
 db.exec(`INSERT INTO live_courses(id,course_name,institution_id,institution_name,national_code,intelligence_json) VALUES(1,'Certificate II in Plumbing',10,'Sample TAFE','CPC20220','{}'),(2,'Bachelor of Nursing',20,'Sample University','BN','{}'),(3,'Diploma of Plumbing',10,'Sample TAFE','CPC50420','{}');
 CREATE TABLE live_institutions(id INTEGER,legal_name,rto_code,rto_type,higher_education_code,city,state,website_url,has_student_support,has_disability_support,has_library,has_apprenticeships,private_contact);
 INSERT INTO live_institutions VALUES(10,'Sample TAFE','123','TAFE',NULL,'Melbourne','VIC','',1,1,1,1,'PRIVATE_EMAIL'),(20,'Sample University',NULL,'University','PRV001','Melbourne','VIC','',1,1,1,0,'PRIVATE_EMAIL');
 CREATE TABLE institution_campuses(rto_code,location_name,town,state,postcode);INSERT INTO institution_campuses VALUES('123','Sample campus','Ringwood','VIC','3134');
 CREATE TABLE course_occupation_map(qualification_code,occupation_code,occupation_name,match_method,match_confidence,is_primary);
 INSERT INTO course_occupation_map VALUES('CPC20220','334116','Plumber (General)','official_qualification_map',0.9,1),('BN','2544','Registered Nurses','qualification_map',0.9,1);
 CREATE TABLE course_mapping_profile(course_id,course_name,qualification_code,anzsco_codes_json,occupation_titles_json,industry_codes_json,mapping_method,mapping_confidence);
 INSERT INTO course_mapping_profile VALUES('1','Certificate II in Plumbing','CPC20220','[]','[]','["Construction"]','course_title_semantic',0.6);
 CREATE TABLE canonical_occupation(anzsco_code,anzsco_title,description,source);INSERT INTO canonical_occupation VALUES('3341','Plumbers','Plumbing work','JSA'),('2544','Registered Nurses','Nursing work','JSA');
 CREATE TABLE onet_anzsco_crosswalk(job_id,anzsco_code,method,confidence);INSERT INTO onet_anzsco_crosswalk VALUES('decoy','3341','broad_semantic_map',0.1),('o1','3341','semantic_group_map',0.7);
 CREATE TABLE onet_occupation(job_id,job_title,description,tasks,work_styles);INSERT INTO onet_occupation VALUES('decoy','Elevator installers','Elevator work','["Elevator installation"]','[]'),('o1','Plumbers','Install and maintain pipes.','["Read plans","Install pipes"]','["Attention to detail"]');
 CREATE TABLE onet_job_skill(job_id,skill_name);INSERT INTO onet_job_skill VALUES('o1','Installation');
 CREATE TABLE dim_industry(anzsic_code,industry_name);INSERT INTO dim_industry VALUES('E','Construction');
 CREATE TABLE dim_crosswalk_anzsic_anzsco(anzsic_code,anzsco_code,source);INSERT INTO dim_crosswalk_anzsic_anzsco VALUES('E','3341','Official crosswalk');
 CREATE TABLE region_spine(region_key,tier,name,parent_key,state);
 INSERT INTO region_spine VALUES('ring','SA2','Ringwood','district','VIC'),('district','SA3','Maroondah','outer','VIC'),('outer','SA4','Melbourne Outer East','VIC','VIC'),('VIC','STATE','Victoria','AUS','VIC'),('AUS','NATIONAL','Australia',NULL,NULL),('spring','SA2','Springwood','NSW','NSW'),('rich1','SA2','Richmond','VIC','VIC'),('rich2','SA2','Richmond','NSW','NSW');
 INSERT INTO region_spine VALUES('ballarat-local','SA2','Ballarat','ballarat-district','VIC'),('ballarat-district','SA3','Ballarat','ballarat-region','VIC'),('ballarat-region','SA4','Ballarat','VIC','VIC');
 CREATE TABLE region_demand_edge(edge_id,region_key,anzsco_code,active_jobs,employer_count,scope,period,source_name,method,updated_at);
 INSERT INTO region_demand_edge VALUES('d1','outer','3341',42,12,'SA4','2026-05','Regional catalogue','Occupation-region edge','2026-06-01');
 CREATE TABLE jsa_employment_projection(projection_id,anzsco_code,projection_year,projection_horizon,growth_pct,state_code,release_date,updated_at);
 INSERT INTO jsa_employment_projection VALUES('p1','3341',2025,5,8.5,'AUS','2025-05-01','2025-06-01');
 CREATE TABLE employer_job_edge(edge_id,employer_name,scope,period,state_code,region_key,updated_at,method,anzsco_code,is_active);
 INSERT INTO employer_job_edge VALUES('e1','Sample Employer','STATE','2026-06','VIC','VIC','2026-06-01','occupation_map','3341',1);
 CREATE TABLE salm_unemployment_sa2(row_id,data_item,quarter,value,source,sa2_code,is_unavailable,quarter_date);
 INSERT INTO salm_unemployment_sa2 VALUES('s1','Unemployment rate','2026 Q1',4.1,'SALM','ring',0,'2026-03-01');
 CREATE TABLE abs_region_profile(region_key,region_name,region_type,population,remoteness_area,source_year,source_name);
 INSERT INTO abs_region_profile VALUES('outer','Melbourne Outer East','SA4',100000,'Metropolitan',2022,'Sample ABS');
 CREATE TABLE local_market_organisations(id,name,organisation_type,suburb,state,sa2_code,sa3_code,sa4_code,source,last_verified_at,updated_at,gemini_proposed,email);
 INSERT INTO local_market_organisations VALUES('a','Sample Community House','community_centre','Ringwood','VIC',NULL,'district','outer','Sample directory','2026-05-01','2026-05-01',0,'PRIVATE_COMMUNITY_EMAIL'),('b','SAMPLE COMMUNITY HOUSE','community_centre','RINGWOOD','VIC',NULL,'district','outer','Sample directory',NULL,'2026-04-01',0,'PRIVATE_COMMUNITY_EMAIL'),('c','Proposed Club','sport_club','Ringwood','VIC','ring','district','outer','AI suggestion',NULL,'2026-06-01',1,NULL),('d','Different State School','school','Ringwood','NSW',NULL,NULL,NULL,'Directory',NULL,NULL,0,NULL),('e','Sample College','rto','Ringwood','VIC','ring','district','outer','Directory',NULL,'2026-06-01',0,NULL);
 CREATE TABLE he_provider_entitlement_v2(institution_id,csp_undergraduate,csp_postgraduate,hecs_help,fee_help,effective_from,effective_to,current_status);
 INSERT INTO he_provider_entitlement_v2 VALUES(20,1,NULL,1,1,'2026-01-01',NULL,'current');
 CREATE TABLE course_funding_verdict(rto_code,national_code,scheme,delivery_state,funding_status,student_tuition_out_of_pocket,currency,effective_period);
 INSERT INTO course_funding_verdict VALUES('123','CPC20220','Sample Scheme','VIC','CONDITIONAL',0,'AUD','2026'),('123','CPC50420','Sample Scheme','VIC','CONDITIONAL',500,'AUD','2026');`);
 db.close();const before=fs.readFileSync(source),w=new WarehouseService({source,index:path.join(root,'index.sqlite')});
 try{w.start();for(let i=0;i<500&&w.status().status==='PREPARING';i++)await new Promise(r=>setTimeout(r,10));assert.equal(w.status().status,'READY');await run(w);assert.deepEqual(fs.readFileSync(source),before);}finally{w.close();fs.rmSync(root,{recursive:true,force:true});}
}
const ring={name:'Ringwood',state:'VIC',postcode:''};
test('course links preserve detailed occupation versus group context, industry and regional scope',()=>fixture(async w=>{
 const p=await w.lookup([],['1'],undefined,{facets:['CAREERS','INDUSTRY','PROVIDER','LOCAL','FUNDING'],location:ring,industry_queries:['construction'],occupation_queries:['plumber']});assert.equal(p.status,'READY');const c=p.connected!;
 assert.equal(c.location.region?.key,'ring');assert.equal(c.careers.length,1);assert.doesNotMatch(JSON.stringify(c.careers),/Elevator/);assert.equal(c.careers[0].id,'334116');assert.equal(c.careers[0].groupCode,'3341');assert.match(c.careers[0].profileScope,/Occupation-group/);assert.deepEqual(c.careers[0].tasks,['Read plans','Install pipes']);assert.equal(c.careers[0].courseLinks[0].method,'official_qualification_map');
 assert.ok(c.industries.some(i=>i.name==='Construction'));assert.ok(c.providers[0].support.includes('Disability support'));
 const demand=c.signals.find(x=>x.kind==='RECORDED_DEMAND')!;assert.equal(demand.scope,'SA4');assert.equal(demand.region,'Melbourne Outer East');assert.equal(demand.period,'2026-05');assert.equal(demand.localMatch,false);
 const national=c.signals.find(x=>x.kind==='PROJECTION')!;assert.equal(national.scope,'NATIONAL');assert.equal(national.localMatch,false);
 assert.equal(c.signals.find(x=>x.kind==='LOCAL_CONTEXT')!.text,'4.1%');assert.equal(c.signals.find(x=>x.kind==='EMPLOYER_SIGNAL')!.localMatch,false);
 assert.doesNotMatch(JSON.stringify(p),/PRIVATE_EMAIL|private_contact/);const evidence=warehouseEvidence(p);for(const item of [...c.careers,...c.providers,...c.signals,...c.industries])assert.ok(evidence.some(e=>e.id===item.evidenceId));
 const html=renderToStaticMarkup(<WarehouseConnections pack={p} onAreaChange={()=>{}}/>);assert.match(html,/Change area/);assert.match(html,/Wider region/);assert.match(html,/2026-05/);assert.match(html,/current vacancy is not confirmed/);assert.doesNotMatch(html,/private_contact|confidence_score/);
}));
test('ambiguous and missing area never borrow provider location or pick another suburb',()=>fixture(async w=>{
 const amb=await w.lookup([],['1'],undefined,{location:{name:'Richmond',state:'',postcode:''},facets:['LOCAL']});assert.equal(amb.connected!.location.region,null);assert.equal(amb.connected!.location.candidates.length,2);assert.ok(amb.connected!.signals.every(s=>s.scope==='NATIONAL'));
 const missing=await w.lookup([],['1'],undefined,{location:{name:'Nonexistent',state:'VIC',postcode:''},facets:['LOCAL']});assert.equal(missing.connected!.location.region,null);assert.ok(missing.connected!.signals.every(s=>s.scope==='NATIONAL'));
 const none=await w.lookup([],['1'],undefined,{facets:['LOCAL']});assert.equal(none.connected!.location.region,null);
}));
test('standalone career/industry lookups work without a course and respect no-search',()=>fixture(async w=>{
 const career=await w.lookup([],[],undefined,{occupation_queries:['plumber'],facets:['CAREERS','LOCAL'],location:ring});assert.equal(career.status,'READY');assert.equal(career.courses.length,0);assert.equal(career.connected!.careers[0].title,'Plumbers');
 const sector=await w.lookup([],[],undefined,{industry_queries:['construction'],facets:['INDUSTRY']});assert.equal(sector.status,'READY');assert.ok(sector.connected!.careers.some(c=>c.groupCode==='3341'));assert.ok(sector.connected!.industries.some(i=>i.scope==='Stored course-to-industry mapping'));
 const query=await w.lookup([],[],undefined,{occupation_queries:["' OR 1=1 --"],facets:['CAREERS']});assert.equal(query.status,'NO_MATCH');
 let calls=0;w.setPlanner(async()=>{calls++;return {output_text:JSON.stringify({action:'CAREERS',queries:[],occupation_queries:['plumber'],industry_queries:[],location:ring,facets:['CAREERS','LOCAL'],reuse_selected:false})};});const routed=await w.retrieve({message:'What is the local outlook for a plumbing career?'});assert.equal(routed.status,'READY');assert.equal(routed.connected!.location.region?.name,'Ringwood');assert.equal(calls,1);
 assert.equal((await w.retrieve({message:"Don't search, explain a plumbing career generally"})).status,'NOT_NEEDED');assert.equal(calls,1);
}));
test('university funding retains unknowns; two courses at one provider keep their own funding',()=>fixture(async w=>{
 const uni=await w.lookup([],['2'],undefined,{facets:['PROVIDER','CAREERS','FUNDING']});assert.equal(uni.connected!.careers[0].id,'2544');const f=uni.connected!.providers[0].higherEducationFunding;assert.equal(f.cspUndergraduate,true);assert.equal(f.cspPostgraduate,null);assert.equal(f.status,'current');
 const html=renderToStaticMarkup(<WarehouseConnections pack={uni} onAreaChange={()=>{}}/>);assert.match(html,/do not determine your personal eligibility/);
 const two=await w.lookup([],['1','3'],undefined,{facets:['FUNDING'],location:ring});assert.deepEqual(two.connected!.providers[0].funding.map(f=>[f.courseId,f.student_tuition_out_of_pocket]),[['1',0],['3',500]]);
}));
test('intelligence separates claimed and inferred roles, practical gaps and costs from user confidence',()=>{
 const c=normalizeCourse({id:1,course_name:'Sample',intelligence_json:JSON.stringify({learning_content:{core_skills:['Measurement']},skill_gap_map:[{name:'Further practice',description:'Use tools in a workplace'}],outcome_evidence:{provider_claimed_roles:['Trade assistant'],yuzee_inferred_roles:['Related construction roles'],confidence:'HIGH'},cost_full_picture:{equipment_cost:'AUD 200',tuition_fee:'AUD 1000'},work_readiness:{portfolio_artifacts:['Practice project']},ai_readiness:{context:'Basic AI literacy'}})});
 const info=JSON.stringify(c.intelligence);assert.match(info,/Provider claimed roles/);assert.match(info,/Yuzee inferred roles/);assert.match(info,/AUD 200/);assert.match(info,/Practice project/);assert.doesNotMatch(info,/HIGH/);
});

test('local guide starts with place and community, keeps wider counts scoped and preserves private data',()=>fixture(async w=>{
 const p=await w.lookup([],[],undefined,{location:ring,facets:['LOCAL','CAREERS','INDUSTRY']});
 assert.equal(p.status,'READY');const c=p.connected!,o=c.localOverview!;
 assert.equal(o.area,'Ringwood');assert.equal(o.profile!.area,'Melbourne Outer East');assert.equal(o.profile!.scope,'SA4');
 assert.equal(o.community.find(g=>g.key==='community')!.recordedCount,1);
 assert.doesNotMatch(JSON.stringify(o),/Proposed Club|Different State|PRIVATE_COMMUNITY_EMAIL|email/);
 assert.ok(warehouseEvidence(p).some(e=>e.id===o.evidenceId));
 assert.deepEqual(c.signals.find(s=>s.kind==='RECORDED_DEMAND')!.metrics,{advertisements:42,employers:12});
 const html=renderToStaticMarkup(<WarehouseConnections pack={p} onAreaChange={()=>{}} localFirst/>);
 const headings=['Explore possibilities in Ringwood','Around your community','Work and employers','Demand and future outlook'];
 headings.forEach((h,i)=>{assert.ok(html.includes(h));if(i)assert.ok(html.indexOf(h)>html.indexOf(headings[i-1]));});
 assert.match(html,/<details class="local-supporting-guide"><summary>Explore local places, work and outlook/);
 assert.doesNotMatch(html,/Ringwood is in|solid local anchor|regional hub/);
 assert.match(html,/Melbourne Outer East/);assert.match(html,/not confirmed open today/);assert.match(html,/not a total of all businesses/);assert.doesNotMatch(html,/How the options connect/);
 const ambiguous=await w.lookup([],[],undefined,{location:{name:'Richmond',state:'',postcode:''},facets:['LOCAL']});assert.equal(ambiguous.connected!.localOverview,null);
 const hierarchy=await w.lookup([],[],undefined,{location:{name:'Ballarat',state:'VIC',postcode:''},facets:['LOCAL']});
 assert.equal(hierarchy.connected!.location.region?.key,'ballarat-local');assert.equal(hierarchy.connected!.location.candidates.length,0);
}));
