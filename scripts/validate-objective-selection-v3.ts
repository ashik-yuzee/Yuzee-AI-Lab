import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {ObjectiveService} from '../src/objectives/service';
import {workspaceDisposition} from '../src/objectives/workspacePolicy';
dotenv.config({quiet:true});
const root='qa/objectives/routing-v3';
const live=process.argv.includes('--live-context');
const rows=JSON.parse(await fs.readFile(root+(live?'/retrieval-live.json':'/retrieval.json'),'utf8')).results;
const service=new ObjectiveService(root+'/selector-runs'),results:any[]=[];
for(const c of rows){
 const response=c.response||{response_intent:'EXPLORE_OPTIONS',interaction:{kind:'question',question:'What would help you next?'},state:{activity_context:{current_goal:c.context,confirmed_facts:[],possible_need:c.context,missing_information:[],relevant_question:'',user_constraints:[]}},content_blocks:[{text:c.context}]};
 const conv={id:(live?'v3-live-':'v3-')+c.id,messages:[...(c.prior?[{id:'prev',role:'user',content:c.prior}]:[]),{id:'u',role:'user',content:c.text},{id:'a',role:'assistant',content:JSON.stringify(response)}]};
 const start=performance.now();
 try{const r=await service.select(conv,{sourceMessageId:'a',candidates:c.variants.combined},new AbortController().signal,()=>true);
 const proposed=r.decision==='SUGGEST'&&r.confidence==='HIGH'&&r.workspace_need==='REQUIRED'&&c.variants.combined.some(x=>x.id===r.objective_id&&x.score>=.7)&&workspaceDisposition(r,c.variants.combined,false,c.text)!=='NONE'?'AUTO_OPEN':r.disposition;
 results.push({id:c.id,expected:c.expected,result:r,proposedDisposition:proposed,correct:c.expected.length?c.expected.includes(r.objective_id):['NONE','CLARIFY'].includes(r.decision),ms:Math.round(performance.now()-start)});
 }catch(e){results.push({id:c.id,error:String(e)});}
 await fs.writeFile(root+(live?'/selector-live.json':'/selector.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
}
