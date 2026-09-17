import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleTools,microTools,indexText,scopedInstruction,acceptClientRoute,abstain,ROUTER_VERSION} from '../src/routing/policy';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import audit from '../docs/plans/microtool-individual-review.json';
const assembler=YuzeeRequestAssembler.getInstance();
assert.equal(audit.tools.length,103);
assert.deepEqual(audit.tools.map(t=>t.id).sort(),eligibleTools.map(t=>t.id).sort());
assert.equal(new Set(audit.tools.map(t=>t.decision_logic)).size,103);
assert.equal(new Set(audit.tools.map(t=>t.missing_data_logic)).size,103);
assert.equal(new Set(audit.tools.map(t=>t.teaching_example)).size,103);
const extracted=(value:unknown)=>JSON.stringify(value);
for(const tool of audit.tools){
 const runtime=eligibleTools.find(t=>t.id===tool.id)!;
 assert.equal(runtime.mini_prompt,tool.reviewed_prompt,tool.id+' runtime drift');
 assert.notEqual(runtime.mini_prompt,tool.previous_runtime_prompt,tool.id+' was not changed');
 const selection={status:'selected',modelId:'Xenova/bge-small-en-v1.5',calibrationVersion:'bge-calibrated-v1',routingFlow:'route',domainMargin:.2,toolId:tool.id,score:.7,margin:.2,reason:'clear-semantic-match',version:ROUTER_VERSION} as const;
 const accepted=acceptClientRoute(selection,'AUTO','@Oala Explain the details of this selected topic for my learning goal.');
 assert.equal(accepted.toolId,tool.id);
 const instruction=scopedInstruction(accepted);
 assert.equal((instruction.match(/INDIVIDUAL TASK LOGIC v4/g)||[]).length,1);
 assert.ok(instruction.includes(tool.decision_logic)&&instruction.includes(tool.missing_data_logic));
 assert.ok(instruction.includes('canonical response schema'));
 assert.ok(!indexText(runtime).includes('INDIVIDUAL TASK LOGIC'),tool.id+' long prompt leaked into MiniLM index');
 const request=assembler.assembleRequest({model:'gemini-3.7-flash',messageText:'@Oala Explain this selected topic.',useStructuredOutput:true,microToolInstruction:instruction});
 assert.ok(extracted(request).includes(tool.id),tool.id+' lost in request assembly');
 assert.ok(extracted(request).includes(tool.decision_logic),tool.id+' missing decision method in provider request');
 assert.equal((extracted(request).match(/INDIVIDUAL TASK LOGIC v4/g)||[]).length,1,tool.id+' duplicate task');
 // A supplied prompt in client metadata must never become provider instructions.
 const poisoned=acceptClientRoute({...selection,mini_prompt:'UNTRUSTED_REPLACE_MASTER'},'AUTO','@Oala Explain the details of this selected topic for my learning goal.');
 assert.ok(!scopedInstruction(poisoned).includes('UNTRUSTED_REPLACE_MASTER'));
 assert.equal(scopedInstruction(acceptClientRoute(selection,'AUTO','Explain the details of this selected topic for my learning goal.')),'');
 assert.equal(scopedInstruction(acceptClientRoute(selection,'AUTO','@Oala Stop the explanation now.')),'');
 assert.equal(scopedInstruction(acceptClientRoute(selection,'AUTO','@Oala Continue this answer please.',true)),'');
}
for(const id of ['CORE_001','CORE_002','NOT_A_TOOL']){
 assert.equal(scopedInstruction({status:'selected',modelId:'Xenova/bge-small-en-v1.5',calibrationVersion:'bge-calibrated-v1',routingFlow:'route',domainMargin:.2,toolId:id,score:.9,margin:.3,reason:'clear-semantic-match',version:ROUTER_VERSION}),'');
}
assert.equal(scopedInstruction(abstain('ambiguous')),'');
assert.equal(microTools.length,105);
const html=readFileSync('output/html/Yuzee-103-Tool-Logic-Review.html','utf8');
assert.equal((html.match(/<article id=/g)||[]).length,103);
for(const t of audit.tools)assert.ok(html.includes(`id="${t.id}"`));
assert.ok(html.includes('not a recorded AI answer'));
console.log('PASS: all 103 unique reviewed snippets assembled; prompt injection ignored; explicit invocation, stop, structured-answer and internal-tool boundaries preserved; all 103 review entries present. These are structural checks, not 103 model-quality certifications.');
