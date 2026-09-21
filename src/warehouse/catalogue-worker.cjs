// Runs outside the chat event loop. The source warehouse is always opened read-only.
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');const path=require('node:path');
const {createLinkedReader}=require('./linked-data.cjs');
const {buildOpportunityIndex}=require('./opportunities.cjs');
const {createProviderReader}=require('./provider-data.cjs');
let source,index,linked,providerReader;
const terms=text=>[...new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[])].filter(w=>!new Set(['the','at','in','of','and','a','an','for','to','i','want','please','course','courses','compare','show','me','with','what','is','are']).has(w)).slice(0,14);
const fields=`id,course_name,institution_id,institution_name,national_code,course_code,aqf_level,course_type,description,duration_text,delivery_modes_json,locations_json,entry_requirements,domestic_fee,international_fee,skills_json,quality_scores_json,work_readiness_score,future_readiness_score,yuzee_readiness_score,career_outcomes_json,intelligence_json,canonical_url,web_collect_url,website,intelligence_enriched_at,updated_at`;
function initialize(config){
 source=new DatabaseSync(config.source,{readOnly:true});
 const stat=fs.statSync(config.source),wal=fs.existsSync(config.source+'-wal')?fs.statSync(config.source+'-wal'):null,stamp=JSON.stringify({version:7,source:path.resolve(config.source),size:stat.size,mtime:stat.mtimeMs,walSize:wal?.size,walMtime:wal?.mtimeMs});
 fs.mkdirSync(path.dirname(config.index),{recursive:true});
 let valid=false;
 if(fs.existsSync(config.index)){try{index=new DatabaseSync(config.index);valid=index.prepare("SELECT value FROM metadata WHERE key='source'").get()?.value===stamp;}catch{}}
 if(!valid){
  index?.close();const temp=config.index+'.building-'+process.pid;try{fs.unlinkSync(temp);}catch{}
  index=new DatabaseSync(temp);index.exec("CREATE VIRTUAL TABLE catalogue USING fts5(course_id UNINDEXED,course_name,institution_name,national_code,course_code,institution_id UNINDEXED,tokenize='unicode61 remove_diacritics 2'); CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT); BEGIN");
  const add=index.prepare('INSERT INTO catalogue VALUES(?,?,?,?,?,?)');let count=0;
  for(const row of source.prepare('SELECT id,course_name,institution_name,national_code,course_code,institution_id FROM live_courses').iterate()){
   add.run(String(row.id),row.course_name||'',row.institution_name||'',row.national_code||'',row.course_code||'',String(row.institution_id||''));count++;
   if(count%10000===0)process.send?.({type:'progress',count});
  }
  // Materialize only public mapping fields; source tables lack lookup indexes.
  const copies={profile_links:{source:'course_mapping_profile',fields:'course_id,course_name,qualification_code,anzsco_codes_json,occupation_titles_json,industry_codes_json,mapping_method,mapping_confidence',key:'course_id'},occupation_links:{source:'course_occupation_map',fields:'qualification_code,occupation_code,occupation_name,match_method,match_confidence,is_primary',key:'qualification_code'}};
  for(const [name,c] of Object.entries(copies)){
   const cols=c.fields.split(',');index.exec('CREATE TABLE '+name+' ('+cols.map(k=>k+' TEXT').join(',')+'); CREATE INDEX '+name+'_lookup ON '+name+'('+c.key+')');
   if(source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(c.source)){const insert=index.prepare('INSERT INTO '+name+' VALUES('+cols.map(()=>'?').join(',')+')');for(const r of source.prepare('SELECT '+c.fields+' FROM '+c.source).iterate())insert.run(...cols.map(k=>r[k]??null));}
  }
  index.exec('CREATE TABLE industry_links(course_id TEXT,industry_name TEXT,qualification_code TEXT,mapping_method TEXT); CREATE INDEX industry_name_lookup ON industry_links(industry_name)');
  const addIndustry=index.prepare('INSERT INTO industry_links VALUES(?,?,?,?)');
  for(const r of index.prepare('SELECT course_id,qualification_code,industry_codes_json,mapping_method FROM profile_links').iterate()){
   let names=[];try{names=JSON.parse(r.industry_codes_json||'[]');}catch{}
   if(Array.isArray(names))for(const name of names.slice(0,8))if(typeof name==='string'&&name.trim()&&!/^(unknown|null|none)$/i.test(name))addIndustry.run(r.course_id,name.trim(),r.qualification_code||'',r.mapping_method||'');
  }
  buildOpportunityIndex(source,index);
  index.prepare('INSERT INTO metadata VALUES(?,?)').run('source',stamp);index.exec('COMMIT');index.close();fs.renameSync(temp,config.index);index=new DatabaseSync(config.index);
 }
 linked=createLinkedReader(source,index);providerReader=createProviderReader(source);
 process.send?.({type:'ready'});
}
function search(text,providerId){
 const tokens=terms(text);if(!tokens.length)return [];
 const clause=tokens.map(w=>'"'+w+'"'+(w.length>2&&!/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(w)&&!/[0-9]/.test(w)?'*':'')).join(' AND ');
 // All terms must match. Returning nothing is preferable to silently dropping a named provider.
 return index.prepare('SELECT course_id,course_name,institution_name,bm25(catalogue,0,5,3,8,8,0) AS rank FROM catalogue WHERE catalogue MATCH ?'+(providerId?' AND institution_id=?':'')+' ORDER BY rank LIMIT 16').all(clause,...(providerId?[providerId]:[]));
}
process.on('message',message=>{
 try{
  if(message.type==='init'){initialize(message.config);return;}
  if(message.type==='lookup'){
   const chosen=[];const seen=new Set();
   for(const id of (message.ids||[]).slice(0,4)){if(/^\d+$/.test(id)&&!seen.has(id)){chosen.push(id);seen.add(id);}}
   // Interleave queries so one option cannot consume an entire comparison shortlist.
   const providerMatches=providerReader.matches(message.plan?.provider_queries);
   // Duplicate legal names can represent distinct registrations. Resolve only
   // when the user's requested course actually belongs to exactly one record.
   for(const match of providerMatches)if(match.status==='AMBIGUOUS'&&(message.queries||[]).length){
    const offering=match.providers.filter(p=>(message.queries||[]).some(q=>search(q,p.id).length));
    if(offering.length===1){match.status='MATCHED';match.providers=offering;match.resolution='Unique requested course offering';}
   }
   const resolved=providerMatches.filter(m=>m.status==='MATCHED').flatMap(m=>m.providers);
   const groups=providerMatches.length?resolved.flatMap(p=>(message.queries||[]).slice(0,3).map(q=>search(q,p.id))):(message.queries||[]).slice(0,3).map(q=>search(q));
   for(let n=0;n<(providerMatches.length&&(message.queries||[]).every(q=>/^[A-Z]{3}[0-9]{5}$/i.test(q.trim()))?1:16)&&chosen.length<4;n++)for(const group of groups){const hit=group[n];if(hit&&!seen.has(hit.course_id)&&chosen.length<4){seen.add(hit.course_id);chosen.push(hit.course_id);}}
   const read=source.prepare('SELECT '+fields+' FROM live_courses WHERE id=?');
   const rows=chosen.map(id=>read.get(id)).filter(Boolean);
   const comparing=message.plan?.comparison===true||providerMatches.length>0;
   process.send?.({id:message.id,rows,connected:linked.read(rows,message.plan||{}),providerMatches:comparing?(providerMatches.length?providerMatches:providerReader.matches([...new Set(rows.map(r=>r.institution_name).filter(Boolean))])):[],qualifications:comparing?providerReader.qualifications(rows):[]});
  }
 }catch(error){process.send?.({id:message.id,type:message.type==='init'?'failed':'error',error:'Warehouse lookup could not be completed.'});}
});
process.on('disconnect',()=>process.exit(0));
