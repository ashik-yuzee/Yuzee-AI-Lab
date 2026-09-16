import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** One local server process: serialize updates and replace the file atomically. */
export class LocalConversationStore {
  private pending: Promise<void> = Promise.resolve();
  constructor(private file: string) {}
  private async read(): Promise<any[]> {
    try {
      const value=JSON.parse(await fs.readFile(this.file,'utf8'));
      if (!Array.isArray(value)) throw new Error('Conversation storage must contain a list.');
      return value;
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error; // Never overwrite unreadable history with an empty list.
    }
  }
  private update(change:(all:any[])=>any[]):Promise<void> {
    const next=this.pending.then(async()=>{
      const all=change(await this.read());
      await fs.mkdir(path.dirname(this.file),{recursive:true});
      const temporary=`${this.file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary,JSON.stringify(all,null,2),{mode:0o600});
        await fs.rename(temporary,this.file);
      } finally { await fs.rm(temporary,{force:true}); }
    });
    this.pending=next.catch(()=>{});
    return next;
  }
  async list(){await this.pending;return this.read();}
  save(conversation:any){
    const snapshot=structuredClone(conversation);
    return this.update(all=>{
      const index=all.findIndex(c=>c.id===snapshot.id);
      if(index<0)all.push(snapshot);else all[index]=snapshot;
      return all;
    });
  }
  delete(id:string){return this.update(all=>all.filter(c=>c.id!==id));}
}
