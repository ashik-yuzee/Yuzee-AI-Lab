import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pipeline,env} from '@huggingface/transformers';
import {pathwayScenarios,choosePathwayHint,pathwayQuery} from '../src/miniPathway/policy';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
env.cacheDir='./data/minilm-cache';env.allowRemoteModels=false;
const embed=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8',device:'cpu',local_files_only:true});
assert.ok(pathwayScenarios.every(s=>checkEmbeddingInput(embed.tokenizer as any,s.text).fits));
const vectors=await embed(pathwayScenarios.map(s=>s.text),{pooling:'mean',normalize:true});const dim=vectors.dims.at(-1)!;
const cases:[string,boolean][]=[
 ['I am unsure which career to choose. Help me compare possible pathways.',true],
 ['I work in retail and want to change careers into IT. How can I get there?',true],
 ['How do I become a nurse? I want to understand my study and work options.',true],
 ['I know I want to work in software engineering. Map the stages from beginner to my first job.',true],
 ['I have decided on IT support rather than design. I enjoy diagnosing technical problems and explaining fixes to people. I have compared the day-to-day work and am confident in this choice. Please outline the next stages towards my first IT support job, keeping the plan flexible.',true],
 ['What does an elective mean? Explain it with a simple example.',false],
 ['What are the tuition fees for the Bachelor of Nursing at Deakin?',false],
 ['Explain how HECS repayments are calculated.',false],
 ['What does Yuzee offer?',false],
 ['Thank you, that helps.',false],
 ['What is the weather today?',false],
];
const results=[];
for(const [text,expected]of cases){
 const query=pathwayQuery({},text);assert.ok(checkEmbeddingInput(embed.tokenizer as any,query).fits);
 const q=(await embed(query,{pooling:'mean',normalize:true})).data as Float32Array;
 const ranking=pathwayScenarios.map((s,i)=>({id:s.id,score:(vectors.data as Float32Array).slice(i*dim,(i+1)*dim).reduce((sum,n,j)=>sum+n*q[j],0)}));
 const hint=choosePathwayHint(ranking);results.push({text,expected,hint,pass:(hint.status==='selected')===expected});
}
fs.mkdirSync('tmp/mini-pathway',{recursive:true});fs.writeFileSync('tmp/mini-pathway/semantic-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));assert.ok(results.every(r=>r.pass));
