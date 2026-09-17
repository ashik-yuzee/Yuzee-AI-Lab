import assert from 'node:assert/strict';
import {eligibleTools,chooseRoute,acceptClientRoute,scopedInstruction,validateRouteSelection} from '../src/routing/policy';
import {selectSkillOffers,acceptTopicRoute,canReviewResponseSkills,acceptSkillChoice,skillMessage} from '../src/routing/skillSuggestions';
import content from '../src/routing/bgeSkillContent.json';
import profile from '../src/routing/bgeCalibration.json';
import {BGE_MODEL_ID,bgeMatchingIndex,rankBge} from '../src/routing/bgeMatching';
import {BGE_OUT_OF_SCOPE} from '../src/routing/bgeDomain';
assert.deepEqual(content.map(t=>t.id).sort(),eligibleTools.map(t=>t.id).sort());
assert.equal(content.length,103);
assert.ok(bgeMatchingIndex.length>206);
const ranks=[{toolId:'COURSE_011',score:.78},{toolId:'COURSE_012',score:.735},{toolId:'CORE_010',score:.69},{toolId:BGE_OUT_OF_SCOPE,score:.3}];
const d=chooseRoute(ranks,BGE_MODEL_ID);
assert.equal(d.status,'selected');
assert.equal(chooseRoute(ranks).status,'abstained');
assert.equal(d.calibrationVersion,profile.version);
assert.equal(acceptClientRoute(d,'AUTO','@Oala Explain tuition costs for this degree').toolId,'COURSE_011');
for(const patch of [{modelId:'unknown'},{calibrationVersion:'old'},{domainMargin:undefined},{domainMargin:NaN},{domainMargin:.01},{routingFlow:'suggestion'},{score:.60},{toolId:'CORE_001'}]){
 assert.equal(acceptClientRoute({...d,...patch},'AUTO','@Oala Explain tuition costs for this degree').status,'abstained');
}
assert.equal(chooseRoute(ranks.filter(r=>r.toolId!==BGE_OUT_OF_SCOPE),BGE_MODEL_ID).status,'abstained');
assert.equal(chooseRoute([...ranks.slice(0,3),{toolId:BGE_OUT_OF_SCOPE,score:.8}],BGE_MODEL_ID).reason,'outside-scope');
assert.equal(chooseRoute([...ranks.slice(0,3),{toolId:BGE_OUT_OF_SCOPE,score:NaN}],BGE_MODEL_ID).status,'abstained');
assert.equal(selectSkillOffers([ranks],BGE_MODEL_ID).offers.length,0); // .045 gap fits routing, not suggestion .05 gate.
const offerRanks=[{toolId:'COURSE_011',score:.8},{toolId:'COURSE_012',score:.7},{toolId:BGE_OUT_OF_SCOPE,score:.4}];
assert.equal(selectSkillOffers([offerRanks],BGE_MODEL_ID).offers[0].toolId,'COURSE_011');
const topic=chooseRoute(ranks,BGE_MODEL_ID,'topic');
assert.equal(validateRouteSelection(topic).status,'abstained');
const menu={kind:'question',input_type:'single_select',question:'What would you like to explore next?',options:[{id:'fees',label:'Study costs'}]};
assert.equal(acceptTopicRoute(topic,menu,{interaction:{selected_option_ids:['fees']}}).toolId,'COURSE_011');
const output={interaction:{kind:'question'},content_blocks:[{text:'Tuition fees explained.'}]};
assert.equal(canReviewResponseSkills(output,'Tell me about fees'),false);
assert.equal(canReviewResponseSkills({...output,interaction:{kind:'none'}},'Tell me about fees'),true);
const accepted=acceptSkillChoice({toolId:'COURSE_011',sourceMessageId:'answer'},[{id:'answer',role:'assistant'}],skillMessage('COURSE_011'));
assert.equal(accepted.status,'selected');
assert.match(scopedInstruction(accepted),/COURSE|cost|tuition/i);
assert.match(scopedInstruction(accepted),/INPUT|input|missing/i);
assert.equal(acceptSkillChoice({toolId:'COURSE_011',sourceMessageId:'old'},[{id:'answer',role:'assistant'}],skillMessage('COURSE_011')).status,'abstained');
assert.throws(()=>rankBge(new Float32Array([1]),[]));
console.log('PASS 103 content entries, BGE model/profile/flow/domain validation, separate suggestion gate, Gemini question suppression, existing skill prompt and stale-offer checks.');
