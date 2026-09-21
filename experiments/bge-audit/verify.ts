import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir='output/bge-audit/';
const frozen=JSON.parse(await fs.readFile(dir+'frozen-v2.json','utf8'));
for(const [file,hash]of Object.entries(frozen.hashes))assert.equal(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),hash,'Frozen runtime changed: '+file);
const actual=JSON.parse(await fs.readFile(dir+'all-103-browser-cases.json','utf8'));
const before=JSON.parse(await fs.readFile('output/bge-v2/browser-results.json','utf8'))[0].skills;
assert.equal(actual.length,103);assert.equal(new Set(actual.map((r:any)=>r.expected)).size,103);
for(const row of actual){
 const previous=before.find((r:any)=>r.expected===row.expected);assert.ok(previous);
 assert.equal(row.decision.status,previous.decision.status);assert.equal(row.decision.toolId,previous.decision.toolId);assert.equal(row.decision.reason,previous.decision.reason);
 assert.equal(row.vector.length,384);assert.equal(row.top5.length,5);assert.equal(row.tokenCount,row.input.input_ids.data.length);
 assert.ok(row.vector.every(Number.isFinite));
}
const a=JSON.parse(await fs.readFile(dir+'analysis.json','utf8'));
assert.equal(a.disagreements.length,4);assert.equal(a.parity.queryTokenInputsIdentical,true);assert.equal(a.parity.prototypeTokenInputsIdentical,true);
assert.equal(a.summary.top1CorrectAbstained,43);
const labels=(await fs.readFile(dir+'blind-human-review.jsonl','utf8')).trim().split('\n').map(l=>JSON.parse(l));
assert.equal(labels.length,131);assert.ok(labels.every(r=>!r.independentlyReviewed&&r.finalLabels.length===0&&r.labelsA.length===0&&r.labelsB.length===0));
const result={frozenRuntimeFiles:Object.keys(frozen.hashes).length,browserCases:103,identicalV2Decisions:103,fourDisagreementsDocumented:true,blindedUnlabelledCases:131,candidateNotDeployed:true,checkedAt:new Date().toISOString()};
await fs.writeFile(dir+'verification.json',JSON.stringify(result,null,2));console.log(result);
