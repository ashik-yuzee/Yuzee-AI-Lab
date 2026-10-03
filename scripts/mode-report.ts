/**
 * Renders the EXP-RAG vs Vanilla comparison as an HTML report and prints it to PDF with local headless Chrome/Edge.
 *   npm run report:modes -- --report=tmp/mc-final.json --history=tmp/mc-history.json --out=docs/reports/exp-rag-vs-vanilla
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const arg=(k:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const data=JSON.parse(fs.readFileSync(arg('report')||'tmp/mc-final.json','utf8'));
const history:Array<Record<string,any>>=arg('history')&&fs.existsSync(arg('history')!)?JSON.parse(fs.readFileSync(arg('history')!,'utf8')):[];
const out=arg('out')||'docs/reports/exp-rag-vs-vanilla';
const notes:{changes:Array<[string,string]>;findings:string[];limitations:string[]}=arg('notes')?JSON.parse(fs.readFileSync(arg('notes')!,'utf8')):{changes:[],findings:[],limitations:[]};

const rows:any[]=data.rows;const variants:string[]=data.variants;
const KEYS=['relevance','grounding','counselling','clarity','continuity'];
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const med=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s.length?(s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2):0;};
const esc=(s:unknown)=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const label=(v:string)=>v==='bge'?'EXP-RAG · BGE':v==='gemini'?'EXP-RAG · Gemini':v;

// Per-mode aggregates. Timing breakdown uses only turns where the stage timings were recorded.
function stats(runs:any[]){
  const timed=runs.filter(r=>r.pre!=null&&r.ttft!=null&&r.gen!=null);
  return {n:runs.length,cost:avg(runs.map(r=>r.cost)),ms:avg(runs.map(r=>r.ms)),median:med(runs.map(r=>r.ms)),
    pre:avg(timed.map(r=>r.pre)),ttft:avg(timed.map(r=>r.ttft)),gen:avg(timed.map(r=>r.gen)),after:avg(timed.map(r=>r.ms-r.pre-r.ttft-r.gen)),timed:timed.length,
    input:avg(runs.map(r=>r.input)),cached:avg(runs.map(r=>r.cached)),output:avg(runs.map(r=>r.output)),thinking:avg(runs.map(r=>r.thinking)),ok:runs.filter(r=>r.ok).length};
}
const V=stats(rows.map(r=>r.vanilla.run));
const E:Record<string,ReturnType<typeof stats>>=Object.fromEntries(variants.map(v=>[v,stats(rows.map(r=>r.variants[v].run))]));
const verdicts=Object.fromEntries(variants.map(v=>{const xs=rows.map(r=>r.variants[v]);return [v,{
  exp:xs.filter(x=>x.winner==='EXP').length,vanilla:xs.filter(x=>x.winner==='VANILLA').length,tie:xs.filter(x=>x.winner==='tie').length,
  scores:Object.fromEntries([...KEYS,'total'].map(k=>[k,{vanilla:avg(xs.map(x=>Number(x.scores.vanilla[k])||0)),exp:avg(xs.map(x=>Number(x.scores.exp[k])||0))}]))}];}));
// Sign test on decisive pairs (ties excluded): one-sided P(X >= wins) under p = 0.5.
const signP=(w:number,l:number)=>{const n=w+l;if(!n)return 1;let p=0;const c=(n:number,k:number)=>{let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r;};for(let k=w;k<=n;k++)p+=c(n,k)/2**n;return p;};
const pct=(a:number,b:number)=>b?((a-b)/b*100):0;
const fmtPct=(x:number)=>{const r=Math.round(x);return `${r>0?'+':''}${r===0?0:r}%`;};
const s1=(x:number)=>(x/1000).toFixed(1)+' s';

// Inline SVG charts (no external libraries; prints cleanly).
function stackedLatency(){
  const modes=[['Vanilla',V],...variants.map(v=>[label(v),E[v]] as const)] as Array<[string,ReturnType<typeof stats>]>;
  const max=Math.max(...modes.map(([,s])=>s.pre+s.ttft+s.gen+s.after))*1.08;const W=620,rowH=34,x0=150;
  const parts:[keyof ReturnType<typeof stats>,string,string][]=[['pre','#94a3b8','Before model call'],['ttft','#6d4bc3','Time to first token'],['gen','#a78bfa','Generation'],['after','#f59e0b','Review + checks']];
  let svg=`<svg viewBox="0 0 ${W} ${modes.length*rowH+46}" width="100%" role="img" aria-label="Latency breakdown">`;
  modes.forEach(([name,s],i)=>{let x=x0;const y=i*rowH+6;svg+=`<text x="0" y="${y+17}" font-size="12" fill="#1e293b">${esc(name)}</text>`;
    for(const [k,color] of parts){const w=(Number(s[k])/max)*(W-x0-60);svg+=`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="24" fill="${color}"/>`;x+=w;}
    svg+=`<text x="${x+6}" y="${y+17}" font-size="12" fill="#1e293b">${s1(s.pre+s.ttft+s.gen+s.after)}</text>`;});
  let lx=0;const ly=modes.length*rowH+24;for(const [,color,name] of parts){svg+=`<rect x="${lx}" y="${ly}" width="12" height="12" fill="${color}"/><text x="${lx+16}" y="${ly+10}" font-size="11" fill="#475569">${name}</text>`;lx+=150;}
  return svg+'</svg>';
}
function winBars(){
  const W=620,rowH=34,x0=150;let svg=`<svg viewBox="0 0 ${W} ${variants.length*rowH+40}" width="100%" role="img" aria-label="Head-to-head results">`;
  variants.forEach((v,i)=>{const r=verdicts[v];const n=r.exp+r.vanilla+r.tie;const y=i*rowH+6;let x=x0;svg+=`<text x="0" y="${y+17}" font-size="12" fill="#1e293b">${esc(label(v))}</text>`;
    for(const [k,color,txt] of [['exp','#16a34a','EXP-RAG wins'],['tie','#cbd5e1','Tie'],['vanilla','#dc2626','Vanilla wins']] as const){const c=(r as any)[k];const w=c/n*(W-x0-10);
      svg+=`<rect x="${x}" y="${y}" width="${w}" height="24" fill="${color}"/>${c?`<text x="${x+w/2}" y="${y+17}" font-size="12" text-anchor="middle" fill="${k==='tie'?'#1e293b':'#fff'}">${c}</text>`:''}`;x+=w;}});
  const ly=variants.length*rowH+20;svg+=`<rect x="0" y="${ly}" width="12" height="12" fill="#16a34a"/><text x="16" y="${ly+10}" font-size="11" fill="#475569">EXP-RAG wins</text><rect x="130" y="${ly}" width="12" height="12" fill="#cbd5e1"/><text x="146" y="${ly+10}" font-size="11" fill="#475569">Tie</text><rect x="200" y="${ly}" width="12" height="12" fill="#dc2626"/><text x="216" y="${ly+10}" font-size="11" fill="#475569">Vanilla wins</text>`;
  return svg+'</svg>';
}

const best=variants.reduce((a,b)=>verdicts[b].exp-verdicts[b].vanilla>verdicts[a].exp-verdicts[a].vanilla?b:a);
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>EXP-RAG vs Vanilla</title><style>
@page{size:A4;margin:16mm 14mm}
body{font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#1e293b;font-size:11.5px;line-height:1.5;margin:0}
h1{font-size:24px;margin:0 0 4px;color:#111}h2{font-size:16px;margin:22px 0 8px;color:#111;border-bottom:2px solid #ede9fe;padding-bottom:4px}h3{font-size:13px;margin:14px 0 6px}
.sub{color:#64748b;margin:0 0 14px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}
.kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px}.kpi b{display:block;font-size:20px;color:#111}.kpi span{color:#64748b;font-size:10.5px}
table{width:100%;border-collapse:collapse;margin:6px 0 10px}th,td{border-bottom:1px solid #e2e8f0;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f8fafc;font-weight:600;font-size:10.5px;color:#334155}
td.num,th.num{text-align:right;white-space:nowrap}.win{color:#15803d;font-weight:600}.loss{color:#b91c1c;font-weight:600}.tie{color:#64748b}
.note{background:#f8f7fd;border:1px solid #e6def6;border-radius:10px;padding:10px 12px;margin:8px 0}ul{margin:4px 0 8px 18px;padding:0}li{margin:2px 0}
.small{font-size:10px;color:#64748b}.pb{break-before:page}code{font-family:Consolas,monospace;font-size:10.5px;background:#f1f5f9;padding:0 3px;border-radius:3px}
</style></head><body>
<h1>EXP-RAG vs Vanilla (AI Studio)</h1>
<p class="sub">Yuzee AI Token Lab · generated ${esc(new Date(data.generatedAt).toLocaleString('en-AU',{dateStyle:'long',timeStyle:'short'}))} · model ${esc(data.model)} (medium thinking, both modes) · judge ${esc(data.judge)} (blind, pairwise)</p>

<div class="kpis">
${variants.map(v=>`<div class="kpi"><b>${verdicts[v].exp}–${verdicts[v].vanilla}–${verdicts[v].tie}</b><span>${esc(label(v))}: wins–losses–ties vs Vanilla (${rows.length} turns)</span></div>`).join('')}
<div class="kpi"><b>${fmtPct(pct(E[best].median,V.median))}</b><span>Median latency, ${esc(label(best))} vs Vanilla (${s1(E[best].median)} vs ${s1(V.median)})</span></div>
<div class="kpi"><b>${fmtPct(pct(E[best].cost,V.cost))}</b><span>Cost per turn, ${esc(label(best))} ($${E[best].cost.toFixed(4)} vs $${V.cost.toFixed(4)})</span></div>
</div>

<h2>Summary</h2>
<ul>${notes.findings.map(f=>`<li>${f}</li>`).join('')}</ul>

<h2>Head-to-head quality</h2>
${winBars()}
<table><tr><th>Criterion (1–5)</th><th class="num">Vanilla</th>${variants.map(v=>`<th class="num">${esc(label(v))}</th>`).join('')}</tr>
${[...KEYS,'total'].map(k=>`<tr><td>${k==='total'?'<b>Total (of 25)</b>':k[0].toUpperCase()+k.slice(1)}</td><td class="num">${(avg(variants.map(v=>verdicts[v].scores[k].vanilla))).toFixed(2)}</td>${variants.map(v=>`<td class="num">${verdicts[v].scores[k].exp.toFixed(2)}</td>`).join('')}</tr>`).join('')}
<tr><td>Sign test on decisive turns (one-sided p)</td><td class="num">—</td>${variants.map(v=>`<td class="num">${signP(verdicts[v].exp,verdicts[v].vanilla).toFixed(3)}</td>`).join('')}</tr></table>
<p class="small">Vanilla scores are averaged across the judge's two pairings. Ties are excluded from the sign test.</p>

<h2>Speed and cost</h2>
${stackedLatency()}
<table><tr><th>Per turn</th><th class="num">Vanilla</th>${variants.map(v=>`<th class="num">${esc(label(v))}</th>`).join('')}</tr>
${([['Median latency',(s:any)=>s1(s.median)],['Mean latency',(s:any)=>s1(s.ms)],['Before model call',(s:any)=>s1(s.pre)],['Time to first token',(s:any)=>s1(s.ttft)],['Generation',(s:any)=>s1(s.gen)],['Review + checks',(s:any)=>s1(s.after)],
  ['Input tokens',(s:any)=>Math.round(s.input).toLocaleString()],['…of which cached',(s:any)=>Math.round(s.cached).toLocaleString()],['Output tokens',(s:any)=>Math.round(s.output).toLocaleString()],['Thinking tokens',(s:any)=>Math.round(s.thinking).toLocaleString()],
  ['Cost (USD)',(s:any)=>'$'+s.cost.toFixed(5)],['Valid protocol responses',(s:any)=>`${s.ok}/${s.n}`]] as Array<[string,(s:any)=>string]>)
  .map(([n,f])=>`<tr><td>${n}</td><td class="num">${f(V)}</td>${variants.map(v=>`<td class="num">${f(E[v])}</td>`).join('')}</tr>`).join('')}</table>

${history.length?`<h2>Tuning history</h2><table><tr><th>Round</th><th>Change tested</th><th class="num">Variant</th><th class="num">W–L–T</th><th class="num">Score V→E</th><th class="num">Median latency V→E</th><th class="num">Cost/turn V→E</th></tr>
${history.map(h=>`<tr><td>${esc(h.round)}</td><td>${esc(h.change)}</td><td class="num">${esc(h.variant)}</td><td class="num">${esc(h.wlt)}</td><td class="num">${esc(h.score)}</td><td class="num">${esc(h.latency)}</td><td class="num">${esc(h.cost)}</td></tr>`).join('')}</table>`:''}

${notes.changes.length?`<h2>What was changed</h2><table><tr><th>Change</th><th>Why</th></tr>${notes.changes.map(([c,w])=>`<tr><td>${c}</td><td>${w}</td></tr>`).join('')}</table>`:''}

<h2 class="pb">Per-turn results</h2>
<table><tr><th>Turn</th><th>Focus</th>${variants.map(v=>`<th>${esc(label(v))}</th>`).join('')}</tr>
${rows.map(r=>`<tr><td><code>${esc(r.id)}</code></td><td>${esc(r.focus)}</td>${variants.map(v=>{const x=r.variants[v];const cls=x.winner==='EXP'?'win':x.winner==='VANILLA'?'loss':'tie';
  return `<td><span class="${cls}">${x.winner==='EXP'?'EXP-RAG':x.winner==='VANILLA'?'Vanilla':'Tie'}</span> ${x.scores.vanilla.total}/${x.scores.exp.total}<br><span class="small">${esc(x.reason)}</span></td>`;}).join('')}</tr>`).join('')}</table>

<h2>Method</h2>
<ul>
<li>${rows.length} turns from ${new Set(rows.map(r=>r.id.split('#')[0])).size} scenarios (single-turn and multi-turn), sent to the live server with identical model, thinking level, warehouse data, Neo4j/TimesFM intelligence and review pipeline. Only the prompt/RAG assembly differs.</li>
<li>Each EXP-RAG answer is judged against the Vanilla answer to the same turn by ${esc(data.judge)} at temperature 0 with a fixed rubric (relevance, grounding, counselling, clarity, continuity). Answer order is alternated to cancel position bias; the judge is told today's date and how flattened tables are shown.</li>
<li>Answers are judged as users see them: protocol JSON rendered to visible text, internal ids excluded, comparison rows labelled.</li>
<li>Evaluation chats ran on an isolated server instance (no shared database).</li>
</ul>
${notes.limitations.length?`<h3>Limitations</h3><ul>${notes.limitations.map(l=>`<li>${l}</li>`).join('')}</ul>`:''}
<p class="small">Reproduce: <code>npm run eval:modes</code> then <code>npm run report:modes</code>. Raw answers and scores: <code>${esc(arg('report')||'')}</code>.</p>
</body></html>`;

fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(`${out}.html`,html);
const browser=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p=>p&&fs.existsSync(p));
if(!browser){console.log(`wrote ${out}.html (no Chrome/Edge found for PDF)`);process.exit(0);}
execFileSync(browser,['--headless=new','--disable-gpu','--no-pdf-header-footer',`--print-to-pdf=${path.resolve(out+'.pdf')}`,'file:///'+path.resolve(out+'.html').replace(/\\/g,'/')],{stdio:'ignore',timeout:60000});
console.log(`wrote ${out}.html and ${out}.pdf`);
