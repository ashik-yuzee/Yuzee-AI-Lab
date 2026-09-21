import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';
const repo=process.cwd(),base=path.resolve('output/prompt-pack-40/2026-09-20'),root=base+'/integration';
for(const d of ['runtime/data','results','traces','routing'])fs.mkdirSync(root+'/'+d,{recursive:true});
const runs=JSON.parse(fs.readFileSync(base+'/runs.json')).filter(r=>r.repetition===1&&r.variant==='baseline');
fs.writeFileSync(root+'/runs.json',JSON.stringify(runs,null,2));
for(const r of runs)fs.copyFileSync(base+'/results/'+r.id+'.json',root+'/results/'+r.id+'.json');
// Copy fictional conversations only. Do not reuse the earlier workspace selections:
// they were prepared with the adapter's incorrect evidence ID convention.
fs.copyFileSync(base+'/runtime/data/conversations.json',root+'/runtime/data/conversations.json');
for(const [target,name]of [[repo+'/src','src'],[repo+'/node_modules','node_modules'],[repo+'/dist/public','public']])if(!fs.existsSync(root+'/runtime/'+name))fs.symlinkSync(target,root+'/runtime/'+name);
let source="import {installAudit,middleware as auditMiddleware} from './scripts/prompt-pack-40/fixture-hook';\n"+fs.readFileSync('server.ts','utf8');
source=source.replace("app.use(express.json({ limit: '500kb' }));","app.use(express.json({ limit: '500kb' }));\ninstallAudit(warehouseService);app.use(auditMiddleware);");
source=source.replace('app.listen(PORT, "0.0.0.0"','app.listen(PORT, "127.0.0.1"');
await build({stdin:{contents:source,resolveDir:repo,sourcefile:'server-audit-entry.ts',loader:'ts'},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:root+'/runtime/server.cjs',external:['vite']});
fs.writeFileSync(root+'/manifest.json',JSON.stringify({scope:'Isolated rerun of BGE/selector/workspace; copied fictional conversations, fresh objective store. Adapter evidence IDs now follow warehouse_course_<courseId>, matching production normalizer. Production code and prompt unchanged.',port:3012,created:new Date().toISOString(),originalRoutingResults:'../routing',invalidOriginalResultReason:'Fixture evidence IDs lacked warehouse_ prefix, causing duplicate evidence on workspace refresh.'},null,2));
