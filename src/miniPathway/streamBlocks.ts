import Ajv from 'ajv';
import schema from '../protocol/v1.3/Yuzee_Response_Schema_v1.3.json';
import type {YuzeeContentBlock} from '../types';

export type PathwayDraftEvent={type:'reset'}|{type:'block';block:YuzeeContentBlock};
const validBlock=new Ajv({strict:false}).compile<YuzeeContentBlock>(schema.properties.content_blocks.items);

/** Read only completed objects in the top-level content_blocks array.
 * String braces, escaped quotes, nested rows, and arbitrary chunk boundaries
 * do not terminate a block. No repaired/unfinished JSON is shown to the user.
 */
export class PathwayBlockStream {
 private text='';private offset=0;private depth=0;private quoted=false;private escaped=false;
 private stringStart=0;private rootKey='';private previous='';private inBlocks=false;private blockStart=-1;
 private ids=new Set<string>();
 push(delta:string):YuzeeContentBlock[]{
  this.text+=delta;const blocks:YuzeeContentBlock[]=[];
  for(;this.offset<this.text.length;this.offset++){
   const c=this.text[this.offset];
   if(this.quoted){
    if(this.escaped){this.escaped=false;continue;}
    if(c==='\\'){this.escaped=true;continue;}
    if(c==='"'){
     this.quoted=false;
     if(this.depth===1)try{this.rootKey=JSON.parse(this.text.slice(this.stringStart,this.offset+1));}catch{this.rootKey='';}
    }
    continue;
   }
   if(c==='"'){this.quoted=true;this.stringStart=this.offset;continue;}
   if(c==='['){
    if(this.depth===1&&this.previous===':'&&this.rootKey==='content_blocks')this.inBlocks=true;
    this.depth++;
   }else if(c==='{'){
    if(this.inBlocks&&this.depth===2)this.blockStart=this.offset;
    this.depth++;
   }else if(c==='}'||c===']'){
    if(c==='}'&&this.inBlocks&&this.depth===3&&this.blockStart>=0){
     try{
      const block=JSON.parse(this.text.slice(this.blockStart,this.offset+1));
      if(validBlock(block)&&block.id&&!this.ids.has(block.id)){
       this.ids.add(block.id);blocks.push(block as YuzeeContentBlock);
      }
     }catch{/* A malformed draft is never repaired or rendered. */}
     this.blockStart=-1;
    }
    if(c===']'&&this.inBlocks&&this.depth===2)this.inBlocks=false;
    this.depth--;
   }
   if(!/\s/.test(c))this.previous=c;
  }
  return blocks;
 }
}
