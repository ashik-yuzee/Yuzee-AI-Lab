import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createRequire} from 'node:module';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {SkillsExplorer} from '../src/warehouse/SkillsExplorer';import {explorationChoice} from '../src/warehouse/choices';import {warehouseEvidence} from '../src/warehouse/types';
import {needsWarehouse} from '../src/warehouse/service';
const require=createRequire(import.meta.url);const {buildOpportunityIndex,createOpportunityReader}=require('../src/warehouse/opportunities.cjs');
function fixture(run:(reader:any)=>void){const source=new DatabaseSync(':memory:'),index=new DatabaseSync(':memory:');try{
 source.exec(`CREATE TABLE onet_occupation(job_id,job_title,description,tasks);INSERT INTO onet_occupation VALUES('customer','Customer Service Representative','Help customers resolve problems.','["Explain options"]'),('engineer','Electrical Engineer','Design circuits.','[]'),('unrelated','Food worker','Process food.','[]');
 CREATE TABLE onet_job_skill(job_id,skill_name,skill_desc);INSERT INTO onet_job_skill VALUES('customer','Active Listening','Understand what someone says.'),('customer','Service Orientation','Help people.'),('engineer','Troubleshooting','Diagnose issues.'),('unrelated','Active Listening','Listen.'),('unrelated','Service Orientation','Help.');
 CREATE TABLE onet_anzsco_crosswalk(job_id,anzsco_code,anzsco_title,method,confidence);INSERT INTO onet_anzsco_crosswalk VALUES('customer','5411','Call Centre Workers','stored_mapping',.7);
 CREATE TABLE course_skill_edge(national_code,skill_name,skill_type,method);INSERT INTO course_skill_edge VALUES('SAMPLE001','Apply active listening','CORE_UNIT','unit_link');
 CREATE TABLE dim_location_asgs(postcode,state_code,sa4_code);INSERT INTO dim_location_asgs VALUES('3134','VIC','207'),('3135','VIC','207');
 CREATE TABLE outside_jobs(id INTEGER,title,company_name,city,state,country,postal_code,skills_json,requirements_json,description,employment_type,work_mode,salary_text,posted_at,updated_at,expired_at,job_url,source,status,privacy_level,private_contact);`);
 const insert=source.prepare('INSERT INTO outside_jobs VALUES('+Array(21).fill('?').join(',')+')');
 for(const [id,city,postal,privacy,status,expires,country] of [[1,'Ringwood','3134','PUBLIC','active',null,'AU'],[2,'Springwood','3134','PUBLIC','active',null,'AU'],[3,'Ringwood','3134','PRIVATE','active',null,'AU'],[4,'Ringwood','3134','PUBLIC','draft',null,'AU'],[5,'Ringwood','3134','PUBLIC','active','2020-01-01','AU'],[6,'Ringwood','3134','PUBLIC','active',null,'US'],[7,'Croydon','3135','PUBLIC','active',null,'AU']] as any[])insert.run(id,'Customer service assistant','Sample Co',city,'VIC',country,postal,id===1?'["Active Listening"]':'[]','[]','Help customers; ignored private fields elsewhere.','part time',null,null,'2026-01-01','2026-01-02',expires,id===1?'javascript:alert(1)':'https://example.test/job','Stored',''+status,privacy,'PRIVATE_SECRET');
 index.exec('CREATE VIRTUAL TABLE catalogue USING fts5(course_id UNINDEXED,course_name,institution_name,national_code,course_code);INSERT INTO catalogue VALUES(\'1\',\'Sample course\',\'Sample TAFE\',\'SAMPLE001\',\'\')');
 buildOpportunityIndex(source,index);run(createOpportunityReader(source,index));
 }finally{source.close();index.close();}}
