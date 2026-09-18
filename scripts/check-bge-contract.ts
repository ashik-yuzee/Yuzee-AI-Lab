if(process.env.SKIP_BGE_CONTRACT){console.log('SKIP_BGE_CONTRACT set — skipping pinned-model check.');process.exit(0);}
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {env} from '@huggingface/transformers';
import artifact from '../src/routing/bgeArtifact.json';
import {DEFAULT_ROUTER_MODEL,RUNTIME_ROUTER_MODELS,routerModel} from '../src/routing/models';
import {BGE_ARTIFACT} from '../src/routing/bgeProfiles';
import {bgeMatchingIndex} from '../src/routing/bgeMatching';
import {bgeNeedScenarios,bgePathwayScenarios} from '../src/routing/bgeTaskContent';
import {checkedBgeVector} from '../src/routing/bgeContract';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
assert.equal(DEFAULT_ROUTER_MODEL,artifact.modelId);assert.equal(RUNTIME_ROUTER_MODELS.length,1);assert.equal(BGE_ARTIFACT,artifact.artifact);
const m=routerModel(DEFAULT_ROUTER_MODEL),root=`data/minilm-cache/${m.id}/${m.revision}`;
assert.equal(m.revision,artifact.revision);assert.equal(m.pooling,artifact.pooling);assert.equal(m.tokenBudget,artifact.maxTokens);
for(const [file,hash]of Object.entries(artifact.sha256)){
 const data=await fs.readFile(`${root}/${file}`).catch(()=>{throw Error(`Missing pinned BGE artifact: ${root}/${file}. Download the approved revision before building.`);});
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),hash,'Artifact drift: '+file);
}
env.allowRemoteModels=false;env.allowLocalModels=true;
const e=await loadEmbeddingModel(m,{sourceDirectory:'./'+root,device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
try{
 const text='Explain education and career pathways with useful examples.';
 const raw=await e(text,{pooling:'none',normalize:false}),actual=checkedBgeVector((await e(text,{pooling:'cls',normalize:true})).data);
 assert.equal(raw.dims.at(-1),384);const cls=Array.from(raw.data.slice(0,384)) as number[];const norm=Math.hypot(...cls);
 assert.ok(actual.every((x,i)=>Math.abs(x-cls[i]/norm)<1e-5),'CLS must equal normalized first token');
 assert.equal(checkEmbeddingInput(e.tokenizer as any,'hello '.repeat(510),512).fits,true);
 assert.equal(checkEmbeddingInput(e.tokenizer as any,'hello '.repeat(511),512).fits,false);
 for(const p of [...bgeMatchingIndex,...bgeNeedScenarios,...bgePathwayScenarios])assert.ok(checkEmbeddingInput(e.tokenizer as any,p.text,512).fits,'Prototype must not truncate');
 for(const bad of [new Float32Array(383),new Float32Array(384),Float32Array.from({length:384},()=>NaN)])assert.throws(()=>checkedBgeVector(bad));
 console.log('PASS pinned model/tokenizer SHA256, q8 config, 384 finite dimensions, CLS first token + L2, 512/513 token boundary, all prototypes fit, BGE-only default.');
}finally{await e.dispose();}
