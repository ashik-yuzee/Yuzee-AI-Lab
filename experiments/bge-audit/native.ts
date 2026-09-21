import fs from 'node:fs/promises';
import os from 'node:os';
import {load,run,config} from './diagnostics';
const cases=(await fs.readFile('tests/fixtures/bge-heldout-skills.txt','utf8')).trim().split('\n').map(l=>{const[expected,text]=l.split('|');return{expected,text};});
const {extractor,marks,events}=await load('cpu',`./data/minilm-cache/${config.id}/${config.revision}`);
const result=await run(extractor,cases,s=>{if(s.endsWith('/103')&&/Query (25|50|75|100)\//.test(s))console.log(s);});
await fs.writeFile('output/bge-audit/native-diagnostics.json',JSON.stringify({...result,runtime:{device:'cpu',platform:os.platform(),arch:os.arch(),node:process.version},startup:{marks,events}},null,2));
console.log('Saved full native diagnostics');await extractor.dispose();
