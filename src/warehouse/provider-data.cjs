// Only public provider fields and national qualification content; source stays read-only.
const text=(x,n=700)=>x==null?null:String(x).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n)||null;
const safeLike=x=>x.replace(/[\\%_]/g,'\\$&');
const fields=['id','legal_name','rto_code','rto_type','city','state','about_us_description','website_url','has_student_support','has_disability_support','has_indigenous_support','has_library','has_apprenticeships','updated_at'];
function createProviderReader(db){
 const cols=new Set(db.prepare('PRAGMA table_info(live_institutions)').all().map(x=>x.name));
 const select=fields.map(k=>cols.has(k)?k:'NULL AS '+k).join(',');
 const hasUnits=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='qualification_units'").get();
 const project=r=>({id:String(r.id),evidenceId:'warehouse_rto_'+r.id,name:text(r.legal_name)||'Provider',rtoCode:text(r.rto_code),type:text(r.rto_type),area:[r.city,r.state].filter(Boolean).join(', '),description:text(r.about_us_description),support:['has_student_support','has_disability_support','has_indigenous_support','has_library','has_apprenticeships'].filter(k=>r[k]===1||r[k]==='1').map(k=>({has_student_support:'Student support',has_disability_support:'Disability support',has_indigenous_support:'Indigenous learner support',has_library:'Library',has_apprenticeships:'Apprenticeship support'}[k])),updatedAt:text(r.updated_at),scope:'Provider record; general locations and support do not establish course-specific delivery.'});
 return {
  matches(queries){return (queries||[]).slice(0,3).map(q=>{
   const words=String(q).toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0,8)||[];
   if(!cols.has('legal_name')||!words.length)return {query:q,status:'NOT_FOUND',providers:[]};
   const exact=db.prepare('SELECT '+select+' FROM live_institutions WHERE lower(legal_name)=lower(?)'+(cols.has('rto_code')?' OR rto_code=?':'')+' LIMIT 4').all(q,...(cols.has('rto_code')?[q]:[]));
   const rows=exact.length?exact:db.prepare('SELECT '+select+" FROM live_institutions WHERE "+words.map(()=>"legal_name LIKE ? ESCAPE '\\'").join(' AND ')+' ORDER BY legal_name LIMIT 4').all(...words.map(w=>'%'+safeLike(w)+'%'));
   return {query:q,status:rows.length===1?'MATCHED':rows.length?'AMBIGUOUS':'NOT_FOUND',providers:rows.map(project)};
  });},
  qualifications(rows){return [...new Set(rows.map(r=>r.national_code).filter(Boolean))].slice(0,4).map(code=>({code,evidenceId:'warehouse_qualification_'+code,units:hasUnits?db.prepare('SELECT unit_code,unit_title,unit_type FROM qualification_units WHERE qualification_code=? ORDER BY unit_type,unit_code LIMIT 30').all(code).map(u=>({code:text(u.unit_code),title:text(u.unit_title),type:text(u.unit_type)})):[],scope:'National qualification content (up to 30 units), not a provider-specific elective or delivery plan.'}));}
 };
}
module.exports={createProviderReader};
