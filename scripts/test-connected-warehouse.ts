/** Software integration smoke test. Reads approved records; never audits or updates the source. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {WarehouseService} from '../src/warehouse/service';
const service=new WarehouseService();
try {
 service.start();const start=Date.now();
 while(service.status().status==='PREPARING'&&Date.now()-start<45000)await new Promise(r=>setTimeout(r,200));
 assert.equal(service.status().status,'READY');
 const cases=[
  {name:'vocational-local',ids:['127754'],plan:{location:{name:'Ringwood',state:'VIC',postcode:''},facets:['CAREERS','PROVIDER','INDUSTRY','LOCAL','FUNDING']}},
  {name:'university',ids:['278064'],plan:{facets:['CAREERS','PROVIDER','INDUSTRY','FUNDING']}},
  {name:'career-only',ids:[],plan:{occupation_queries:['plumber'],location:{name:'Ringwood',state:'VIC',postcode:''},facets:['CAREERS','LOCAL','INDUSTRY']}},
  {name:'industry-only',ids:[],plan:{industry_queries:['construction'],facets:['INDUSTRY','CAREERS']}},
 ];
 const summary=[];
 for(const c of cases){const begin=Date.now(),pack=await service.lookup([],c.ids,undefined,c.plan);fs.writeFileSync(path.join('output/phase3',c.name+'.json'),JSON.stringify(pack,null,2));assert.equal(pack.status,'READY',c.name);summary.push({name:c.name,elapsedMs:Date.now()-begin,courses:pack.courses.length,careers:pack.connected?.careers.length,providers:pack.connected?.providers.length,industries:pack.connected?.industries.length,signals:pack.connected?.signals.length,area:pack.connected?.location.region});}
 fs.writeFileSync('output/phase3/retrieval-results.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{service.close();}
