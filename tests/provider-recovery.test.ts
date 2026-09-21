import assert from 'node:assert/strict';
import {openProviderStream} from '../src/services/ProviderRecovery';
const signal=new AbortController().signal,wait=async()=>{};
let calls=0,retries=0;
assert.equal(await openProviderStream(async()=>{if(++calls===1)throw {status:503};return 'stream';},signal,()=>retries++,wait),'stream');assert.equal(calls,2);assert.equal(retries,1);
for(const status of [400,401,403]){calls=0;await assert.rejects(openProviderStream(async()=>{calls++;throw {status};},signal,()=>{},wait));assert.equal(calls,1);}
calls=0;await assert.rejects(openProviderStream(async()=>{calls++;throw {status:503};},signal,()=>{},wait));assert.equal(calls,2);
calls=0;await assert.rejects(openProviderStream(async()=>{calls++;throw {status:429,message:'daily quota exceeded'};},signal,()=>{},wait));assert.equal(calls,1);
const c=new AbortController();calls=0;await assert.rejects(openProviderStream(async()=>{calls++;throw {status:503};},c.signal,()=>c.abort(),wait));assert.equal(calls,1);
console.log('PASS: transient recovery once, permanent and daily quota errors not retried, cancellation stops retry.');
