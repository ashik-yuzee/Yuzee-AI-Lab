import React,{useEffect,useState} from 'react';
import {BookOpen,GraduationCap,MapPin,BarChart3,ArrowRight,Check} from 'lucide-react';
import type {WarehousePack,WarehouseCourse} from './types';
import {ProviderComparison} from './ProviderComparison';
const display=(value:string|null)=>value||'Not supplied';
function CourseDetails({course:c}:{course:WarehouseCourse}){
 return <details className="warehouse-course-details"><summary>Learning, outcomes and quality</summary>
  {c.description&&<p>{c.description}</p>}
  {c.skills.length>0&&<><h4><BookOpen size={17}/> What you can learn</h4><ul>{c.skills.map(x=><li key={x}>{x}</li>)}</ul></>}
  {c.assessments.length>0&&<><h4>How learning is assessed</h4><p>{c.assessments.join(' · ')}</p></>}
  {c.outcomes.length>0&&<><h4>Where it can lead</h4><ul>{c.outcomes.map(x=><li key={x}>{x}</li>)}</ul></>}
  {c.bestFor.length>0&&<><h4>Who it may suit</h4><ul>{c.bestFor.map(x=><li key={x}>{x}</li>)}</ul></>}
  {c.quality.length>0&&<section className="warehouse-quality"><h4><BarChart3 size={17}/> Course quality indicators</h4><p>These describe the course, rather than your own readiness.</p>
   {c.quality.map(q=><div className="warehouse-quality-row" key={q.key}><div><strong>{q.label}</strong><span>{q.value}/100</span></div><meter min={0} max={100} value={q.value} aria-label={`${q.label}: ${q.value} out of 100`}/><p>{q.explanation}</p></div>)}
   {c.qualityExplanation&&<p>{c.qualityExplanation}</p>}
  </section>}
  {c.considerations.length>0&&<><h4>What to weigh up</h4><ul>{c.considerations.map(x=><li key={x}>{x}</li>)}</ul></>}
  {c.entry.length>0&&<><h4>Entry information</h4><ul>{c.entry.map(x=><li key={x}>{x}</li>)}</ul></>}
  {(c.intelligence||[]).map(section=><section key={section.key}><h4>{section.label}</h4><ul>{section.items.map((item,n)=><li key={n}>{item}</li>)}</ul></section>)}
  {c.source.url&&<a href={c.source.url} target="_blank" rel="noreferrer">View course source ↗</a>}
 </details>;
}
export function WarehouseCourses({pack,selectedIds=[],onFocus,disabled=false}:{pack?:WarehousePack;selectedIds?:string[];onFocus:(ids:string[])=>void;disabled?:boolean}){
 const [selected,setSelected]=useState<string[]>(selectedIds);
 const ids=pack?.courses.map(c=>c.id).join(',')||'';
 useEffect(()=>setSelected(selectedIds.filter(id=>pack?.courses.some(c=>c.id===id))),[ids,selectedIds.join(',')]);
 if(!pack||pack.status==='NOT_NEEDED')return null;
 if(pack.status!=='READY')return <p className="warehouse-status" role="status">{pack.message||'Course data could not be loaded.'}</p>;
 if(!pack.courses.length)return pack.comparison?<ProviderComparison data={pack.comparison}/>:null;
 const toggle=(id:string)=>setSelected(previous=>previous.includes(id)?previous.filter(x=>x!==id):previous.length<3?[...previous,id]:previous);
 const saved=selected.length>0&&selected.length===selectedIds.length&&selected.every(x=>selectedIds.includes(x));
 return <section className="warehouse-courses" aria-label="Courses from the Yuzee catalogue">{pack.comparison&&<ProviderComparison data={pack.comparison} selection={{ids:selected,toggle,disabled}}/>}{!pack.comparison&&<header><GraduationCap size={22}/><div><h3>{pack.comparison?'Choose what to explore next':'Explore these courses'}</h3><p>Compare the details, then choose what to explore together.</p></div></header>}
  {!pack.comparison&&<div className="warehouse-table-scroll" tabIndex={0} role="region" aria-label="Course comparison"><table><thead><tr><th scope="col">Course</th><th scope="col">Duration</th><th scope="col">Study options</th><th scope="col">Tuition</th></tr></thead><tbody>{pack.courses.map(c=><tr key={c.id} data-selected={selected.includes(c.id)}><th scope="row"><label><input type="checkbox" aria-label={`Select ${c.name} at ${c.provider}`} checked={selected.includes(c.id)} disabled={disabled||!selected.includes(c.id)&&selected.length>=3} onChange={()=>toggle(c.id)}/><span><strong>{c.name}</strong><small>{c.provider}</small>{c.level&&<small className="warehouse-level">AQF level {c.level}</small>}</span></label></th><td>{display(c.duration)}</td><td>{c.delivery.join(', ')||'Not supplied'}</td><td>{c.fees.domestic!==null?`Domestic: ${c.fees.domestic}`:'Fee not supplied'}{c.fees.international!==null&&<small>International: {c.fees.international}</small>}</td></tr>)}</tbody></table></div>}
  <div className="warehouse-choice"><button type="button" disabled={disabled||!selected.length||saved} onClick={()=>onFocus(selected)}>{saved?<Check size={17}/>:<ArrowRight size={17}/>} {saved?'Saved to this conversation':selected.length>1?'Compare selected courses':'Explore selected course'}</button><span>Select up to three. You can change your mind.</span></div>
  {pack.courses.map(c=><article key={c.id} className="warehouse-course"><h4>{c.name}</h4><p className="warehouse-provider">{c.provider}</p>{c.locations.length>0&&<p className="warehouse-location"><MapPin size={15}/>{c.locations.slice(0,3).join(' · ')}{c.locations.length>3?' · more locations in catalogue':''}</p>}<CourseDetails course={c}/></article>)}
 </section>;
}
