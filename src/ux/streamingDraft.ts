import type {YuzeeContentBlock} from '../types';

/** Closes an incomplete JSON prefix (open strings, objects, arrays) so it can be parsed. Returns null when the
 * prefix ends somewhere that cannot be closed (a dangling key, colon or escape) and the caller should trim back. */
function closeJson(prefix:string):string|null{
  const stack:string[]=[];let inString=false,escaped=false;
  for(const ch of prefix){
    if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue;}
    if(ch==='"')inString=true;else if(ch==='{'||ch==='[')stack.push(ch);else if(ch==='}'||ch===']')stack.pop();
  }
  // An escape cut mid-way (a lone backslash or a partial \uXXXX) is dropped; the next delta completes it.
  if(escaped)return closeJson(prefix.slice(0,-1));
  if(inString&&/\\u[0-9a-fA-F]{0,3}$/.test(prefix))return closeJson(prefix.replace(/\\u[0-9a-fA-F]{0,3}$/,''));
  let out=prefix+(inString?'"':'');
  out=out.replace(/,\s*$/,'');
  if(/:\s*$/.test(out)||/[{,]\s*"[^"]*"\s*$/.test(out)&&stack.at(-1)==='{')return null; // key without a value
  return out+stack.reverse().map(c=>c==='{'?'}':']').join('');
}

/** Best-effort parse of a streaming JSON prefix: trims back to an earlier boundary until it closes and parses. */
export function parsePartialJson(text:string):any|null{
  let s=text.replace(/^\s*```(?:json)?\s*/i,'');
  const start=s.indexOf('{');if(start<0)return null;s=s.slice(start);
  for(let end=s.length,tries=0;end>0&&tries<40;tries++){
    const closed=closeJson(s.slice(0,end));
    if(closed!=null){try{return JSON.parse(closed);}catch{/* trim back */}}
    const cut=Math.max(s.lastIndexOf(',',end-1),s.lastIndexOf('{',end-1),s.lastIndexOf('[',end-1));
    if(cut<=0)return null;end=cut+(s[cut]===','?0:1);
  }
  return null;
}

/** Visible content blocks from a streaming protocol response, for a live draft. Blocks without any visible text yet
 * are dropped; ids are made stable so React does not remount blocks as they grow. */
export function draftBlocks(text:string):YuzeeContentBlock[]{
  const parsed=parsePartialJson(text);
  const blocks=Array.isArray(parsed?.content_blocks)?parsed.content_blocks:[];
  const hasText=(b:any)=>[b?.title,b?.text].some(x=>typeof x==='string'&&x.trim())||(Array.isArray(b?.items)&&b.items.length>0)||(Array.isArray(b?.rows)&&b.rows.length>0);
  return blocks.filter((b:any)=>b&&typeof b==='object'&&hasText(b)).map((b:any,i:number)=>({
    id:`draft-${i}`,type:typeof b.type==='string'?b.type:'text',level:b.level||'none',variant:b.variant||'default',title:b.title||'',text:b.text||'',
    items:Array.isArray(b.items)?b.items.filter((x:any)=>x&&(typeof x==='string'||typeof x==='object')):[],columns:Array.isArray(b.columns)?b.columns.filter((c:any)=>c?.key):[],
    rows:Array.isArray(b.rows)?b.rows.filter((r:any)=>r&&Array.isArray(r.cells)):[],
  })) as YuzeeContentBlock[];
}