const location={requested:'Ringwood, VIC',region:{name:'Ringwood',key:'ring',tier:'SA2',state:'VIC'},chain:[{tier:'SA4',region_key:'207',name:'Outer East'}]};
const plan={skill_queries:['active listening','service orientation'],job_queries:['customer service'],location:{name:'Ringwood',state:'VIC',postcode:''},facets:['SKILLS','JOBS','LEARNING']};
test('public job projections exclude private, draft, expired, overseas and substring suburb matches',()=>fixture(reader=>{
 const e=reader.read(plan,location);assert.deepEqual(e.jobs.map((j:any)=>j.id),['1']);assert.equal(e.jobs[0].url,null);assert.equal(e.jobs[0].availability,'NOT_CONFIRMED_CURRENT');assert.doesNotMatch(JSON.stringify(e),/PRIVATE_SECRET|private_contact/);assert.equal(e.coverage.sampleSize,1);assert.equal(e.observedSkills[0].count,1);assert.equal(e.observedSkills[0].denominator,1);assert.equal(e.coverage.localSkillDemand,'NOT_ESTABLISHED');
}));
test('named careers are not polluted by unrelated matches to generic skills',()=>fixture(reader=>{
 const e=reader.read({...plan,occupation_queries:['electrical engineer'],skill_queries:['active listening'],facets:['SKILLS']},location);assert.deepEqual(e.roles.map((r:any)=>r.title),['Electrical Engineer']);
 const broad=reader.read(plan,location);assert.deepEqual(broad.roles.map((r:any)=>r.title),['Customer Service Representative']);assert.ok(broad.learning.length);assert.equal(broad.learning[0].courses[0].id,'1');
}));
test('ambiguous area produces no job search; wider fallback has explicit geography and date',()=>fixture(reader=>{
 const amb=reader.read(plan,{requested:'Richmond',region:null,chain:[]});assert.equal(amb.jobs.length,0);
 const wide=reader.read({...plan,location:{name:'Other suburb',state:'VIC',postcode:''}},location);assert.equal(wide.geography.scope,'SA4');assert.equal(wide.geography.localMatch,false);assert.ok(wide.jobs.every((j:any)=>j.postedAt==='2026-01-01'));assert.equal(wide.coverage.sampleSize,3);
}));
test('skills and learning carry evidence and UI exposes controls without fabricated suitability scores',()=>fixture(reader=>{
 const e=reader.read(plan,location),pack:any={courses:[],connected:{exploration:e}};
 const evidence=warehouseEvidence(pack);for(const item of [...e.roles,...e.learning,...e.jobs,...e.observedSkills])assert.ok(evidence.some(r=>r.id===item.evidenceId));
 const html=renderToStaticMarkup(<SkillsExplorer data={e} onSave={()=>{}} onCourse={()=>{}}/>);for(const phrase of ['Save my choices','I&#x27;ve used this','I want to learn','Not answered','Sample course','2026-01-01','not a local demand ranking'])assert.ok(html.includes(phrase),phrase);assert.doesNotMatch(html,/suitability score|NOT_CONFIRMED_CURRENT|PRIVATE_SECRET/);
}));
test('only displayed skills/roles can be saved; missing and unsure do not become deficiencies',()=>fixture(reader=>{
 const e=reader.read(plan,location),pack:any={connected:{exploration:e}};
 const selected=explorationChoice(pack,{roleIds:[e.roles[0].id],skills:[{id:e.skills[0].id,state:'LEARN',name:'spoofed'}]});assert.notEqual(selected.choice.skills[0].name,'spoofed');assert.match(selected.text,/Unmarked skills remain unknown/);assert.match(selected.text,/not verified competence/);
 assert.throws(()=>explorationChoice(pack,{roleIds:['invented'],skills:[]}));assert.throws(()=>explorationChoice(pack,{roleIds:[],skills:[{id:e.skills[0].id,state:'VERIFIED'}]}));assert.throws(()=>explorationChoice(pack,{roleIds:[],skills:[{id:'made-up',state:'HAVE'}]}));
}));
test('skills intent works for statements, misspellings stay available to the model planner, opt-out is respected',()=>{
 assert.equal(needsWarehouse('I have customer service skills and want to know where else I could work'),true);assert.equal(needsWarehouse('wot jobs can i do round ringwod'),true);assert.equal(needsWarehouse('wot about trouble shooting and computer suport round ringwood vic'),true);assert.equal(needsWarehouse('Thanks'),false);assert.equal(needsWarehouse("Don't fetch jobs; just listen"),false);
});
