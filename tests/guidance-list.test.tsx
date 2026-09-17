import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GuidanceList} from '../src/components/GuidanceList';
import {pathwayFixture} from './mini-pathway-fixture';
import {YuzeeRequestAssembler} from '../src/services/YuzeeRequestAssembler';
const base=pathwayFixture().content_blocks[0];
const items=['','current','next','warning','blocked','complete','positive','negative','neutral'].map((status,i)=>({id:`i${i}`,title:`Item ${i}`,text:`Complete explanation ${i}`,value:`Extra detail ${i}`,status}));
const block={...base,type:'steps' as const,title:'Learning stages',text:'An introduction that must remain visible.',items};
const before=JSON.stringify(block),html=renderToStaticMarkup(<GuidanceList block={block}/>);
assert.ok(html.includes('<ol '));assert.equal((html.match(/<li /g)||[]).length,9);
for(const item of items){assert.ok(html.includes(item.text));assert.ok(html.includes(item.value));}
for(const label of ['Start here','Next step','Check this','Needs attention','Completed'])assert.ok(html.includes(label));
assert.ok(!html.includes('Verified'));assert.ok(html.includes('aria-hidden="true"'));
assert.ok(html.includes(block.text));assert.equal(JSON.stringify(block),before);
const check=renderToStaticMarkup(<GuidanceList block={{...base,type:'list',title:'What to check before applying',items:[items[0]]}}/>);
assert.ok(!check.includes('To check'));assert.ok(!check.includes('guidance-status'));assert.ok(check.includes('What to check before applying'));assert.ok(check.includes('<ul '));assert.ok(!check.includes('Completed'));
const neutral=renderToStaticMarkup(<GuidanceList block={{...base,type:'steps',title:'Year-by-year learning',items:[items[0]]}}/>);
assert.ok(!neutral.includes('Start here'));assert.ok(!neutral.includes('Completed'));
const numberedItems=[
 {...items[0],title:'Stage 3: Home Lab Build',text:'Configure virtual machines and practise troubleshooting.',value:'3'},
 {...items[0],id:'next',title:'Step 4 — Apply for roles',value:'Step 4'},
 {...items[0],id:'hours',title:'Stage 5: Practise',value:'3 hours'},
 {...items[0],id:'year',title:'Year 2: Learn',value:'2'},
 {...items[0],id:'count',title:'Projects to complete',value:'5'},
 {...items[0],id:'playbook',title:'6. Conversion & Progression Strategy',value:'6'},
 {...items[0],id:'decimal',title:'3.5 years of study',value:'3.5'},
];
const numberedBlock={...base,type:'steps' as const,items:numberedItems};
const numberedBefore=JSON.stringify(numberedBlock);
const numbered=renderToStaticMarkup(<GuidanceList block={numberedBlock}/>);
assert.ok(numbered.includes('value="3"'));assert.ok(numbered.includes('Home Lab Build'));
assert.ok(!numbered.includes('Stage 3:'));assert.ok(!numbered.includes('>3</p>'));
assert.ok(!numbered.includes('Step 4'));assert.ok(numbered.includes('Apply for roles'));
assert.ok(numbered.includes('3 hours'));assert.ok(numbered.includes('Year 2: Learn'));
assert.ok(numbered.includes('>2</p>'));assert.ok(numbered.includes('>5</p>'));
assert.ok(!numbered.includes('6. Conversion'));assert.ok(!numbered.includes('>6</p>'));
assert.ok(numbered.includes('Conversion &amp; Progression Strategy'));
assert.ok(numbered.includes('3.5 years of study'));assert.ok(numbered.includes('>3.5</p>'));
assert.equal(JSON.stringify(numberedBlock),numberedBefore);
const parallel=renderToStaticMarkup(<GuidanceList block={{...numberedBlock,type:'list'}}/>);
assert.ok(parallel.includes('Stage 3: Home Lab Build'));assert.ok(parallel.includes('>3</p>'));
const request=YuzeeRequestAssembler.getInstance().assembleRequest({model:'gemini-3.7-flash',messageText:'Explain the course structure',useStructuredOutput:true});
assert.ok(request.systemInstruction.includes('<MEANINGFUL_VISUAL_STRUCTURE'));
console.log('PASS open guidance layout: order, all explanations and values preserved, text labels with icons, checks distinct from completion, no invented progress, prompt integrated.');
