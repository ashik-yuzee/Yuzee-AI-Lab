import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {WarehouseService} from '../src/warehouse/service';import {normalizeCourse} from '../src/warehouse/normalize';import {buildComparison} from '../src/warehouse/comparison';import {warehouseEvidence} from '../src/warehouse/types';import {ProviderComparison} from '../src/warehouse/ProviderComparison';
const course=(id:number,provider:string,fee:any=null)=>normalizeCourse({id,institution_id:id,institution_name:provider,course_name:'Certificate II in Construction',national_code:'CPC20120',domestic_fee:fee,duration_text:'12 months',intelligence_json:JSON.stringify({trust_and_quality:{work_readiness_score:70,scoring_reason:'Foundational progression course.'},learning_content:{core_skills:['Use tools safely']},yuzee_outcome_layer:{best_suited_for:['Exploring construction'],honest_weakness:'Further study for qualified trade work.'}})});
test('shared qualifications and identical analysis are not fabricated provider advantages',()=>{
 const c=buildComparison([course(1,'Sample A',0),course(2,'Sample B')]);
 assert.match(c.baseline,/share CPC20120/);assert.equal(c.rows.find(r=>r.key==='duration')?.status,'SHARED');assert.equal(c.rows.find(r=>r.key==='strengths')?.status,'SHARED');assert.equal(c.rows.find(r=>r.key==='cost')?.status,'INCOMPLETE');assert.deepEqual(c.rows.find(r=>r.key==='cost')?.values,[['Domestic: 0'],[]]);
 const html=renderToStaticMarkup(<ProviderComparison data={c}/>);assert.match(html,/What the records have in common/);assert.match(html,/Not supplied/);assert.doesNotMatch(html,/DIFFERENT_RECORDS|YUZEE_ANALYSIS|winner|70\/100/);
 assert.match(buildComparison([course(1,'A'),{...course(2,'B'),code:'CPC30220',level:'3'}]).baseline,/not all the same qualification/);
 assert.equal(course(1,'A').quality[0].value,70);assert.equal(course(1,'A').qualityExplanation,'Foundational progression course.');
});
test('provider-scoped lookup keeps requested RTOs, common units, missing offers and evidence separate',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rto-comparison-')),source=path.join(root,'source.sqlite'),index=path.join(root,'index.sqlite');
 const fields=fs.readFileSync('src/warehouse/catalogue-worker.cjs','utf8').match(/const fields=`([^`]+)`/)![1].split(',');const db=new DatabaseSync(source);
 db.exec('CREATE TABLE live_courses('+fields.map(k=>k==='id'?'id INTEGER PRIMARY KEY':k==='institution_id'?'institution_id INTEGER':k+' TEXT').join(',')+'); CREATE TABLE live_institutions(id INTEGER PRIMARY KEY,legal_name TEXT,rto_code TEXT,has_student_support INTEGER,private_contact TEXT); CREATE TABLE qualification_units(qualification_code TEXT,unit_code TEXT,unit_title TEXT,unit_type TEXT)');
 db.exec("INSERT INTO live_institutions VALUES(1,'Sample College A','101',1,'SECRET'),(2,'Sample College B','102',0,'SECRET'),(3,'Other Provider','103',1,'SECRET'),(4,'Sample College A','104',1,'SECRET'); INSERT INTO qualification_units VALUES('CPC20120','U1','Safe tools','CORE'),('CPC20120','U2','Optional concreting','ELECTIVE')");
 for(const col of ['rto_type','higher_education_code','city','state','website_url','has_disability_support','has_library','has_apprenticeships'])db.exec('ALTER TABLE live_institutions ADD COLUMN '+col+' TEXT');
 const put=db.prepare('INSERT INTO live_courses(id,institution_id,institution_name,course_name,national_code,intelligence_json) VALUES(?,?,?,?,?,?)');
 put.run(1,1,'Sample College A','Certificate II in Construction','CPC20120','{}');put.run(2,2,'Sample College B','Certificate II in Construction','CPC20120','{}');put.run(3,3,'Other Provider','Certificate II in Construction','CPC20120','{}');put.run(4,1,'Sample College A','Certificate II in Construction','CPC20120','{}');db.close();const before=fs.readFileSync(source);
 const w=new WarehouseService({source,index});
 try{
  w.start();while(w.status().status==='PREPARING')await new Promise(r=>setTimeout(r,10));assert.equal(w.status().status,'READY');
  const plan={comparison:true,provider_queries:['Sample College A','Sample College B'],facets:[]};const p=await w.lookup(['CPC20120'],[],undefined,plan);
  assert.equal(p.status,'READY');assert.deepEqual(p.courses.map(c=>c.id),['1','2'],JSON.stringify(p.comparison));assert.equal(p.comparison?.qualifications[0].units[1].type,'ELECTIVE');assert.doesNotMatch(JSON.stringify(p),/SECRET|Other Provider/);assert.match(p.comparison!.baseline,/share CPC20120/);
  assert.ok(warehouseEvidence(p).some(e=>e.id==='warehouse_qualification_CPC20120'));assert.ok(warehouseEvidence(p).some(e=>e.id==='warehouse_rto_1'));
  const institutions=await w.lookup([],[],undefined,{...plan,provider_queries:['101','Sample College B']});assert.equal(institutions.courses.length,0);assert.equal(institutions.comparison?.options.length,2);
  const noOffer=await w.lookup(['CPC30220'],[],undefined,{...plan,provider_queries:['101','Sample College B']});assert.equal(noOffer.courses.length,0);assert.equal(noOffer.comparison?.notes?.length,2);
  const ambiguous=await w.lookup(['CPC20120'],[],undefined,{comparison:true,provider_queries:['Sample College']});assert.equal(ambiguous.comparison?.providerMatches[0].status,'AMBIGUOUS');assert.equal(ambiguous.courses.length,0);
  const missing=await w.lookup(['CPC20120'],[],undefined,{comparison:true,provider_queries:['Not A Provider']});assert.equal(missing.status,'NO_MATCH');assert.equal(missing.courses.length,0);
  w.setPlanner(async()=>({output_text:JSON.stringify({action:'COURSES',queries:['construction'],comparison:true,provider_queries:['101'],reuse_selected:true})}));
  const focused=await w.retrieve({message:'Focus on my selected course',selectedCourseIds:['1']});assert.deepEqual(focused.courses.map(c=>c.id),['1']);assert.equal(focused.comparison,undefined);
  assert.deepEqual(fs.readFileSync(source),before);
 }finally{w.close();fs.rmSync(root,{recursive:true,force:true});}
});
