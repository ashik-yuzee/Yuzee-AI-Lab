import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {GoogleGenAI} from '@google/genai';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import {readActivityContext} from '../src/objectives/activityContext';
dotenv.config({quiet:true});
const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const assembler=YuzeeRequestAssembler.getInstance();
const rows=JSON.parse(await fs.readFile('qa/objectives/routing-v3/cases.json','utf8')).filter(c=>['interests-new','careers-new','short-context','optout'].includes(c.id));
const results=[];
for(const c of rows){
 const r=assembler.assembleRequest({model:'gemini-3.7-flash',messageText:c.text,recentHistoryText:c.prior?`User: ${c.prior}`:'',useStructuredOutput:true,thinkingLevel:'low'});
 try{const raw=await ai.models.generateContent({model:r.model,contents:r.contents,config:r.geminiConfig});const parsed=JSON.parse(raw.text||'');const context=readActivityContext(parsed,[c.prior||'',c.text]);results.push({id:c.id,context,raw:parsed,usage:raw.usageMetadata,valid:!!context&&!!context.current_goal});console.log(c.id,JSON.stringify(context));}catch(e){results.push({id:c.id,error:String(e),valid:false});console.log(c.id,'failed');}
 await fs.writeFile('qa/objectives/routing-v3/live-context.json',JSON.stringify(results,null,2));
}
