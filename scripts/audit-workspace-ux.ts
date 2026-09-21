import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {ObjectiveService} from '../src/objectives/service';
dotenv.config({quiet:true});
const root='output/ux-audit';
const service=new ObjectiveService(root+'/routing-runs');
const routes=JSON.parse(await fs.readFile(root+'/routing-auto.json','utf8'));
const results=[];
for(const route of routes.results){
 const r=JSON.parse(await fs.readFile(root+'/live/'+route.id+'.json','utf8'));
 const messages=[{id:'u',role:'user',content:r.message},{id:'a',role:'assistant',content:JSON.stringify(r.response),structuredResponse:r.response}];
 const row:any={id:route.id,objectiveId:route.selection.objective_id,started:new Date().toISOString()};
 const start=Date.now();
 try{row.session=await service.start({id:'ux-audit-'+route.id,messages},{objectiveId:route.selection.objective_id,activation:'automatic',sourceMessageId:'a',selectionId:route.selection.selectionId},new AbortController().signal);}catch(e:any){row.error=e.message;}
 row.totalMs=Date.now()-start;results.push(row);
 await fs.writeFile(root+'/workspace-execution.json',JSON.stringify({scope:'Two synthetic, explicitly requested workspace starts through the real service and validators; no browser interaction or external actions.',results},null,2));
 console.log(row.id,row.session?.state||row.error,row.totalMs+'ms');
}
