import React from 'react';
import {MapPin,Users,BriefcaseBusiness,TrendingUp} from 'lucide-react';
import type {WarehouseConnections} from './types';
const names:Record<string,string>={SA2:'Local area',SA3:'District',SA4:'Wider region',STATE:'State',NATIONAL:'Australia'};
const date=(value:string|null)=>!value?'Date not supplied':/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)?new Date(value.length===7?value+'-01T00:00:00':value+'T00:00:00').toLocaleDateString('en-AU',{month:'short',year:'numeric'}):value;
const number=(n:number|null|undefined)=>n==null?'Not supplied':n.toLocaleString('en-AU');
const careerName=(title:string)=>/^\d+$/.test(title.trim())?'Other occupation in the records':title;
export function LocalAreaGuide({data}:{data:WarehouseConnections}){
 const area=data.location.region;if(!area)return null;
 const overview=data.localOverview;
 const demand=data.signals.filter(s=>s.kind==='RECORDED_DEMAND');
 const outlook=data.signals.filter(s=>s.kind==='PROJECTION');
 const role=(s:WarehouseConnections['signals'][number])=>careerName(data.careers.find(c=>c.id===s.careerId)?.title||s.title.replace(/^(Recorded demand|Recorded vacancies|Employment outlook) for /,''));
 const groups=overview?.community||[];
 const groupPurpose:Record<string,string>={learning:'Places to explore learning and training.',employment:'Services that may help you explore work and next steps.',community:'Places to try activities and discover what you enjoy.',support:'Organisations connected with community support.',business:'Business names in this directory; current hiring is not confirmed.'};
 return <div className="local-area-guide">
  <section aria-label="Local introduction"><h3><MapPin size={20} aria-hidden="true"/> Explore possibilities in {area.name}</h3>
   <p>You don’t need to choose a career yet. Start with the activities that catch your interest; we can use those to explore what you might enjoy doing and which local options are worth a closer look.</p>
   <p className="warehouse-muted">The local information below is here when you need it. You can explore your interests without working through every place or job first.</p>
  </section>
  <details className="local-supporting-guide"><summary>Explore local places, work and outlook</summary>
   {overview?.profile&&<details><summary>More about the area</summary><p>{overview.profile.scope!==area.tier||overview.profile.area!==area.name?`For the wider ${overview.profile.area} area`:`For ${area.name}`}{overview.profile.population!=null?`, the recorded population was ${number(overview.profile.population)} in ${overview.profile.period}`:''}. {overview.profile.setting&&`The regional profile describes it as ${overview.profile.setting.toLowerCase()}.`}</p><small>{overview.profile.source} · {overview.profile.period}</small></details>}
  <section aria-label="Around your community"><h3><Users size={20} aria-hidden="true"/> Around your community</h3>
   {groups.length?<><p>Here are examples of places recorded for {area.name}. They offer different starting points for exploring learning, work and community life.</p><dl className="local-community-list">{groups.map(g=><div key={g.key}><dt>{g.label}</dt><dd><p>{g.examples.slice(0,2).map(o=>o.name).join(' · ')}</p><small>{groupPurpose[g.key]}</small><details><summary>See recorded places and sources</summary><ul>{g.examples.map((o,i)=><li key={i}><strong>{o.name}</strong><small>{o.source.replace(/_/g,' ')}{o.updatedAt?` · ${date(o.updatedAt.slice(0,10))}`:''}</small></li>)}</ul><small>{g.recordedCount} distinct named records in this group{overview?.limited?' within the retrieved sample':''}; this is not a total of all businesses or services in the area.</small></details></dd></div>)}</dl></>:<p>Community places are not included in these results yet. That does not mean there are no local services or opportunities.</p>}
  </section>
  <section aria-label="Work and employers"><h3><BriefcaseBusiness size={20} aria-hidden="true"/> Work and employers</h3>
   {demand.length?<><p>These job-advertisement records show types of work to explore. Read the area and date beside each row: some figures cover a wider region than {area.name}.</p>
    <div className="local-demand-scroll" role="region" aria-label="Recorded jobs and employers" tabIndex={0}><table><thead><tr><th scope="col">Type of work</th><th scope="col">Job ads</th><th scope="col">Employers</th></tr></thead><tbody>{demand.map(s=><tr key={s.id}><th scope="row">{role(s)}<small>{s.region} · {names[s.scope]||s.scope} · {date(s.period)}</small>{!s.metrics&&<small>{s.text}</small>}</th><td>{number(s.metrics?.advertisements)}</td><td>{number(s.metrics?.employers)}</td></tr>)}</tbody></table></div>
    <p className="warehouse-muted">Recorded advertisements are not confirmed open today. Employers can appear in more than one row, so these figures should not be added into a company total.</p>
   </>:<p>For the roles in this view, these results do not include job-advertisement or employer counts. That does not mean there are no jobs nearby.</p>}
   {data.careers.filter(c=>!/^\d+$/.test(c.title)).length>0&&<details className="local-role-details"><summary>What these jobs involve</summary>{data.careers.filter(c=>!/^\d+$/.test(c.title)).map(c=><article key={c.id}><h4>{c.title}</h4>{c.description&&<p>{c.description}</p>}{c.tasks.length>0&&<ul>{c.tasks.slice(0,3).map(t=><li key={t}>{t}</li>)}</ul>}{c.skills.length>0&&<p><strong>Skills used:</strong> {c.skills.slice(0,5).join(', ')}.</p>}</article>)}</details>}
  </section>
  <section aria-label="Demand and future outlook"><h3><TrendingUp size={20} aria-hidden="true"/> Demand and future outlook</h3>
   <p>{demand.length?'The dated records above describe recent recorded demand. Use them to spot work worth exploring; they do not show every vacancy or which role would suit you.':'A dated demand count is not available for these roles in the current results.'}</p>
   {outlook.length?<><p>The longer-term projections below describe how employment may change. Their geography may be state-wide or national.</p><div className="local-outlook-list">{outlook.map(s=><article key={s.id}><h4>{role(s)}</h4>{s.metrics?.growthPercent!=null&&s.metrics?.horizonYears!=null?<p><strong>{Math.abs(s.metrics.growthPercent)}% {s.metrics.growthPercent<0?'decrease':s.metrics.growthPercent===0?'change':'growth'}</strong> projected over {s.metrics.horizonYears} years{s.metrics.baseYear?` from ${s.metrics.baseYear}`:''}.</p>:<p>{s.text}</p>}<small>{s.region==='AUS'||s.region==='ALL'?'Australia · National forecast':`${s.region} · ${names[s.scope]||s.scope}`} · Published {date(s.period)}</small></article>)}</div><p className="warehouse-muted">A projection is a forecast, not a guarantee of future vacancies or employment.</p></>:<p className="warehouse-muted">No future employment projection is included for these roles. Missing forecast data does not mean there is no future opportunity.</p>}
   <details><summary>Sources and coverage</summary>{demand.concat(outlook).map(s=><p key={s.id}><strong>{role(s)}</strong> — {s.source} · {s.region} · {date(s.period)}.</p>)}<p>Community examples come from the warehouse directory. Counts describe the returned records, not every company in the community. Personal fit depends on what you enjoy and the circumstances you choose to share.</p></details>
  </section>
  </details>
 </div>;
}
