import React,{useState} from 'react';
import {ArrowUp,ArrowDown} from 'lucide-react';
import {validateObjectiveAnswer,type ObjectiveAnswer} from './contract';
const sourceLabels:Record<string,string>={USER_CONFIRMED:'You shared',AI_INFERRED:'AI interpretation',SOURCED_CURRENT_FACT:'Source-backed',UNKNOWN:'Still unknown',GENERAL_GUIDANCE:'General guidance'};
export function EvidenceNote({note}:{note:any}){return <div className={'objective-note '+note.source_status?.toLowerCase()}>{note.source_status!=='USER_CONFIRMED'&&<><span>{sourceLabels[note.source_status]||'Detail'}</span>{note.label&&<strong>{note.label}</strong>}</>}<p>{note.detail}</p></div>;}
export function ResultValue({value}:{value:any}):React.ReactNode{
 if(value===null||value===undefined||value==='')return <span className="objective-unknown">Not yet known</span>;
 if(typeof value!=='object')return <span>{typeof value==='string'&&/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value)?value.toLowerCase().replace(/_/g,' '):String(value)}</span>;
 if(value.source_status)return <EvidenceNote note={value}/>;
 if(Array.isArray(value))return value.length?<ul>{value.map((v,i)=><li key={i}><ResultValue value={v}/></li>)}</ul>:<span className="objective-unknown">No details supplied</span>;
 return <dl className="objective-result-fields">{Object.entries(value).filter(([k,v])=>!['comparison_scope','evidence_scope','evidence_refs'].includes(k)&&v!==null&&v!==''&&(!Array.isArray(v)||v.length>0)).map(([k,v])=><React.Fragment key={k}><dt>{k.replace(/_/g,' ')}</dt><dd><ResultValue value={v}/></dd></React.Fragment>)}</dl>;
}
export function PrimitiveRenderer({component:c,plan,onAnswer,disabled,hideKnown=false}:{component:any;plan:any;onAnswer:(a:ObjectiveAnswer)=>void;disabled:boolean;hideKnown?:boolean}){
 const [value,setValue]=useState<any>(c.component==='ranking'?c.options.map((o:any)=>o.id):c.component==='card_sort'?{}:c.component==='multi_select'?[]:'');
 const [error,setError]=useState('');
 const submit=(unsure=false)=>{const a={component_id:c.id,value,unsure};try{onAnswer(validateObjectiveAnswer(plan,a));setError('');}catch(e){setError((e as Error).message);}};
 const reorder=(index:number,delta:number)=>{const a=[...value];[a[index],a[index+delta]]=[a[index+delta],a[index]];setValue(a);};
 const required=c.required&&c.component!=='action_handoff';
 let control:React.ReactNode=null;
 if(required){
  if(['single_choice','yes_no_unsure','multi_select'].includes(c.component)||(c.component==='entity_picker'&&c.options.length))control=<div className="objective-choices">{c.options.map((o:any)=><label key={o.id}><input type={c.component==='multi_select'?'checkbox':'radio'} name={c.id} checked={Array.isArray(value)?value.includes(o.id):value===o.id} onChange={()=>setValue(c.component==='multi_select'?(value.includes(o.id)?value.filter((id:string)=>id!==o.id):[...value,o.id]):o.id)}/><span><strong>{o.label}</strong>{o.detail&&<small>{o.detail}</small>}</span></label>)}</div>;
  else if(c.component==='spectrum')control=<div className="objective-spectrum"><div><span>{c.settings.min_label}</span><span>{c.settings.max_label}</span></div><input aria-label={c.prompt||c.purpose} type="range" min={c.settings.min} max={c.settings.max} value={value===''?c.settings.min:value} onChange={e=>setValue(Number(e.target.value))}/><label>Your value <input type="number" min={c.settings.min} max={c.settings.max} value={value} onChange={e=>setValue(e.target.value===''?'':Number(e.target.value))}/></label></div>;
  else if(c.component==='ranking')control=<ol className="objective-ranking">{value.map((id:string,i:number)=><li key={id}><span>{c.options.find((o:any)=>o.id===id)?.label}</span><button type="button" aria-label={`Move ${id} up`} disabled={i===0} onClick={()=>reorder(i,-1)}><ArrowUp size={16}/></button><button type="button" aria-label={`Move ${id} down`} disabled={i===value.length-1} onClick={()=>reorder(i,1)}><ArrowDown size={16}/></button></li>)}</ol>;
  else if(c.component==='card_sort')control=<div>{c.options.map((o:any)=><label className="objective-sort" key={o.id}><span>{o.label}</span><select value={value[o.id]||''} onChange={e=>setValue({...value,[o.id]:e.target.value})}><option value="">Choose a group</option>{c.settings.buckets.map((b:string)=><option key={b}>{b}</option>)}</select></label>)}</div>;
  else control=<label className="objective-text-answer">{c.component==='entity_picker'?'Name or link (we will still need to verify it)':c.component==='profile_editor'?'Confirm or correct these details for this activity':'Your answer'}<textarea rows={3} maxLength={4000} value={value} onChange={e=>setValue(e.target.value)} placeholder="A short answer is fine."/></label>;
  if(c.component==='entity_picker'&&c.options.length)control=<>{control}<label className="objective-text-answer">Or enter names, links or details<textarea rows={3} maxLength={4000} value={c.options.some((o:any)=>o.id===value)?'':value} onChange={e=>setValue(e.target.value)} placeholder="You can add your own details instead of choosing an option."/></label></>;
 }
 const ordered=['timeline','pathway_builder'].includes(c.component);
 const known=c.content.filter((n:any)=>n.source_status==='USER_CONFIRMED');
 const content=c.content.filter((n:any)=>n.source_status!=='USER_CONFIRMED').map((n:any,i:number)=><li key={i}><EvidenceNote note={n}/></li>);
 const knownDetails=!hideKnown&&known.length>0&&<details className="objective-known-details"><summary>Details I’m using</summary><ul className="objective-notes">{known.map((n:any,i:number)=><li key={i}><EvidenceNote note={n}/></li>)}</ul><p className="objective-muted">If something is incorrect, tell Oala in the chat.</p></details>;
 if(known.length>0&&!required&&c.component==='evidence_panel'&&!content.length&&!c.rows.length)return knownDetails?<section className="objective-primitive" data-primitive={c.component}>{knownDetails}</section>:null;
 return <section className={'objective-primitive primitive-'+c.component} data-primitive={c.component}>
  <h3>{c.prompt||c.purpose}</h3>{c.prompt&&c.purpose&&c.prompt!==c.purpose&&<p className="objective-muted">{c.purpose}</p>}
  {content.length>0&&(ordered?<ol className="objective-sequence">{content}</ol>:<ul className="objective-notes">{content}</ul>)}
  {c.rows.length>0&&<div className="objective-table" tabIndex={0} role="region" aria-label={c.purpose||'Comparison'}><table><thead><tr><th scope="col">Item</th>{c.columns.map((x:string,i:number)=><th scope="col" key={i}>{x}</th>)}</tr></thead><tbody>{c.rows.map((r:any,i:number)=><tr key={i}><th scope="row">{r.label}</th>{r.cells.map((v:string,j:number)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>}
  {c.component==='hierarchy_explorer'&&!required&&c.options.map((o:any)=><details key={o.id}><summary>{o.label}</summary><p>{o.detail||'No further detail supplied.'}</p></details>)}
  {c.component==='readiness_scorecard'&&plan.readiness.enabled&&<div><strong>{plan.readiness.name}: {plan.readiness.score}/100</strong><p>How much information supports the next step. This is not a prediction of success.</p>{plan.readiness.dimensions.map((d:any)=><p key={d.name}>{d.name}: {d.score}/100 — {d.reason}</p>)}</div>}
  {required&&<form onSubmit={e=>{e.preventDefault();submit();}}><fieldset disabled={disabled}>{control}{error&&<p role="alert">{error}</p>}<div className="objective-actions"><button className="objective-primary" type="submit">Save answer</button>{c.settings.allow_unsure&&<button type="button" onClick={()=>submit(true)}>I’m not sure</button>}</div></fieldset></form>}
  {knownDetails}
 </section>;
}
