import React from 'react';
import {EvidenceNote,ResultValue} from './PrimitiveRenderer';
/** Titles come from the saved comparison, never an inferred replacement goal. */
export function activityTitle(session:any){
 const selected=session?.context?.selected_course_ids||[];
 const chosen=selected.length===1?session?.context?.warehouse_data?.courses?.find((c:any)=>c.id===selected[0]):null;
 if(session?.objectiveId==='STUDY_004'&&chosen)return 'Explore '+(chosen.code||chosen.name)+' at '+chosen.provider;
 const comparison=session?.context?.warehouse_data?.comparison;
 if(session?.objectiveId==='STUDY_004'&&comparison){const codes=comparison.qualifications?.map((q:any)=>q.code)||[];return codes.length===1?'Compare '+codes[0]+' providers':'Compare training providers';}
 const jobs=session?.plan?.result?.job_comparison?.jobs;
 const names=Array.isArray(jobs)?jobs.map((j:any)=>j.occupation_or_vacancy).filter((n:any)=>typeof n==='string'&&n.trim()):[];
 return names.length>=2?names.slice(0,3).join(' vs '):session?.label||'Your activity';
}
export function comparisonRows(result:any){
 const jobs=result?.job_comparison?.jobs;
 if(!Array.isArray(jobs)||jobs.length<2)return null;
 const labels=[...new Set<string>(jobs.flatMap((j:any)=>(j.criteria||[]).map((c:any)=>c.criterion)).filter((x:any)=>typeof x==='string'&&x.trim()))];
 return labels.length?{jobs,labels}:null;
}
export function WorkspaceResult({result}:{result:any}){
 const table=comparisonRows(result);
 if(table){const {jobs,labels}=table;return <section className="objective-readable-result" aria-label="Your comparison">
  {result.summary&&<p>{result.summary}</p>}
  <div className="objective-table" tabIndex={0} role="region" aria-label="Compare tasks, skills and requirements"><table><thead><tr><th scope="col">What to compare</th>{jobs.map((j:any,i:number)=><th scope="col" key={i}>{j.occupation_or_vacancy}</th>)}</tr></thead><tbody>{labels.map(label=><tr key={label}><th scope="row">{label}</th>{jobs.map((j:any,i:number)=>{const c=j.criteria?.find((c:any)=>c.criterion===label);return <td key={i}>{c?.value_or_status||'Not yet known'}{c?.unknowns?.length>0&&<p className="objective-muted">Still to check: {c.unknowns.join('; ')}</p>}</td>;})}</tr>)}</tbody></table></div>
  <p className="objective-muted">{jobs.some((j:any)=>j.criteria?.some((c:any)=>c.evidence_scope==='STABLE_CONCEPTUAL'))?'General comparison. Details vary by specialisation and location.':'Read this comparison alongside the supporting evidence and unknowns below.'}</p>
  {result.job_comparison.tradeoffs?.length>0&&<><h3>What these differences mean</h3>{result.job_comparison.tradeoffs.map((n:any,i:number)=><EvidenceNote key={i} note={n}/>)}</>}
  {result.job_comparison.decision_sensitive_unknowns?.length>0&&<details><summary>Details that could change the comparison</summary>{result.job_comparison.decision_sensitive_unknowns.map((n:any,i:number)=><EvidenceNote key={i} note={n}/>)}</details>}
 </section>;}
 return <section className="objective-readable-result">{result?.summary&&<p>{result.summary}</p>}<ResultValue value={Object.fromEntries(Object.entries(result||{}).filter(([k])=>!['summary','next_actions','unknowns'].includes(k)))}/></section>;
}
