import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {outputReviewScenarios} from '../src/ux/outputReview';
import {ProtocolV13Renderer} from '../src/components/ProtocolV13Renderer';
import {acceptedResponse,responseToReadableText} from '../src/ux/responsePresentation';
import {validateProtocol} from '../src/protocol/validator';
import {makeResponse} from '../src/ux/fixtures';
import schema13 from '../src/protocol/v1.3/Yuzee_Response_Schema_v1.3.json';
import schema14 from '../src/protocol/v1.4/Yuzee_Response_Schema_v1.4.json';
let checks=0;
const test=(name:string,fn:()=>void)=>{fn();checks++;console.log('PASS:',name);};
const find=(id:string)=>outputReviewScenarios.find(s=>s.id===id)!.response;
for(const scenario of outputReviewScenarios.filter(s=>s.response)) test('Valid, readable and renderable: '+scenario.id,()=>{
 const validation=validateProtocol(scenario.response);
 assert.equal(validation.protocolAccepted,true,JSON.stringify(validation.errors));
 const html=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:scenario.response}));
 assert.ok(html.length>100);
 const text=responseToReadableText(scenario.response);
 assert.ok(text.length>20);assert.doesNotMatch(text,/schema_version|security_breach_count|question_id/);
});
test('Every allowed block family has an example',()=>{
 const supported=new Set([...schema13.properties.content_blocks.items.properties.type.enum,...schema14.properties.content_blocks.items.properties.type.enum]);
 const covered=new Set(outputReviewScenarios.flatMap(s=>s.response?.content_blocks.map((b:any)=>b.type)||[]));
 for(const type of supported)assert.ok(covered.has(type),type);
});
test('Every input family has an example',()=>{
 const covered=new Set(outputReviewScenarios.map(s=>s.response?.interaction.input_type));
 for(const type of ['none','text','single_select','multi_select','ranked_select','fields'])assert.ok(covered.has(type),type);
});
test('All chart series and zeros survive display and copy',()=>{
 for(const type of ['bar','line','donut','funnel']){
  const response=find('box-chart-'+type);
  const html=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:response}));
  assert.match(html,/Planned/);assert.match(html,/Used/);assert.match(html,/>0<\/td>/);assert.match(html,/hours/);
  assert.match(responseToReadableText(response),/Used: 0 hours/);
 }
});
test('Every rich structure survives copy and speech',()=>{
 for(const [id,expected] of [['cards','Guided learning'],['timeline','Try a task'],['flow','If you want to continue'],['pathway','Try a spreadsheet task'],['scorecard','12 hours/week'],['progress','Attendance still needs confirming']])
 assert.ok(responseToReadableText(find('box-'+id)).includes(expected),id);
});
test('Flow uses readable names instead of internal IDs',()=>{
 const html=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:find('box-flow')}));
 assert.doesNotMatch(html,/node_a|node_b/);assert.match(html,/Try a small task/);
});
test('Missing table values are explicitly unknown',()=>{
 const html=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:find('box-table')}));
 assert.match(html,/Not provided/);assert.doesNotMatch(html,/>—</);
});
test('One requested question is not followed by another form',()=>{
 const response=find('no-more-questions');
 assert.equal(response.interaction.kind,'none');assert.equal(response.content_blocks.length,1);
 const html=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:response}));
 assert.doesNotMatch(html,/<form/);
});
test('Unsupported checklist rejected in both contracts',()=>{
 for(const version of ['1.3','1.4']){
 const response=makeResponse({schema_version:version});
 response.content_blocks[0].type='checklist';
 if(version==='1.4')response.content_blocks[0].data={};
 assert.equal(acceptedResponse(response),null);
 }
});
test('V1.3 never accepts a rich V1.4 block',()=>{
 const response=structuredClone(find('box-cards'));response.schema_version='1.3';
 assert.equal(acceptedResponse(response),null);
});
test('Earlier questions have no active radio inputs',()=>{
 const html=renderToStaticMarkup(React.createElement(ProtocolV13Renderer,{data:find('state-earlier'),readOnly:true}));
 assert.doesNotMatch(html,/type="radio"/);assert.match(html,/Earlier question/);
});
test('Malformed chart series rejected before rendering',()=>{
 const response=structuredClone(find('box-chart-bar'));
 response.content_blocks.find((b:any)=>b.type==='chart').data.series[1].values=[2];
 assert.equal(acceptedResponse(response),null);
});
console.log(checks+' output review checks passed.');
