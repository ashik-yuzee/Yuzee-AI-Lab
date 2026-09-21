import 'dotenv/config';import fs from 'node:fs';import assert from 'node:assert/strict';
import {WarehouseService} from '../src/warehouse/service';import {ObjectiveService,callObjectiveModel} from '../src/objectives/service';
const root='output/skills-exploration',w=new WarehouseService(),plans:any[]=[];
w.setPlanner(async(req,signal)=>{const raw=await callObjectiveModel(req,signal);plans.push({input:JSON.parse(req.input),raw});return raw;});
try{
 w.start();while(w.status().status==='PREPARING')await new Promise(r=>setTimeout(r,250));assert.equal(w.status().status,'READY');
 const cases=[{id:'skills-local',message:'I have worked in retail and helped customers solve problems. I live in Ringwood, VIC. Show me jobs that use these skills and what skills I could learn next, using local job information.'},{id:'typo-followup',message:'wot about trouble shooting and computer suport round ringwood vic',context:'The user is exploring a change from retail into IT support, not pursuing plumbing.'},{id:'no-search',message:"Don't look up jobs, I only want to reflect on how work feels."}];
 for(const c of cases){const p=await w.retrieve(c);fs.writeFileSync(`${root}/live-${c.id}.json`,JSON.stringify(p,null,2));console.log(c.id,p.status,p.connected?.exploration?.roles.map(r=>r.title),p.connected?.exploration?.jobs.length);if(c.id!=='no-search')assert.equal(p.status,'READY');else assert.equal(p.status,'NOT_NEEDED');}
 fs.writeFileSync(`${root}/planner-traces.json`,JSON.stringify(plans,null,2));
 const svc=new ObjectiveService(root+'/live-workspaces',callObjectiveModel,w.retrieve.bind(w));
 const conv={id:'fictional-skills-live-'+Date.now(),messages:[{id:'u1',role:'user',content:cases[0].message}]};
 const session=await svc.start(conv,{objectiveId:'JOB_DISCOVER_002'},new AbortController().signal);fs.writeFileSync(`${root}/live-workspace.json`,JSON.stringify(session,null,2));console.log('workspace',session.state,'roles',session.context.warehouse_data.connected?.exploration?.roles.length);
}catch(e:any){console.error(e.message);process.exitCode=1;}finally{fs.writeFileSync(`${root}/planner-traces.json`,JSON.stringify(plans,null,2));w.close();}
