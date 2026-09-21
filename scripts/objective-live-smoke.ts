import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {ObjectiveService} from '../src/objectives/service';
dotenv.config({quiet:true});
const root=process.argv[2]||'qa/objectives/integration/live-'+new Date().toISOString().replace(/[:.]/g,'-');
console.log('Results: '+root);
const service=new ObjectiveService(root);
const scenarios=[
{id:'STUDY_005',goal:'I have a sample course syllabus: Introduction to Programming teaches variables, loops and debugging; Databases covers tables, keys and SQL; Web Projects combines HTML, CSS and JavaScript. Explain what I would actually practise and how these units build on one another. I have never coded. These are hypothetical course units, not verified provider data.'},
{id:'EMP_SAFE_001',goal:'I received a hypothetical job offer by text. They want a payment for equipment before interview and ask for my banking password. I have no verified company details. Help me understand what to check. Do not label the company verified or invent a lookup.'},
{id:'PROFILE_005',goal:'I want to check the skills I have told you about: I use Excel filters at work but I have never used pivot tables or SQL. Keep those separate, and do not infer that I am a data analyst.'},
];
const results=[];
for(const t of scenarios){const conv={id:'live-preview-'+t.id,messages:[{id:'u',role:'user',content:t.goal}]};const start=Date.now();try{const s=await service.start(conv,{objectiveId:t.id},new AbortController().signal);results.push({id:t.id,status:s.plan.status,question:s.plan.ui.find(c=>c.required)?.prompt,summary:s.plan.result.summary,sessionId:s.id,ms:Date.now()-start});}catch(e){results.push({id:t.id,error:String(e),ms:Date.now()-start});}console.log(JSON.stringify(results.at(-1)));}
await fs.mkdir(root,{recursive:true});await fs.writeFile(root+'/summary.json',JSON.stringify(results,null,2));
