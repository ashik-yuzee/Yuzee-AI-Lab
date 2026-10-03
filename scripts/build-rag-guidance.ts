/**
 * Builds the EXP-RAG guidance knowledge base from the v1.11 counsellor prompt.
 * Module text is extracted verbatim using the anchored PARTITION in src/rag/guidance/manifest.ts.
 * --check fails on drift (source prompt, core prompt or manifest changed without regenerating).
 */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PARTITION,MODULES} from '../src/rag/guidance/manifest';
import {QUIZ_PROMPT_PATH,QUIZ_PROMPT_VERSION} from '../src/prompts/quizPrompt';
import {estimateTokens} from '../src/services/TokenBudgetMemoryManager';

const OUT='src/rag/guidance/guidance-kb.json';
const CORE='src/rag/guidance/core-prompt.md';
const source=fs.readFileSync(QUIZ_PROMPT_PATH,'utf8');
const core=fs.readFileSync(CORE,'utf8');
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const lines=source.split('\n');

// Resolve each anchor to the first line, after the previous region, that starts with it.
const starts:number[]=[];
let cursor=0;
for(const [anchor] of PARTITION){
  const at=lines.findIndex((l,i)=>i>=cursor&&l.startsWith(anchor));
  if(at<0)throw Error(`Missing guidance anchor after line ${cursor+1}: ${anchor}`);
  starts.push(at);cursor=at+1;
}
if(starts[0]!==0)throw Error('The first partition region must start at line 1.');

const isWrapper=(l:string)=>/^<\/?[A-Za-z0-9_]+(?:\s[^>]*)?>\s*$/.test(l.trim())||/^(id|version|type|priority|owner|requires):/.test(l)||/^\s+- [0-9a-z_]+$/.test(l);
const isRule=(l:string)=>/^(?:=+|-+|---)$/.test(l.trim());
function clean(block:string[]):string{
  // Decorative separators carry no meaning; wrapper tags are replaced by the module envelope.
  return block.filter(l=>!isWrapper(l)&&!isRule(l)).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

const parts=new Map<string,{order:number;text:string[]}>();
const coverage={lines:lines.length,core:0,modules:0,coreAndModule:0,meta:0};
PARTITION.forEach(([,assign],i)=>{
  const region=lines.slice(starts[i],starts[i+1]??lines.length);
  const targets=Array.isArray(assign)?assign:[assign];
  const content=region.filter(l=>l.trim()).length;
  const modules=targets.filter(t=>t!=='core'&&t!=='meta');
  if(targets.includes('meta'))coverage.meta+=content;
  else if(targets.includes('core')&&modules.length)coverage.coreAndModule+=content;
  else if(targets.includes('core'))coverage.core+=content;
  else coverage.modules+=content;
  for(const id of modules){
    if(!MODULES[id])throw Error(`Partition assigns an undeclared module: ${id}`);
    const text=clean(region);if(!text)continue;
    const entry=parts.get(id)??{order:i,text:[]};entry.text.push(text);parts.set(id,entry);
  }
});
for(const id of Object.keys(MODULES))if(!parts.has(id))throw Error(`Module has no source text: ${id}`);

const modules=[...parts.entries()].sort((a,b)=>a[1].order-b[1].order).map(([id,p])=>{
  const spec=MODULES[id];const text=p.text.join('\n\n');
  return {id,title:spec.title,layer:spec.layer,family:spec.family||'counselling',priority:spec.priority,triggers:spec.triggers||[],when:spec.when,examples:spec.examples,order:p.order,tokens:estimateTokens(text),text};
});
const kb={
  version:`exp-rag-guidance-1.0+v${QUIZ_PROMPT_VERSION}`,
  generatedBy:'scripts/build-rag-guidance.ts',
  source:{file:QUIZ_PROMPT_PATH,sha256:sha(source)},
  core:{file:CORE,sha256:sha(core),tokens:estimateTokens(core)},
  manifestSha256:sha(JSON.stringify({PARTITION,MODULES})),
  coverage,
  modules,
};
const text=JSON.stringify(kb,null,1)+'\n';
if(process.argv.includes('--check')){
  if(!fs.existsSync(OUT)||fs.readFileSync(OUT,'utf8')!==text)throw Error(`Guidance KB drift: run "npm run build:rag-guidance" (${OUT}).`);
  console.log(`Checked ${OUT}: ${modules.length} modules.`);
}else{
  fs.writeFileSync(OUT,text);
  const big=modules.filter(m=>m.tokens>1400).map(m=>`${m.id}=${m.tokens}`);
  console.log(`Generated ${OUT}: ${modules.length} modules, ${modules.reduce((s,m)=>s+m.tokens,0)} module tokens, core ${kb.core.tokens} tokens.`);
  console.log('Coverage (non-blank source lines):',coverage);
  if(big.length)console.log('Large modules:',big.join(', '));
}
