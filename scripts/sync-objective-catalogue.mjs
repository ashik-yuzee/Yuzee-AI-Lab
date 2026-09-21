import fs from 'node:fs';
import {compileResult} from '../qa/objectives/schema.mjs';
const registry=JSON.parse(fs.readFileSync('qa/objectives/registry/workbook.json','utf8'));
const keys=['tool_id','button_label','topic_name','primary_category','clear_purpose','when_to_serve','do_not_serve_when','key_inputs','key_output','needs_live_data','max_interactions','allowed_primitives'];
const data={version:'objectives-316-preview-v1',source_sha256:registry.source_sha256,objectives:registry.objectives.map(o=>({...Object.fromEntries(keys.map(k=>[k,o[k]])),available:compileResult(o.qa_output_contract_v2).warnings.length===0}))};
const target='src/objectives/catalogue.json',text=JSON.stringify(data,null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==text)throw Error('Selection metadata is stale. Run scripts/sync-objective-catalogue.mjs');console.log('PASS 316 selection rows match pinned workbook and contract availability');}
else{fs.writeFileSync(target,text);console.log('Updated 316 selection rows; no execution prompts included');}
