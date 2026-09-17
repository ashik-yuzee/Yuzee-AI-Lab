import {needScenarios} from '../src/routing/turnNeeds';
import assert from 'node:assert/strict';
import {AutoTokenizer,env} from '@huggingface/transformers';
import {checkEmbeddingInput} from '../src/routing/tokenBudget';
import {eligibleTools,indexText} from '../src/routing/policy';
env.cacheDir='./data/minilm-cache';
// Requires the locally cached model tokenizer; never downloads or calls Gemini.
const tokenizer=await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2',{local_files_only:true});
const atLimit=checkEmbeddingInput(tokenizer,'hello '.repeat(254));
assert.deepEqual(atLimit,{tokens:256,fits:true});
assert.deepEqual(checkEmbeddingInput(tokenizer,'hello '.repeat(255)),{tokens:257,fits:false});
const dense='?'.repeat(600);assert.ok(dense.length<1800);
assert.deepEqual(checkEmbeddingInput(tokenizer,dense),{tokens:602,fits:false});
assert.equal(tokenizer(dense,{truncation:true}).input_ids.dims.at(-1),512);
const over=eligibleTools.filter(t=>!checkEmbeddingInput(tokenizer,indexText(t)).fits);
assert.deepEqual(over,[]);
assert.deepEqual(needScenarios.filter(s=>!checkEmbeddingInput(tokenizer,s.text).fits),[]);
assert.throws(()=>checkEmbeddingInput(()=>({input_ids:{dims:[]}}),'hello'));
console.log('PASS: actual tokenizer 256/257 boundary, dense input, default 512 truncation, all '+eligibleTools.length+' descriptors and invalid count.');
