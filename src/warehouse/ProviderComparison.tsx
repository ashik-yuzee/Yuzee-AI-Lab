import React,{useState} from 'react';
import {GitCompareArrows,BookOpen} from 'lucide-react';
import type {WarehouseComparison} from './types';
const basis={COURSE_RECORD:'Course record',PROVIDER_RECORD:'Provider record',YUZEE_ANALYSIS:'Yuzee analysis'};
export function ProviderComparison({data,selection}:{data:WarehouseComparison;selection?:{ids:string[];toggle:(id:string)=>void;disabled:boolean}}){
 const [all,setAll]=useState(false);
 const shared=data.rows.filter(r=>r.status==='SHARED'),unknown=data.rows.filter(r=>r.status==='UNKNOWN');
 const rows=data.rows.filter(r=>all||!['SHARED','UNKNOWN'].includes(r.status)&&!['strengths','limits'].includes(r.key));
 return <section className="warehouse-comparison" aria-label="RTO and course intelligence comparison">
  <header><GitCompareArrows size={22}/><h3>{data.title}</h3></header><p>{data.baseline}</p>
  {data.providerMatches.filter(m=>m.status!=='MATCHED').map(m=><p className="warehouse-status" key={m.query}>{m.status==='NOT_FOUND'?`No provider match was returned for “${m.query}”.`:`More than one provider matches “${m.query}”. Use the full name or RTO code to make the comparison specific.`}</p>)}
  {data.notes?.map(n=><p className="warehouse-status" key={n}>{n}</p>)}
  {data.options.length>0&&<>
   <label className="warehouse-comparison-toggle"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Show all comparison details</label>
   {!rows.length&&<p>The supplied details do not establish a meaningful difference between these options. The shared learning is still useful; your preferred study setup can guide what to explore next.</p>}
   <div className="warehouse-table-scroll" tabIndex={0} role="region" aria-label="Provider differences"><table><thead><tr><th scope="col">What matters</th>{data.options.map(o=><th scope="col" key={o.id}>{selection?<label><input type="checkbox" aria-label={`Select ${o.subtitle} at ${o.title}`} checked={selection.ids.includes(o.id)} disabled={selection.disabled||selection.ids.length>=3&&!selection.ids.includes(o.id)} onChange={()=>selection.toggle(o.id)}/>{o.title}</label>:o.title}<small>{o.subtitle}</small></th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.key}><th scope="row">{r.label}<small>{basis[r.basis]}</small><details className="warehouse-row-meaning"><summary>Why it matters</summary><p>{r.meaning}</p></details></th>{r.values.map((cell,i)=><td key={i}>{cell.length?<ul>{cell.map((v,j)=><li key={j}>{v}</li>)}</ul>:<span className="warehouse-muted">Not supplied</span>}</td>)}</tr>)}</tbody></table></div>
   {shared.length>0&&<details><summary>What the records have in common</summary>{shared.map(r=><div key={r.key}><h4>{r.label}</h4><p>{r.values[0].join(' · ')}</p></div>)}</details>}
   {unknown.length>0&&<details><summary>Details not supplied</summary><p>{unknown.map(r=>r.label).join(' · ')}. These do not establish an advantage or disadvantage.</p></details>}
  </>}
  {data.qualifications.some(q=>q.units.length)&&<details><summary><BookOpen size={16}/> Shared qualification content</summary>{data.qualifications.map(q=><section key={q.code}><h4>{q.code}</h4><p>{q.scope}</p><ul>{q.units.map(u=><li key={u.code}>{u.title} <small>{u.code} · {u.type.toLowerCase()==='core'?'Core unit':'National elective option'}</small></li>)}</ul></section>)}</details>}
  <p className="warehouse-muted">Yuzee analysis explains the learning and trade-offs. Differences in wording or course scores alone do not establish which RTO teaches better.</p>
 </section>;
}
