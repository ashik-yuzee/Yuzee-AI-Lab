import assert from 'node:assert/strict';
import {runReview,ReviewFailure,reviewFailureCode,reviewFailureMessage} from '../src/services/ReviewRetry';
const signal=new AbortController().signal, noWait=async()=>{};
let calls=0;
const recovered=await runReview(async()=>{if(++calls===1)throw Object.assign(new Error('upstream'),{status:503});return 'reviewed';},signal,noWait);
assert.equal(recovered.value,'reviewed');assert.deepEqual(recovered.audit,{attempts:2,failures:['PROVIDER']});
assert.equal(reviewFailureCode(Object.assign(new Error(),{name:'AbortError'}),signal),'TIMEOUT');
for(const code of [400,401,403]){let n=0;await assert.rejects(runReview(async()=>{n++;throw Object.assign(new Error('private payload must not be logged'),{status:code});},signal,noWait),e=>e instanceof ReviewFailure&&e.audit.failures[0]==='CONFIGURATION'&&!e.message.includes('private'));assert.equal(n,1);}
let n=0;await assert.rejects(runReview(async()=>{n++;throw new SyntaxError('bad json');},signal,noWait),e=>e instanceof ReviewFailure&&e.audit.attempts===2);assert.equal(n,2);
const controller=new AbortController();controller.abort();await assert.rejects(runReview(async()=>{throw Error('must not call');},controller.signal,noWait),e=>e instanceof ReviewFailure&&e.audit.attempts===0&&e.audit.failures[0]==='CANCELLED');
console.log('PASS: retry transient failures once, bound invalid responses, skip configuration retries, preserve cancellation, and omit sensitive error text.');

assert.match(reviewFailureMessage('PROVIDER'),/Gemini is temporarily unavailable/);
assert.match(reviewFailureMessage('TIMEOUT'),/took too long/);
assert.ok(!reviewFailureMessage('secret provider payload').includes('secret'));
