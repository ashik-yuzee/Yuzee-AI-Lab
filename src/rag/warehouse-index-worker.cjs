// EXP-RAG warehouse index search. Runs outside the chat event loop; the index is opened read-only.
// Dense: int8 vectors held in memory, scored against the float query vector. Lexical: FTS5 BM25.
const {DatabaseSync}=require('node:sqlite');
let db,dim=384,count=0,ids=[],kinds=[],rowids=[],scales,vecs,ranges=new Map(),meta={},kindByRowid=new Map(),lexicalStmt;
const STOP=new Set('a an the and or but if of to in on at by for with from is are was were be been am do does did have has had i me my we you your it its they them this that these those what which who how when where why can could would should will may might must not no so too very just also only some any each more most other all please want like get got'.split(' '));

function init(file){
  db=new DatabaseSync(file,{readOnly:true});
  for(const r of db.prepare('SELECT key,value FROM meta').all())try{meta[r.key]=JSON.parse(r.value);}catch{}
  dim=Number(meta.dimensions)||384;
  const rows=db.prepare('SELECT rowid,id,kind,vec FROM chunks WHERE vec IS NOT NULL ORDER BY kind,rowid').all();
  count=rows.length;scales=new Float32Array(count);vecs=new Int8Array(count*dim);
  rows.forEach((r,i)=>{
    const buf=Buffer.from(r.vec);
    scales[i]=buf.readFloatLE(0);vecs.set(new Int8Array(buf.buffer,buf.byteOffset+4,dim),i*dim);
    ids.push(r.id);kinds.push(r.kind);rowids.push(r.rowid);kindByRowid.set(r.rowid,r.kind);
    const range=ranges.get(r.kind);if(range)range[1]=i+1;else ranges.set(r.kind,[i,i+1]);
  });
  lexicalStmt=db.prepare('SELECT rowid,bm25(chunks_fts,3.0,1.0) AS r FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY r LIMIT ?');
  process.send?.({type:'ready',count,meta});
}
function dense(q,allowed,limit){
  const top=[];let floor=-Infinity;
  for(const [kind,[start,end]] of ranges){
    if(allowed&&!allowed.has(kind))continue;
    for(let i=start;i<end;i++){
      let s=0;const o=i*dim;for(let j=0;j<dim;j++)s+=vecs[o+j]*q[j];s*=scales[i];
      if(top.length<limit||s>floor){
        top.push([i,s]);top.sort((a,b)=>b[1]-a[1]);if(top.length>limit)top.pop();floor=top[top.length-1][1];
      }
    }
  }
  return top;
}
function lexical(text,allowed,limit){
  const terms=[...new Set((String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>w.length>1&&!STOP.has(w)))].slice(0,16);
  if(!terms.length)return [];
  const match=terms.map(t=>'"'+t.replace(/"/g,'')+'"').join(' OR ');
  // Rank inside FTS alone (a JOIN makes SQLite drive from the chunks table: ~1000x slower), then filter kinds in memory.
  const rows=lexicalStmt.all(match,allowed?limit*8:limit);
  const out=[];for(const r of rows){if(!allowed||allowed.has(kindByRowid.get(r.rowid)))out.push(r.rowid);if(out.length>=limit)break;}
  return out;
}
const read=()=>db.prepare('SELECT id,kind,entity,title,text,meta,tokens FROM chunks WHERE rowid=?');
function search(m){
  const allowed=Array.isArray(m.kinds)&&m.kinds.length?new Set(m.kinds):null;
  const q=m.vector?Float32Array.from(m.vector):null;
  const d=q?dense(q,allowed,m.denseLimit||40):[];
  const l=m.text?lexical(m.text,allowed,m.lexLimit||40):[];
  // Weighted reciprocal-rank fusion: natural-language queries lean on dense, codes/keywords on lexical.
  const wd=m.weights?.dense??1,wl=m.weights?.lexical??1;
  const fused=new Map(),denseScore=new Map(),lexRank=new Map();
  d.forEach(([i,s],rank)=>{const rowid=rowids[i];denseScore.set(rowid,s);fused.set(rowid,(fused.get(rowid)||0)+wd/(60+rank+1));});
  l.forEach((rowid,rank)=>{lexRank.set(rowid,rank);fused.set(rowid,(fused.get(rowid)||0)+wl/(60+rank+1));});
  const get=read();
  return [...fused].sort((a,b)=>b[1]-a[1]).slice(0,m.limit||12).map(([rowid,score])=>{
    const r=get.get(rowid);let meta={};try{meta=JSON.parse(r.meta||'{}');}catch{}
    return {id:r.id,kind:r.kind,entity:r.entity,title:r.title,text:r.text,meta,tokens:r.tokens,fused:score,dense:denseScore.get(rowid)??null,lexicalRank:lexRank.get(rowid)??null};
  });
}
function byIds(m){
  const stmt=db.prepare('SELECT id,kind,entity,title,text,meta,tokens FROM chunks WHERE id=?');
  return (m.ids||[]).slice(0,8).map(id=>stmt.get(String(id))).filter(Boolean).map(r=>{let meta={};try{meta=JSON.parse(r.meta||'{}');}catch{}return {...r,meta,fused:1,dense:null,lexicalRank:null};});
}
process.on('message',m=>{
  try{
    if(m.type==='init'){init(m.file);return;}
    if(m.type==='search')process.send?.({id:m.id,hits:search(m)});
    else if(m.type==='ids')process.send?.({id:m.id,hits:byIds(m)});
  }catch(e){process.send?.({id:m.id,type:m.type==='init'?'failed':'error',error:'Index search failed.'});}
});
process.on('disconnect',()=>process.exit(0));
