import 'dotenv/config';import fs from 'node:fs';import assert from 'node:assert/strict';
import {WarehouseService} from '../src/warehouse/service';import {ObjectiveService,callObjectiveModel} from '../src/objectives/service';
const root='output/rto-comparison';fs.mkdirSync(root,{recursive:true});const w=new WarehouseService();
const message='Compare Certificate II in Construction CPC20120 at Adelaide Training and Employment Centre Inc and Skill Hire WA Pty Ltd. Use Yuzee intelligence to explain what is shared, what differs in learning and delivery, and the trade-offs. Do not choose a winner.';
try{
 w.start();const started=Date.now();while(w.status().status==='PREPARING'&&Date.now()-started<150000)await new Promise(r=>setTimeout(r,200));assert.equal(w.status().status,'READY');
 const direct=await w.lookup(['CPC20120'],[],undefined,{comparison:true,provider_queries:['Adelaide Training and Employment Centre Inc','Skill Hire WA Pty Ltd'],facets:['PROVIDER','FUNDING']});
 fs.writeFileSync(root+'/source-comparison.json',JSON.stringify(direct,null,2));assert.equal(direct.status,'READY');assert.equal(direct.courses.length,2);assert.ok(direct.courses.every(c=>c.code==='CPC20120'));assert.match(direct.comparison!.baseline,/share CPC20120/);console.log('source comparison',direct.courses.map(c=>c.provider),direct.comparison?.qualifications[0].units.length,'national units');
 if(process.argv.includes('--live')){
  w.setPlanner(callObjectiveModel);const retrieved=await w.retrieve({message});fs.writeFileSync(root+'/live-retrieval.json',JSON.stringify(retrieved,null,2));assert.equal(retrieved.courses.length,2);assert.ok(retrieved.comparison);console.log('Gemini query plan: two requested provider offerings');
  const s=new ObjectiveService(root+'/workspaces',callObjectiveModel,w.retrieve.bind(w));const workspace=await s.start({id:'fictional-rto-comparison-'+Date.now(),messages:[{id:'u1',role:'user',content:message}]},{objectiveId:'STUDY_004'},new AbortController().signal);fs.writeFileSync(root+'/live-workspace.json',JSON.stringify(workspace,null,2));console.log('workspace',workspace.plan?.status,workspace.plan?.result.summary);assert.ok(workspace.plan);assert.equal(workspace.context.warehouse_data.courses.length,2);
 }
}finally{w.close();}
