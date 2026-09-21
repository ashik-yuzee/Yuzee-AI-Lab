import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {build} from 'esbuild';
const repo=process.cwd(),root=path.resolve('output/prompt-pack-40/2026-09-20');
const pack=JSON.parse(fs.readFileSync('qa/prompt-pack-40/cases.json','utf8'));
const runs=[];for(let repetition=1;repetition<=3;repetition++)for(const c of pack.cases){
 let variants=['baseline'];if(c.id==='T25')variants.push('supersession');if(c.id==='T27')variants.push('commission_swap');if(c.id==='T39')variants=['baseline','budget_only','goal_and_capacity','display_swap','name_only'];if(c.id==='T37')variants.push('explicit_action');
 for(const variant of variants)runs.push({id:`${c.id}-${variant}-r${repetition}`,caseId:c.id,repetition,variant});
}
fs.writeFileSync(root+'/runs.json',JSON.stringify(runs,null,2));
const runtime=root+'/runtime';fs.mkdirSync(runtime+'/data',{recursive:true});fs.mkdirSync(root+'/traces',{recursive:true});fs.mkdirSync(root+'/results',{recursive:true});
for(const [target,name]of [[repo+'/src','src'],[repo+'/node_modules','node_modules'],[repo+'/dist/public','public']]){if(!fs.existsSync(runtime+'/'+name))fs.symlinkSync(target,runtime+'/'+name);}
const original=fs.readFileSync('server.ts','utf8');
let source=`import {installAudit,middleware as auditMiddleware} from './scripts/prompt-pack-40/fixture-hook';\n`+original;
source=source.replace("app.use(express.json({ limit: '500kb' }));","app.use(express.json({ limit: '500kb' }));\ninstallAudit(warehouseService);app.use(auditMiddleware);");
source=source.replace('app.listen(PORT, "0.0.0.0"','app.listen(PORT, "127.0.0.1"');
await build({stdin:{contents:source,resolveDir:repo,sourcefile:'server-audit-entry.ts',loader:'ts'},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:runtime+'/server.cjs',external:['vite']});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.writeFileSync(root+'/manifest.json',JSON.stringify({created:new Date().toISOString(),definitions:40,repetitions:3,runs:runs.length,sourcePackSha256:hash(fs.readFileSync('qa/prompt-pack-40/cases.json')),serverSha256:hash(original),promptSha256:hash(fs.readFileSync('src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.11.md')),schemaSha256:hash(fs.readFileSync('src/protocol/v1.3/Yuzee_Response_Schema_v1.3.json')),mode:'Unmodified application server bundled in an isolated working directory, localhost:3011. Only retrieval is replaced by authorised fictional records; trace middleware added. Production prompt/schema remain unchanged. No external warehouse access. No grader assertions sent to target.',model:'gemini-3.7-flash',thinking:'medium',runInventory:'runs.json'},null,2));
console.log('Prepared',runs.length,'case executions');
