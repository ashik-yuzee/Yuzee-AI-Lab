import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalConversationStore } from '../src/services/LocalConversationStore';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'yuzee-store-test-'));
try {
 const file=path.join(dir,'conversations.json');
 const store=new LocalConversationStore(file);
 await Promise.all(Array.from({length:40},(_,i)=>store.save({id:String(i),messages:[{content:'answer '+i}]})));
 assert.equal((await store.list()).length,40);
 await Promise.all([store.save({id:'0',messages:[{content:'updated'}]}),store.delete('1'),store.save({id:'41',messages:[]})]);
 const reloaded=await new LocalConversationStore(file).list();
 assert.equal(reloaded.length,40);
 assert.equal(reloaded.find(c=>c.id==='0').messages[0].content,'updated');
 assert.ok(!reloaded.some(c=>c.id==='1'));
 const interrupted=path.join(dir,'conversations.json.interrupted.tmp');
 await fs.writeFile(interrupted,'incomplete');
 assert.equal((await store.list()).length,40);
 const badFile=path.join(dir,'broken.json');await fs.writeFile(badFile,'broken');
 await assert.rejects(()=>new LocalConversationStore(badFile).save({id:'bad'}));
 assert.equal(await fs.readFile(badFile,'utf8'),'broken');
 console.log('PASS: concurrent saves, updates, deletion, restart, incomplete temporary file and unreadable-history protection.');
} finally {await fs.rm(dir,{recursive:true,force:true});}
