import type {YuzeeContentBlock} from '../types';

interface HasResponse {response?:{content_blocks?:YuzeeContentBlock[]}}

const ALWAYS_INCLUDE = new Set(['overview','route-summary','experience-playbook']);
const STOP = new Set(['i','a','an','the','and','or','but','in','on','at','to','for','of','with','by','is','was','are','were','have','has','had','be','do','did','will','would','could','should','may','might','can','that','this','which','who','what','where','when','how','my','me','your','we','our','they','it','not','no','yes','if','so','as','from','into','about','than','more','also','just','been','very','only','there','here','some','any','all','both','each','few','other','such','one','two','first','last','after','before','then','now','up','out','he','she']);

function kw(text:string):Set<string>{
 return new Set(text.toLowerCase().match(/\b[a-z]{3,}\b/g)?.filter(w=>!STOP.has(w))??[]);
}

function blockText(b:YuzeeContentBlock):string{
 const parts:string[]=[];
 if(b.title)parts.push(b.title);
 if(b.text)parts.push(b.text);
 for(const item of b.items??[]){if(item.title)parts.push(item.title);if(item.text)parts.push(item.text);}
 for(const row of b.rows??[])for(const cell of row.cells??[])if(cell.value)parts.push(cell.value);
 return parts.join(' ');
}

function score(b:YuzeeContentBlock,qkw:Set<string>):number{
 if(!qkw.size)return 0;
 const bkw=kw(blockText(b));
 let hits=0;
 for(const w of qkw)if(bkw.has(w))hits++;
 return hits;
}

function compact(b:YuzeeContentBlock):string{
 const label=b.title||b.id;
 switch(b.type){
  case 'text':case 'callout':{
   const lines=[`[${label}]`];
   if(b.text)lines.push(b.text.slice(0,700));
   return lines.join('\n');
  }
  case 'table':case 'comparison':{
   const lines=[`[${label}]`];
   const colLabel=new Map((b.columns??[]).map(c=>[c.key,c.label]));
   for(const row of b.rows??[]){
    const cells=(row.cells??[]).map(c=>`${colLabel.get(c.key)??c.key}: ${String(c.value).slice(0,150)}`).join(' | ');
    lines.push(`• ${cells}`);
   }
   return lines.join('\n');
  }
  case 'steps':case 'list':{
   const lines=[`[${label}]`];
   (b.items??[]).forEach((item,i)=>{
    const desc=item.text?`: ${item.text.slice(0,180)}`:'';
    lines.push(`${i+1}. ${item.title}${desc}`);
   });
   return lines.join('\n');
  }
  case 'heading':return `## ${label}`;
  default:{
   const lines=[`[${label}]`];
   if(b.text)lines.push(b.text.slice(0,300));
   return lines.join('\n');
  }
 }
}

/**
 * Returns a compact, relevance-ranked text summary of a pathway for chat context injection.
 * Always includes overview, route-summary and experience-playbook; ranks remaining blocks
 * by keyword overlap with the user query; stops at charBudget.
 */
export function getPathwayContext(run:HasResponse,userQuery:string,charBudget=5000):string|null{
 const blocks=run.response?.content_blocks;
 if(!blocks?.length)return null;
 const qkw=kw(userQuery);
 const scored=blocks
  .filter(b=>b.type!=='heading')
  .map(b=>({b,s:ALWAYS_INCLUDE.has(b.id)?Infinity:score(b,qkw)}))
  .sort((a,x)=>x.s-a.s);
 const parts:string[]=[];
 let chars=0;
 for(const{b,s}of scored){
  // Drop zero-relevance non-essential blocks once we've used 60% of budget
  if(s===0&&!ALWAYS_INCLUDE.has(b.id)&&chars>charBudget*0.6)continue;
  const c=compact(b);
  if(!c.trim())continue;
  if(chars>0&&chars+c.length>charBudget)break;
  parts.push(c);
  chars+=c.length+2;
 }
 if(!parts.length)return null;
 return `ACTIVE PATHWAY PLAN (generated earlier in this conversation; use as primary context when answering follow-up questions about routes, timelines or next steps):\n${parts.join('\n\n')}`;
}
