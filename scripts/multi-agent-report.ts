/**
 * Plain-English PDF comparing Vanilla (AI Studio), EXP-RAG and Multi-Agent from a blind-judged eval folder
 * (answers.json, key.json, judge-*.json). HTML → PDF with local headless Chrome/Edge, like mode-report.ts.
 *   npm run report:multi-agent -- --data=docs/reports/data/multi-agent/round3 --out=docs/reports/multi-agent-comparison
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const arg=(k:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const dir=arg('data')||'docs/reports/data/multi-agent/round3';
const out=arg('out')||'docs/reports/multi-agent-comparison';
const read=(f:string)=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));

// Variant names in the data → the three modes. Anything else (e.g. MA_LOW) is ignored.
// MULTI_AGENT_FAST (optional, team turns only) is reported on its own lines and never enters the headline.
const MODE:Record<string,string>={VANILLA:'V',EXP_RAG:'E',MA_MEDIUM:'M',MULTI_AGENT:'M',MULTI_AGENT_FAST:'F'};
const MODES=['V','E','M'] as const;type Mode=typeof MODES[number]|'F';
const NAME:Record<Mode,string>={V:'Vanilla (AI Studio)',E:'EXP-RAG',M:'Multi-Agent',F:'Multi-Agent · fast setting'};
const SHORT:Record<Mode,string>={V:'Vanilla',E:'EXP-RAG',M:'Multi-Agent',F:'MA fast'};
const COLOR:Record<Mode,string>={V:'#64748b',E:'#6d4bc3',M:'#0f8a7e',F:'#7cc4b9'};

const answers=read('answers.json');
const rows:any[]=answers.rows.filter((r:any)=>MODE[r.variant]).map((r:any)=>({...r,mode:MODE[r.variant] as Mode,id:`${r.scenario}#${r.turn}`}));
const turnIds=[...new Set(rows.map(r=>r.id))];
const hasF=rows.some(r=>r.mode==='F');const teamIds=turnIds.filter(id=>rows.some(r=>r.id===id&&r.mode==='F'));
const row=(id:string,m:Mode)=>rows.find(r=>r.id===id&&r.mode===m);
for(const m of MODES)if(!rows.some(r=>r.mode===m))throw new Error(`no ${NAME[m]} rows in ${dir}/answers.json`);

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:NaN;
const med=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s.length?(s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2):NaN;};
const esc=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const sec=(ms:number)=>`${(ms/1000).toFixed(1)} s`;
const usd=(x:number)=>`$${x.toFixed(4)}`;
const by=<T,>(xs:T[],f:(x:T)=>number)=>[...xs].sort((a,b)=>f(a)-f(b));
const list=(xs:string[])=>xs.length<2?xs.join(''):`${xs.slice(0,-1).join(', ')} and ${xs.at(-1)}`;
const cents=(x:number)=>{const c=x*100;if(c>=1.5)return `about ${c.toFixed(1)} US cents`;if(c>=0.875)return 'about one US cent';
  const f=([[1/10,'a tenth of'],[1/5,'a fifth of'],[1/4,'a quarter of'],[1/3,'a third of'],[2/5,'two-fifths of'],[1/2,'half'],[3/5,'three-fifths of'],[2/3,'two-thirds of'],[3/4,'three-quarters of']] as Array<[number,string]>);
  return `about ${by(f,([v])=>Math.abs(v-c))[0][1]} a US cent`;};
const plural=(n:number,w:string)=>`${n} ${w}${n===1?'':'s'}`;

// ---- Quality: per judge and turn, re-rank only the three modes (others dropped; ties keep equal places).
const key:Record<string,Record<string,string>>=read('key.json');
const judgeFiles=fs.readdirSync(dir).filter(f=>/^judge-.+\.json$/.test(f)).sort();
if(!judgeFiles.length)throw new Error(`no judge-*.json in ${dir}`);
const CRIT:[string,string][]=[['relevance','Answers the question'],['grounding','Backed by real data'],['personalisation','Fits the person'],['actionability','Clear next steps'],['clarity','Easy to read']];
type Verdict={judge:string;id:string;mode:Mode;place:number;scores:Record<string,number>};
const judged=judgeFiles.map(f=>[f,read(f).turns as any[]] as const);
const rerank=(include:readonly Mode[],ids:string[])=>{const vs:Verdict[]=[];for(const [f,turns] of judged)for(const t of turns){if(!ids.includes(t.id))continue;
  const labels=Object.entries(key[t.id]||{}).filter(([,v])=>include.includes(MODE[v] as Mode)).map(([l,v])=>[l,MODE[v] as Mode] as const);
  for(const [l,m] of labels)if(t.rank?.[l]!=null)vs.push({judge:f,id:t.id,mode:m,place:1+labels.filter(([o])=>t.rank[o]<t.rank[l]).length,scores:t.scores?.[l]||{}});}return vs;};
const verdicts=rerank(MODES,turnIds);
// Team questions only, four answers ranked (1 = best, 4 = worst).
const teamVerdicts=hasF?rerank([...MODES,'F'],teamIds):[];
const teamRank=(m:Mode)=>avg(teamVerdicts.filter(v=>v.mode===m).map(v=>v.place));
const Q=Object.fromEntries(MODES.map(m=>{const v=verdicts.filter(x=>x.mode===m);return [m,{rank:avg(v.map(x=>x.place)),firsts:v.filter(x=>x.place===1).length,n:v.length,
  crit:Object.fromEntries([...CRIT.map(([k])=>k),'total'].map(k=>[k,avg(v.map(x=>Number(x.scores[k])).filter(Number.isFinite))]))}];})) as Record<Mode,{rank:number;firsts:number;n:number;crit:Record<string,number>}>;
const judgedTurns=turnIds.filter(id=>verdicts.some(v=>v.id===id));
const turnRank=(id:string,m:Mode)=>avg(verdicts.filter(v=>v.id===id&&v.mode===m).map(v=>v.place));
const turnWinners=(id:string)=>{const r=MODES.map(m=>[m,turnRank(id,m)] as const).filter(([,x])=>Number.isFinite(x));const best=Math.min(...r.map(([,x])=>x));return r.filter(([,x])=>x===best).map(([m])=>m);};
const judgeTop=(f:string,id:string)=>verdicts.filter(v=>v.judge===f&&v.id===id&&v.place===1).map(v=>v.mode);
const agree=judgeFiles.length>1?judgedTurns.filter(id=>{const tops=judgeFiles.map(f=>judgeTop(f,id));return tops[0].some(m=>tops.slice(1).every(t=>t.includes(m)));}).length:NaN;

// ---- Speed and cost.
const S=Object.fromEntries([...MODES,'F'].map(m=>{const rs=rows.filter(r=>r.mode===m);const timed=rs.filter(r=>r.timeline?.pre!=null&&r.timeline?.ttft!=null&&r.timeline?.gen!=null);
  const first=rs.map(r=>r.firstDeltaMs).filter((x:any)=>Number.isFinite(x));
  return [m,{n:rs.length,wall:med(rs.map(r=>r.wallMs)),first:med(first),wallMean:avg(rs.map(r=>r.wallMs)),
    pre:avg(timed.map(r=>r.timeline.pre)),ttft:avg(timed.map(r=>r.timeline.ttft)),gen:avg(timed.map(r=>r.timeline.gen)),check:avg(timed.map(r=>Math.max(0,r.wallMs-r.timeline.pre-r.timeline.ttft-r.timeline.gen))),
    cost:avg(rs.map(r=>r.totalCost)),main:avg(rs.map(r=>r.mainCost)),aux:avg(rs.map(r=>r.auxCost)),input:avg(rs.map(r=>r.usage?.input??NaN).filter(Number.isFinite)),
    withheld:rs.filter(r=>r.accepted===false).length}];})) as Record<Mode,any>;
const teamMed=(m:Mode,k:'wallMs'|'firstDeltaMs')=>med(rows.filter(r=>r.mode===m&&teamIds.includes(r.id)).map(r=>r[k]).filter(Number.isFinite));
const fastestOn=(m:Mode)=>turnIds.filter(id=>by(MODES.filter(x=>row(id,x)),x=>row(id,x).wallMs)[0]===m).length;
const levels=rows.filter(r=>r.mode==='M').map(r=>r.orchestration?.level??0);
const levelCount=(f:(l:number)=>boolean)=>levels.filter(f).length;

// ---- Verdict, written from the numbers.
const qOrder=by([...MODES],m=>Q[m].rank),sOrder=by([...MODES],m=>S[m].wall),cOrder=by([...MODES],m=>S[m].cost);
const qBest=qOrder[0],qGap=Q[qOrder[1]].rank-Q[qBest].rank,scoreBest=by([...MODES],m=>-Q[m].crit.total)[0];
// A spread under 0.25 places across 3 answers is too small to call on a sample this size.
const qTied=Q[qOrder[2]].rank-Q[qBest].rank<0.25;
const leads:Record<Mode,string[]>={V:[],E:[],M:[],F:[]};if(!qTied)leads[qBest].push('quality');leads[sOrder[0]].push('speed');leads[cOrder[0]].push('cost');
const pctLess=(a:number,b:number)=>Math.round((1-a/b)*100);
const verdict=`We asked all three modes the same ${plural(turnIds.length,'question')}. ${judgeFiles.length===2?'Two':judgeFiles.length} independent AI judges ranked the answers without knowing which mode wrote which.
${qTied?`<b>On quality the three modes were effectively tied.</b> Their average places were ${list(qOrder.map(m=>`${Q[m].rank.toFixed(2)} for ${SHORT[m]}`))} (out of 3), a gap too small to call on ${plural(turnIds.length,'question')}.`
:`<b>${NAME[qBest]}</b> gave the best answers on average${qGap<0.35?', by a small margin':''}: its average place was ${Q[qBest].rank.toFixed(2)} out of 3, against ${list(qOrder.slice(1).map(m=>`${Q[m].rank.toFixed(2)} for ${SHORT[m]}`))}.${scoreBest!==qBest?` On the judges' 25-point scores, though, ${NAME[scoreBest]} came out top (${Q[scoreBest].crit.total.toFixed(1)} against ${Q[qBest].crit.total.toFixed(1)} for ${SHORT[qBest]}), so the quality lead is not clear-cut.`:''}`}
<b>${NAME[sOrder[0]]}</b> was the fastest, with a typical answer finished in ${sec(S[sOrder[0]].wall)} (${list(sOrder.slice(1).map(m=>`${sec(S[m].wall)} for ${SHORT[m]}`))}).
<b>${NAME[cOrder[0]]}</b> was the cheapest at ${usd(S[cOrder[0]].cost)} per answer, ${cents(S[cOrder[0]].cost)}${cOrder[0]!=='V'?`, ${pctLess(S[cOrder[0]].cost,S.V.cost)}% less than Vanilla`:''}; ${list(cOrder.slice(1).map(m=>`${SHORT[m]} cost ${usd(S[m].cost)}`))}.
${MODES.filter(m=>leads[m].length>1).map(m=>`Overall, ${NAME[m]} led on ${list(leads[m])}.`).join(' ')}`;

// ---- Inline SVG pieces.
const arrow=(id:string)=>`<defs><marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8"/></marker></defs>`;
const pill=(y:number,t:string,fill='#f1f5f9',stroke='#cbd5e1',color='#1e293b')=>`<rect x="55" y="${y}" width="110" height="24" rx="12" fill="${fill}" stroke="${stroke}"/><text x="110" y="${y+16}" font-size="10.5" text-anchor="middle" fill="${color}">${t}</text>`;
const down=(id:string,x:number,y1:number,y2:number)=>`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2-2}" stroke="#94a3b8" stroke-width="1.4" marker-end="url(#${id})"/>`;
const book=(x:number,y:number,pages:number,hi:number[]|null,c:string)=>Array.from({length:pages},(_,i)=>`<rect x="${x+i*7}" y="${y}" width="6" height="40" rx="1" fill="${hi===null?c:hi.includes(i)?c:'#e2e8f0'}" opacity="${hi===null||hi.includes(i)?0.85:1}"/>`).join('');
function flow(m:Mode){
  const id=`ar${m}`,c=COLOR[m];let mid='';
  if(m==='V')mid=`${book(54,48,16,null,c)}<text x="110" y="104" font-size="10" text-anchor="middle" fill="#334155">The whole instruction book,</text><text x="110" y="116" font-size="10" text-anchor="middle" fill="#334155">sent on every question</text>`;
  if(m==='E')mid=`${book(54,48,16,[2,6,7,12],c)}<text x="110" y="104" font-size="10" text-anchor="middle" fill="#334155">Only the pages and facts</text><text x="110" y="116" font-size="10" text-anchor="middle" fill="#334155">this question needs</text>`;
  if(m==='M'){const team=['Profile','Jobs','Skills','Courses'];mid=team.map((t,i)=>{const x=32+i*52;return `<line x1="110" y1="30" x2="${x}" y2="49" stroke="#94a3b8" stroke-width="1.2"/><circle cx="${x}" cy="60" r="11" fill="${c}" opacity="0.85"/><text x="${x}" y="85" font-size="9.5" text-anchor="middle" fill="#334155">${t}</text>`;}).join('')
    +`<text x="110" y="102" font-size="9.5" text-anchor="middle" fill="#64748b" font-style="italic">all working at the same time</text>`+down(id,110,106,120);}
  const write=m==='M'?'Oala combines and writes':'Oala writes the answer';
  const by0=m==='M'?120:134;
  return `<svg viewBox="0 0 220 186" width="100%" role="img" aria-label="How ${esc(NAME[m])} works">${arrow(id)}${pill(6,'Question')}${m==='M'?'':down(id,110,30,46)+down(id,110,120,134)}${mid}
  <rect x="35" y="${by0}" width="150" height="24" rx="6" fill="#fff" stroke="${c}"/><text x="110" y="${by0+16}" font-size="10.5" text-anchor="middle" fill="#1e293b">${write}</text>
  ${m==='M'?down(id,110,144,160):''}${pill(160,'Answer',c,c,'#fff')}</svg>`;
}
const STAGES:[string,string,string][]=[['pre','#cbd5e1','Preparing (finding guidance and data)'],['ttft','#8b74d9','Thinking until first words'],['gen','#c4b5fd','Writing'],['check','#f2b45a','Checking']];
function stackedBars(){
  const W=640,rowH=36,x0=130,max=Math.max(...MODES.map(m=>S[m].pre+S[m].ttft+S[m].gen+S[m].check))*1.1;
  let svg=`<svg viewBox="0 0 ${W} ${MODES.length*rowH+44}" width="100%" role="img" aria-label="Average time per stage">`;
  MODES.forEach((m,i)=>{const s=S[m],y=i*rowH+4;let x=x0;svg+=`<text x="0" y="${y+17}" font-size="12" fill="#1e293b">${esc(NAME[m])}</text>`;
    for(const [k,col] of STAGES){const w=s[k]/max*(W-x0-50);svg+=`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="24" fill="${col}"/>${w>34?`<text x="${x+w/2}" y="${y+16}" font-size="10" text-anchor="middle" fill="#1e293b">${(s[k]/1000).toFixed(1)}</text>`:''}`;x+=w;}
    svg+=`<text x="${x+6}" y="${y+16}" font-size="11.5" font-weight="600" fill="#1e293b">${sec(s.pre+s.ttft+s.gen+s.check)}</text>`;});
  let lx=0;const ly=MODES.length*rowH+18;for(const [,col,name] of STAGES){svg+=`<rect x="${lx}" y="${ly}" width="11" height="11" fill="${col}"/><text x="${lx+15}" y="${ly+9.5}" font-size="10" fill="#475569">${name}</text>`;lx+=name.length*5.6+30;}
  return svg+'</svg>';
}
const agentName=(a:string)=>({OPPORTUNITY_SPECIALIST:'Opportunities',LEARNING_SPECIALIST:'Learning (courses)'} as Record<string,string>)[a]??a.replace(/_SPECIALIST$/,'').toLowerCase().replace(/^./,c=>c.toUpperCase());
function teamTimeline(){
  const cands=rows.filter(r=>r.mode==='M'&&(r.orchestration?.level??0)>=3&&r.orchestration?.agents?.length);
  if(!cands.length)return {svg:'',r:null};
  const r=by(cands,x=>-x.orchestration.agents.length*1e6+Math.abs(x.wallMs-S.M.wall))[0];
  const ag=by(r.orchestration.agents as any[],a=>a.startMs*1e5+a.endMs);const t=r.timeline||{};
  const lanes:[string,number,number,string][]=[...ag.map(a=>[agentName(a.agent),a.startMs,a.endMs,a.status==='completed'?COLOR.M:'#dc2626'] as [string,number,number,string])];
  if(t.pre!=null){lanes.push(['Oala writes',t.pre,t.pre+t.ttft+t.gen,'#8b74d9']);lanes.push(['Checking',t.pre+t.ttft+t.gen,r.wallMs,'#f2b45a']);}
  const W=640,x0=130,rowH=20,span=r.wallMs*1.02,X=(ms:number)=>x0+ms/span*(W-x0-10);
  let svg=`<svg viewBox="0 0 ${W} ${lanes.length*rowH+40}" width="100%" role="img" aria-label="Specialists working in parallel">`;
  for(let s=0;s<=r.wallMs/1000;s+=2)svg+=`<line x1="${X(s*1000)}" y1="0" x2="${X(s*1000)}" y2="${lanes.length*rowH}" stroke="#eef2f7"/><text x="${X(s*1000)}" y="${lanes.length*rowH+13}" font-size="9" text-anchor="middle" fill="#94a3b8">${s} s</text>`;
  lanes.forEach(([n,a,b,col],i)=>{const y=i*rowH+3;svg+=`<text x="0" y="${y+11}" font-size="10.5" fill="#1e293b">${esc(n)}</text><rect x="${X(a)}" y="${y}" width="${Math.max(2,X(b)-X(a))}" height="14" rx="3" fill="${col}" opacity="0.9"/>`;});
  if(Number.isFinite(r.firstDeltaMs)){const x=X(r.firstDeltaMs);svg+=`<line x1="${x}" y1="0" x2="${x}" y2="${lanes.length*rowH}" stroke="#1e293b" stroke-dasharray="3 2"/><text x="${Math.min(x,W-90)}" y="${lanes.length*rowH+28}" font-size="9.5" fill="#1e293b" text-anchor="${x>W-90?'start':'middle'}">first words on screen</text>`;}
  return {svg:svg+'</svg>',r};
}
const tl=teamTimeline();
const barCell=(v:number,max:number,m:Mode,txt:string)=>`<td class="bar"><span style="width:${Math.max(0,v/max*72)}%;background:${COLOR[m]}"></span><em>${txt}</em></td>`;
const shortQ=(s:string,n=120)=>{const t=String(s||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1).replace(/\s\S*$/,'')+'…':t;};
const teamNote=(r:any)=>{const l=r?.orchestration?.level??0,n=r?.orchestration?.agents?.length??0;return !r?'':l===0||!n?'no team':l===1?'1 quick lookup':`team of ${n}`;};
const withheldTotal=MODES.map(m=>[m,S[m].withheld] as const).filter(([,n])=>n);
const scenarios=new Set(rows.map(r=>r.scenario)).size;

// Round history and changes are narrative from the eval rounds (not in this folder's data); the current-round figures are computed.
// ponytail: round-1 row is fixed text; recompute from round1/ with the same 3-way re-rank if it is ever re-run.
const ROUND1={rank:'1.64',others:'EXP-RAG 2.05, Vanilla 2.09',ma:'18.8 s',e:'13.7 s',v:'18.8 s'};
function whySection(){
  const fT=teamMed('F','wallMs'),fastest=MODES.every(m=>teamMed(m,'wallMs')>fT),fRanks=by([...MODES,'F'] as Mode[],teamRank),fLast=fRanks.at(-1)==='F';
  const mainQ=qTied?'Tied':qOrder[0]==='M'?'Best':qOrder[2]==='M'?'Lowest':'Middle';
  return `<h2>Why isn't Multi-Agent much faster?</h2>
<p>The helpers do work side by side, as the timeline above shows. But the final answer is still written by one model after they finish,
and that writer's careful thinking (a few seconds) is what makes the answers good. Working in parallel can shorten the gathering, not the writing.
We cut the team's part from 5–8 s to about 2 s after the data lookup.
Turning the writer's thinking down made Multi-Agent ${fastest?'the fastest mode':'faster'} on team questions (${sec(fT)} typical), but blind judges ranked those answers ${fLast?'last':`at ${teamRank('F').toFixed(2)} of 4`}.
So the default keeps careful thinking, and "Low" in the thinking menu is the fast option.</p>
<div class="box"><h3>Speed vs quality: the three versions we tried</h3>
<table><tr><th>Version</th><th>Quality vs the other two modes</th><th class="num">Typical time, team questions</th></tr>
<tr><td>First version: Pathway waits for the others, detailed helper notes <span class="small">(round 1)</span></td><td>Best: average place ${ROUND1.rank} vs ${ROUND1.others} (all 11 questions)</td><td class="num">${ROUND1.ma}<br><span class="small">EXP-RAG ${ROUND1.e}, Vanilla ${ROUND1.v}</span></td></tr>
<tr><td><b>Shipped default:</b> lean helpers all working in parallel, careful writer</td><td>${mainQ}: average place ${Q.M.rank.toFixed(2)} vs EXP-RAG ${Q.E.rank.toFixed(2)}, Vanilla ${Q.V.rank.toFixed(2)}</td><td class="num">${sec(teamMed('M','wallMs'))}<br><span class="small">EXP-RAG ${sec(teamMed('E','wallMs'))}, Vanilla ${sec(teamMed('V','wallMs'))}</span></td></tr>
<tr><td>Fast setting: writer thinking set to low</td><td>${fLast?'Lowest':'Not the best'}: average place ${teamRank('F').toFixed(2)} among 4</td><td class="num">${sec(fT)}</td></tr></table>
<p class="small">Each round used a different run of the questions, so compare within a row, not across rows.</p></div>
<div class="box"><h3>What we changed to make it faster</h3><ul>
<li>Helpers now answer in a smaller, fixed format, so each one takes about 2 s.</li>
<li>The Pathway helper works alongside the others instead of waiting for all of them.</li>
<li>The Market check no longer waits about 2 s for graph and forecast data. Oala still receives that data.</li>
<li>Answers name their sources, do not push a generic follow-up question, and name local providers when a place is given.</li>
<li>One kind of broken answer format is now repaired automatically, for every mode.</li></ul></div>`;
}
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Three chat modes compared</title><style>
@page{size:A4;margin:15mm 14mm}
body{font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#1e293b;font-size:11.5px;line-height:1.5;margin:0}
h1{font-size:25px;margin:0 0 2px;color:#111;letter-spacing:-.2px}h2{font-size:16px;margin:20px 0 8px;color:#111;border-bottom:2px solid #ede9fe;padding-bottom:4px;break-after:avoid}h3{font-size:12.5px;margin:12px 0 4px;break-after:avoid}
p{margin:4px 0 8px}.sub{color:#64748b;margin:0 0 12px}.lead{font-size:12.5px;line-height:1.6;background:#f8f7fd;border:1px solid #e6def6;border-radius:10px;padding:12px 14px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #e2e8f0;border-radius:10px;padding:10px 11px;break-inside:avoid}.card h3{margin:0 0 4px;font-size:13px}.card p{font-size:10.8px;margin:6px 0 0}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0 10px}.kpi{border:1px solid #e2e8f0;border-top:3px solid;border-radius:10px;padding:8px 10px;break-inside:avoid}.kpi b{display:block;font-size:19px;color:#111}.kpi span{color:#64748b;font-size:10.5px}
table{width:100%;border-collapse:collapse;margin:6px 0 10px;break-inside:avoid}tr{break-inside:avoid}th,td{border-bottom:1px solid #e2e8f0;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f8fafc;font-weight:600;font-size:10.5px;color:#334155}
td.num,th.num{text-align:right;white-space:nowrap}td.bar{position:relative;width:20%;padding:5px 4px}td.bar span{display:block;height:12px;border-radius:2px;opacity:.85}td.bar em{font-style:normal;position:absolute;right:6px;top:4px;font-size:10.5px;font-weight:600}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:0}.small{font-size:10px;color:#64748b}.fast{font-weight:600}.box{break-inside:avoid}
ul{margin:4px 0 8px 18px;padding:0}li{margin:2px 0;break-inside:avoid}table.q{break-inside:auto}.q td{font-size:10.5px}
</style></head><body>
<h1>Three ways to run Oala, compared</h1>
<p class="sub">Vanilla (AI Studio) · EXP-RAG · Multi-Agent &nbsp;·&nbsp; Yuzee AI Token Lab &nbsp;·&nbsp; test run ${esc(new Date(answers.generatedAt).toLocaleDateString('en-AU',{dateStyle:'long'}))}</p>
<p class="lead">${verdict}</p>

<h2>How each mode works</h2>
<div class="cards">
<div class="card"><h3><span class="dot" style="background:${COLOR.V}"></span>${NAME.V}</h3>${flow('V')}
<p>Oala gets the full instruction book on every question: about 46,000 tokens (a token is roughly three-quarters of a word).
It also gets facts looked up from our data warehouse. One model call writes the answer, then a review step checks it.
Simple and complete, but the model reads a lot of text it does not need.</p></div>
<div class="card"><h3><span class="dot" style="background:${COLOR.E}"></span>${NAME.E}</h3>${flow('E')}
<p>Oala keeps a short core set of rules that is stored and reused, so it is cheap to resend.
For each question it adds only the guidance, warehouse facts and memory of the chat that this question needs.
The model reads far less text for the same job.</p></div>
<div class="card"><h3><span class="dot" style="background:${COLOR.M}"></span>${NAME.M}</h3>${flow('M')}
<p>EXP-RAG plus a team of small, fast helper models. Each helper has one narrow job (profile, jobs, skills, market, courses, pathway, company or opportunities) and searches the warehouse for itself.
They work at the same time. Their findings are merged and checked against the evidence, and Oala writes one answer from them.
Simple questions skip the team.</p></div>
</div>

<h2>Quality</h2>
<p>Each answer was judged blind: ${judgeFiles.length===2?'two':judgeFiles.length} independent AI judges saw the answers shuffled and with the mode names hidden.
For every question they put the answers in order from best to worst and scored each one from 1 to 5 on five points.</p>
<div class="kpis">${MODES.map(m=>`<div class="kpi" style="border-top-color:${COLOR[m]}"><b>${Q[m].rank.toFixed(2)}</b><span>${esc(NAME[m])}: average place (1 = best, 3 = worst). First place in ${Q[m].firsts} of ${Q[m].n} judgements.</span></div>`).join('')}</div>
<table><tr><th>Average score (1 to 5)</th>${MODES.map(m=>`<th class="num"><span class="dot" style="background:${COLOR[m]}"></span>${esc(SHORT[m])}</th>`).join('')}</tr>
${CRIT.map(([k,label])=>`<tr><td>${label} <span class="small">(${k})</span></td>${MODES.map(m=>barCell(Q[m].crit[k]-1,4,m,Q[m].crit[k].toFixed(2))).join('')}</tr>`).join('')}
<tr><td><b>Total (out of 25)</b></td>${MODES.map(m=>barCell(Q[m].crit.total-5,20,m,Q[m].crit.total.toFixed(1))).join('')}</tr></table>
<p class="small">Bars start at the lowest possible score (1, or 5 for the total), so small differences are visible. ${Number.isFinite(agree)?`The two judges picked the same best answer on ${agree} of ${judgedTurns.length} questions.`:''}</p>
${hasF?`<p class="box"><b>Team questions only.</b> On the ${plural(teamIds.length,'question')} where Multi-Agent used its team, we also tried a fast setting (the writer thinks less). Ranked among four answers there (1 = best, 4 = worst): ${list(by([...MODES,'F'] as Mode[],teamRank).map(m=>`${esc(NAME[m])} ${teamRank(m).toFixed(2)}`))}.</p>`:''}

<h2>Speed</h2>
<div class="kpis">${MODES.map(m=>`<div class="kpi" style="border-top-color:${COLOR[m]}"><b>${sec(S[m].wall)}</b><span>${esc(NAME[m])}: typical time to a finished answer. First words after ${sec(S[m].first)}. Fastest on ${fastestOn(m)} of ${turnIds.length} questions.</span></div>`).join('')}</div>
<p class="small">"Typical" is the median: half the answers were quicker, half were slower.</p>
<table><tr><th rowspan="2">Typical (median) time</th><th class="num" colspan="2">All ${plural(turnIds.length,'question')}</th>${hasF?`<th class="num" colspan="2">Team questions only (${teamIds.length})</th>`:''}</tr>
<tr><th class="num">Finished answer</th><th class="num">First words</th>${hasF?'<th class="num">Finished answer</th><th class="num">First words</th>':''}</tr>
${([...MODES,...(hasF?['F']:[])] as Mode[]).map(m=>`<tr><td><span class="dot" style="background:${COLOR[m]}"></span>${esc(NAME[m])}</td>${m==='F'?'<td class="num">–</td><td class="num">–</td>':`<td class="num">${sec(S[m].wall)}</td><td class="num">${sec(S[m].first)}</td>`}${hasF?`<td class="num">${sec(teamMed(m,'wallMs'))}</td><td class="num">${sec(teamMed(m,'firstDeltaMs'))}</td>`:''}</tr>`).join('')}</table>
${hasF?`<p class="small">The fast setting was only run on the team questions, so it has no all-question figures and is left out of the summary above.</p>`:''}
<div class="box"><h3>Where the time goes (average seconds per answer)</h3>${stackedBars()}</div>
${tl.r?`<div class="box"><h3>Inside one Multi-Agent answer: the team works side by side</h3>
<p>Question: <i>"${esc(shortQ(tl.r.user,150))}"</i>. Each bar is one helper. Bars that overlap ran at the same time. Then Oala writes the answer and it is checked.</p>
${tl.svg}</div>`:''}
<p>Multi-Agent ran a team of helpers on ${plural(levelCount(l=>l>=2),'question')}, one quick lookup on ${levelCount(l=>l===1)}, and skipped the team on ${levelCount(l=>l===0)}.
While the team works, the screen shows live progress, so the wait before the first words is not a blank screen.</p>
${hasF?whySection():''}

<h2>Cost</h2>
<div class="kpis">${MODES.map(m=>`<div class="kpi" style="border-top-color:${COLOR[m]}"><b>${usd(S[m].cost)}</b><span>${esc(NAME[m])}: average cost per answer, ${cents(S[m].cost)}. That is about ${Math.round(1/S[m].cost).toLocaleString()} answers per US dollar.</span></div>`).join('')}</div>
<table><tr><th>Per answer, on average</th>${MODES.map(m=>`<th class="num">${esc(SHORT[m])}</th>`).join('')}</tr>
<tr><td>Main answer</td>${MODES.map(m=>`<td class="num">${usd(S[m].main)}</td>`).join('')}</tr>
<tr><td>Helper calls (review, lookups${S.M.aux>S.E.aux*1.5?', and the Multi-Agent team':''})</td>${MODES.map(m=>`<td class="num">${usd(S[m].aux)}</td>`).join('')}</tr>
<tr><td><b>Total</b></td>${MODES.map(m=>`<td class="num"><b>${usd(S[m].cost)}</b></td>`).join('')}</tr>
<tr><td>Text the main model reads <span class="small">(tokens; about ¾ of a word each)</span></td>${MODES.map(m=>`<td class="num">${Number.isFinite(S[m].input)?Math.round(S[m].input).toLocaleString():'–'}</td>`).join('')}</tr></table>
<p>Costs use Google Gemini list prices for the recorded usage. Vanilla is dearer mainly because it resends the whole instruction book every time.</p>

<h2>Question by question</h2>
<table class="q"><tr><th>Question</th><th>Best answer<br><span class="small">(judges' average)</span></th>${MODES.map(m=>`<th class="num">${esc(SHORT[m])}</th>`).join('')}</tr>
${turnIds.map(id=>{const any=rows.find(r=>r.id===id);const w=turnWinners(id);const fast=by(MODES.filter(m=>row(id,m)),m=>row(id,m).wallMs)[0];
  return `<tr><td>${any.turn>1?'<span class="small">(follow-up)</span> ':''}${esc(shortQ(any.user))}</td><td>${w.length?w.map(m=>`<span class="dot" style="background:${COLOR[m]}"></span>${esc(SHORT[m])}`).join('<br>'):'–'}${w.length>1?' <span class="small">(tie)</span>':''}</td>
  ${MODES.map(m=>{const r=row(id,m);return `<td class="num">${r?`<span class="${m===fast?'fast':''}">${sec(r.wallMs)}</span>${r.accepted===false?'<br><span class="small">no answer shown</span>':''}${m==='M'?`<br><span class="small">${teamNote(r)}</span>${row(id,'F')?`<br><span class="small">fast setting ${sec(row(id,'F').wallMs)}</span>`:''}`:''}`:'–'}</td>`;}).join('')}</tr>`;}).join('')}
</table>
<p class="small">Times are from the question being sent to the finished answer. The quickest mode for each question is in bold.</p>

<div class="box"><h2>Method and limits</h2>
<ul>
<li>${plural(turnIds.length,'question')} from ${plural(scenarios,'conversation')}, including follow-up questions. Each mode answered each question once.</li>
<li>All modes used the same main model (${esc(answers.model)}), the same warehouse data and the same answer checks. Only the way the prompt is built differs.</li>
<li>The tests ran on a separate copy of the server, so no real users or shared data were involved.</li>
<li>Answers were judged blind by ${judgeFiles.length===2?'two':judgeFiles.length} AI judges. AI judges can be wrong, and they do not always agree.</li>
${withheldTotal.length?`<li>${list(withheldTotal.map(([m,n])=>`${plural(n,`${SHORT[m]} answer`)}`))} failed the format check and ${withheldTotal.reduce((a,[,n])=>a+n,0)===1?'was':'were'} not shown to the user; the judges saw "no answer" there.</li>`:''}
<li>This is a small sample. A different set of questions could change the order, especially where the gaps are small.</li>
<li>Gemini's speed changes from run to run and hour to hour, so treat time differences under a couple of seconds as noise.</li>
${hasF?`<li>Vanilla and EXP-RAG answers, and the Multi-Agent answers to simple questions, come from one test session (round 3). Multi-Agent team answers and the fast setting come from a session about an hour later (round 4), so speed carries some session-to-session noise.</li>
<li>Round 3's Multi-Agent team answers used an earlier low-thinking setup and are not in the headline.</li>
<li>Total Gemini spend for all evaluation rounds, including warm-ups and smoke tests, was about $0.42.</li>`:''}
</ul>
<p class="small">Source data: ${esc(dir.replace(/\\/g,'/'))} (answers.json, key.json, ${judgeFiles.join(', ')}).</p></div>
</body></html>`;

fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(`${out}.html`,html);
const browser=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p=>p&&fs.existsSync(p));
if(!browser){console.log(`wrote ${out}.html (no Chrome/Edge found for PDF)`);process.exit(0);}
execFileSync(browser,['--headless=new','--disable-gpu','--no-pdf-header-footer',`--print-to-pdf=${path.resolve(out+'.pdf')}`,'file:///'+path.resolve(out+'.html').replace(/\\/g,'/')],{stdio:'ignore',timeout:60000});
console.log(`wrote ${out}.html and ${out}.pdf`);
