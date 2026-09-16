import assert from 'node:assert/strict';
import {makeResponse} from '../src/ux/fixtures';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {learningContracts,learningProfiles,learningDepthInstruction} from '../src/routing/learningDepth';
import {microTools,eligibleTools,scopedInstruction,ROUTER_VERSION} from '../src/routing/policy';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
import {ProtocolV13Renderer} from '../src/components/ProtocolV13Renderer';
assert.equal(learningContracts.length,105);
assert.deepEqual(learningContracts.map(c=>c.id).sort(),microTools.map(t=>t.id).sort());
for(const c of learningContracts){
 assert.ok(c.profile in learningProfiles,c.id+' profile missing');
 assert.ok(c.information&&c.required_inputs&&c.evidence,c.id+' contract incomplete');
 if(['CORE_001','CORE_002'].includes(c.id)){assert.equal(learningDepthInstruction(c.id),'');continue;}
 assert.ok(learningProfiles[c.profile as keyof typeof learningProfiles].length>=5,c.id);
 const instruction=scopedInstruction({status:'selected',toolId:c.id,score:.7,margin:.2,reason:'clear-semantic-match',version:ROUTER_VERSION});
 assert.ok(instruction.includes(c.information),c.id+' missing task-specific coverage');
 assert.ok(instruction.includes('LEARNING DEPTH CONTRACT'),c.id+' missing depth guidance');
}
assert.equal(learningDepthInstruction('untrusted'), '');
assert.equal(learningProfiles.skill.length,8);
assert.notDeepEqual(learningProfiles.skill,learningProfiles.cost);
assert.notDeepEqual(learningProfiles.market,learningProfiles.role);
const assembler=YuzeeRequestAssembler.getInstance();
const request=assembler.assembleRequest({model:'gemini-3.7-flash',messageText:'Explain communication skills',useStructuredOutput:true});
assert.ok(request.systemInstruction.includes('STRUCTURED_TEACHING_CONTRACT'));
assert.ok(request.systemInstruction.includes('even if MiniLM is cold'));
assert.equal((request.systemInstruction.match(/<STRUCTURED_TEACHING_CONTRACT /g)||[]).length,1);
const prior=makeResponse();
const long=structuredClone(prior);long.content_blocks=learningProfiles.skill.map(([title,body],i)=>({...prior.content_blocks.find((b:any)=>b.type==='text'),id:'depth-'+i,type:'text',title,text:body}));long.interaction={...long.interaction,kind:'none'};
const markup=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:long,readOnly:true}));
assert.match(markup,/aria-label="In this answer"/);
for(const [title,body] of learningProfiles.skill){assert.ok(markup.includes(title));assert.ok(markup.includes(body.replace(/&/g,'&amp;')));}
const ids=[...markup.matchAll(/id="([^"]+-section-\d+)"/g)].map(m=>m[1]);
const hrefs=[...markup.matchAll(/href="#([^"]+-section-\d+)"/g)].map(m=>m[1]);
assert.equal(ids.length,8);assert.deepEqual(hrefs,ids);
const short=structuredClone(long);short.content_blocks=short.content_blocks.slice(0,1);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:short,readOnly:true})),/aria-label="In this answer"/);
const together=renderToStaticMarkup(React.createElement('div',{},React.createElement(ProtocolV13Renderer,{data:long,readOnly:true}),React.createElement(ProtocolV13Renderer,{data:long,readOnly:true})));
const allIds=[...together.matchAll(/id="([^"]+-section-\d+)"/g)].map(m=>m[1]);assert.equal(new Set(allIds).size,16);
const comparison=makeResponse({content_blocks:[{...prior.content_blocks[0],type:'comparison',columns:[{key:'criterion',label:'Decision Criteria'},{key:'a',label:'Course A'},{key:'b',label:'Course B'}],rows:[{id:'practice',criteria:'Practice',cells:[{key:'criterion',value:'Practice'},{key:'a',value:'Roleplay'},{key:'b',value:'Not stated'}]}]}]});
let comparisonHtml=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:comparison,readOnly:true}));
assert.doesNotMatch(comparisonHtml,/data-label="Factor"/);assert.match(comparisonHtml,/Roleplay/);assert.match(comparisonHtml,/Not stated/);
comparison.content_blocks[0].rows[0].cells[0].value='Distinct detail';
comparisonHtml=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:comparison,readOnly:true}));assert.match(comparisonHtml,/data-label="Factor"/);assert.match(comparisonHtml,/Distinct detail/);
console.log('PASS: 105 contracts, '+eligibleTools.length+' routed tasks, distinct profiles, fallback teaching guidance, all lesson text rendered, navigation targets, short-answer simplicity and unique multi-answer anchors.');
