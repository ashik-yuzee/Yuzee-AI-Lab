/** Live chat draft: visible content blocks are recovered from every prefix of a streaming protocol response. */
import assert from 'node:assert/strict';
import {draftBlocks,parsePartialJson} from '../src/ux/streamingDraft';

const full=JSON.stringify({schema_version:'1.3',current_mode:'A_CONVERSATION',content_blocks:[
  {id:'a',type:'text',title:'',text:'Carpentry is a hands-on trade with "real" variety.',items:[]},
  {id:'b',type:'list',title:'Routes',text:'',items:[{title:'Apprenticeship',text:'Earn while you learn'},{title:'Pre-apprenticeship',text:'Try it first'}]},
  {id:'c',type:'comparison',title:'Compare',columns:[{key:'x',label:'X'}],rows:[{id:'pay',cells:[{key:'x',value:'Paid'}]}]}],
  interaction:{kind:'question',question:'What next?'}});

// Every prefix parses without throwing, and the number of visible blocks never goes backwards.
let previous=0;
for(let i=1;i<=full.length;i++){const n=draftBlocks(full.slice(0,i)).length;assert.ok(n>=previous,`blocks went backwards at ${i}`);previous=n;}
assert.equal(draftBlocks(full).length,3);
assert.equal(draftBlocks(full)[0].text,'Carpentry is a hands-on trade with "real" variety.');
// Mid-string: the partial text is shown as it arrives, including escaped quotes.
assert.match(draftBlocks(full.slice(0,full.indexOf('variety')+3))[0].text,/with "real" var$/);
// Code fences (prompt-only JSON) and a block with no visible text yet.
assert.equal(draftBlocks('```json\n{"content_blocks":[{"type":"text","text":"Hi th')[0]?.text,'Hi th');
assert.deepEqual(draftBlocks('{"schema_version":"1.3","content_blocks":[{"type":"text","te'),[]);
assert.equal(draftBlocks('{"content_blocks":[{"type":"text","text":"caf\\u00')[0]?.text,'caf','partial unicode escape is held back');
// A dangling escape cannot be closed safely; the parser trims back instead of throwing.
assert.doesNotThrow(()=>parsePartialJson('{"a":"x\\'));
assert.equal(parsePartialJson('no json here'),null);
console.log('PASS streaming draft: every prefix parses, blocks never regress, partial text and escapes preserved.');
