import fs from 'node:fs';import assert from 'node:assert/strict';
import {WarehouseService} from '../src/warehouse/service';
const service=new WarehouseService();
try{
 service.start();const start=Date.now();while(service.status().status==='PREPARING'&&Date.now()-start<120000)await new Promise(r=>setTimeout(r,250));assert.equal(service.status().status,'READY');
 const cases=[
  {name:'customer-skills',plan:{skill_queries:['service orientation','active listening'],job_queries:['customer service'],location:{name:'Ringwood',state:'VIC',postcode:''},facets:['SKILLS','CAREERS','LOCAL','JOBS']}},
  {name:'technical-learning',plan:{skill_queries:['install pipes'],occupation_queries:['plumber'],job_queries:['plumber'],location:{name:'Ringwood',state:'VIC',postcode:''},facets:['SKILLS','LEARNING','CAREERS','LOCAL','JOBS']}},
  {name:'it-support',plan:{occupation_queries:['computer user support'],skill_queries:['troubleshooting'],job_queries:['desktop support'],location:{name:'Melbourne',state:'VIC',postcode:''},facets:['SKILLS','JOBS','LEARNING','LOCAL']}},
 ];
 const summary=[];
 for(const c of cases){const t=Date.now(),p=await service.lookup([],[],undefined,c.plan);fs.writeFileSync('output/skills-exploration/'+c.name+'.json',JSON.stringify(p,null,2));assert.equal(p.status,'READY',c.name);summary.push({case:c.name,ms:Date.now()-t,roles:p.connected?.exploration?.roles.map(r=>r.title),skills:p.connected?.exploration?.skills.length,jobs:p.connected?.exploration?.jobs.length,area:p.connected?.exploration?.geography,learning:p.connected?.exploration?.learning.length,signals:p.connected?.signals.length});}
 fs.writeFileSync('output/skills-exploration/source-smoke.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{service.close();}
