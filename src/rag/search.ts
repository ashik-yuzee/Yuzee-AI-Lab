/** Retrieval primitives shared by every EXP-RAG collection: lexical BM25, dense cosine, RRF fusion and budget packing. */
import {estimateTokens} from '../services/TokenBudgetMemoryManager';

const STOP=new Set('a an the and or but if then than so of to in on at by for with from into onto about as is are was were be been being am do does did done have has had having i me my mine we our you your yours he she it its they them their this that these those there here what which who whom whose when where why how can could would should will shall may might must not no nor too very just also only own same such some any each few more most other both all again further once out over under up down off s t ll re ve d m please want wanting like really get got im ive id dont cant wont isnt arent wasnt'.split(' '));
// Light suffix folding so "studying"/"studies"/"study" and "nurses"/"nursing"/"nurse" meet. Codes (CPC30220) are untouched.
export function stem(w:string){
  if(w.length<=3||/\d/.test(w))return w;
  let s=w.replace(/(?:ational|ization|isation)$/,'ate');
  s=/(?:ies|ied)$/.test(s)?s.slice(0,-3)+'y':s.replace(/(?:ings?|edly|ed|es|ers?|ly|ments?|s)$/,'');
  s=s.replace(/e$/,'').replace(/([^aeiou])\1$/,'$1');
  return s.length>=3?s:w;
}
export function tokenize(text:string):string[]{
  return (String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').match(/[\p{L}\p{N}]+/gu)||[])
    .filter(w=>w.length>1&&!STOP.has(w)).map(stem);
}

export interface Doc{id:string;text:string}
export class Bm25Index{
  private postings=new Map<string,Array<[doc:number,tf:number]>>();
  private lengths:number[]=[];private ids:string[]=[];private avg=0;
  constructor(docs:Doc[],private k1=1.2,private b=0.75){
    docs.forEach((d,i)=>{
      const terms=tokenize(d.text);this.ids.push(d.id);this.lengths.push(terms.length);
      const tf=new Map<string,number>();for(const t of terms)tf.set(t,(tf.get(t)||0)+1);
      for(const [t,n] of tf){let p=this.postings.get(t);if(!p)this.postings.set(t,p=[]);p.push([i,n]);}
    });
    this.avg=this.lengths.reduce((s,n)=>s+n,0)/Math.max(1,this.lengths.length);
  }
  search(query:string,limit=20):Array<{id:string;score:number}>{
    const scores=new Map<number,number>();const N=this.ids.length;
    for(const t of new Set(tokenize(query))){
      const p=this.postings.get(t);if(!p)continue;
      const idf=Math.log(1+(N-p.length+.5)/(p.length+.5));
      for(const [doc,tf] of p){
        const norm=tf*(this.k1+1)/(tf+this.k1*(1-this.b+this.b*this.lengths[doc]/this.avg));
        scores.set(doc,(scores.get(doc)||0)+idf*norm);
      }
    }
    return [...scores].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([doc,score])=>({id:this.ids[doc],score}));
  }
}

export const dot=(a:ArrayLike<number>,b:ArrayLike<number>)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};

/** Reciprocal-rank fusion: robust to the different score scales of BM25 and cosine. */
export function rrf(lists:Array<Array<{id:string}>>,k=60):Map<string,number>{
  const fused=new Map<string,number>();
  for(const list of lists)list.forEach((item,rank)=>fused.set(item.id,(fused.get(item.id)||0)+1/(k+rank+1)));
  return fused;
}

/** Greedy whole-item packing under a token budget; never truncates an item mid-way. */
export function packByBudget<T>(items:T[],budget:number,tokens:(t:T)=>number):{kept:T[];dropped:T[];used:number}{
  const kept:T[]=[],dropped:T[]=[];let used=0;
  for(const item of items){const n=tokens(item);if(used+n<=budget){kept.push(item);used+=n;}else dropped.push(item);}
  return {kept,dropped,used};
}
export {estimateTokens};
