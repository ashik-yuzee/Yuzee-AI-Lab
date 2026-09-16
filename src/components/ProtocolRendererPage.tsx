import React, {useState} from 'react';
import {ProtocolV13Renderer} from './ProtocolV13Renderer';
import {ChatStreamingStatus} from './ChatStreamingStatus';
import {outputReviewScenarios,outputReviewIssues} from '../ux/outputReview';
import {acceptedResponse,responseToReadableText} from '../ux/responsePresentation';
import {validateUserEventAgainstActiveInteraction} from '../protocol/validator';

export function ProtocolRendererPage({onBack}:{onBack:()=>void}) {
 const [group,setGroup]=useState('Counselling');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState(outputReviewScenarios[0].id);
 const [draft,setDraft]=useState('');
 const [custom,setCustom]=useState<any>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [simulateFailure,setSimulateFailure]=useState(false);
 const [revision,setRevision]=useState(0);
 const [phone,setPhone]=useState(false);
 const [stopped,setStopped]=useState(false);
 const [startedAt,setStartedAt]=useState(Date.now());
 const scenario=outputReviewScenarios.find(f=>f.id===selected)!;
 const response=custom||scenario.response;
 const filtered=outputReviewScenarios.filter(f=>f.group===group&&[f.label,f.request,f.expected].join(' ').toLowerCase().includes(search.toLowerCase()));
 function choose(id:string){setSelected(id);setCustom(null);setNotice('');setError('');setStopped(false);setRevision(r=>r+1);setStartedAt(Date.now());}
 return <div className="output-review h-full overflow-auto bg-[#f7f8fa]">
  <header className="border-b bg-white p-4 flex items-center gap-4"><button onClick={onBack} className="rounded-lg border px-3 py-2 shrink-0">Back to chat</button><div><h1 className="font-semibold text-lg">Counselling output review</h1><p className="text-sm text-slate-600">{outputReviewScenarios.length} designed examples · Uses the main chat components · No AI calls or provider requests</p></div></header>
  <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
   <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-950"><strong>What a good answer does:</strong> answer the request, respect the person’s constraints, make unknowns visible, then offer one useful next step when needed. These examples demonstrate expected behaviour; they do not prove a live model always follows it.</div>
   <nav aria-label="Review categories" className="flex flex-wrap gap-2">{['Counselling','Boxes & inputs','Waiting & recovery'].map(name=><button key={name} aria-pressed={group===name} className={'rounded-lg border px-4 py-3 text-sm '+(group===name?'bg-sky-800 text-white':'bg-white')} onClick={()=>{setGroup(name);setSearch('');choose(outputReviewScenarios.find(f=>f.group===name)!.id);}}>{name} <span>({outputReviewScenarios.filter(f=>f.group===name).length})</span></button>)}</nav>
   <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
    <aside className="bg-white rounded-xl border p-3 space-y-3"><label className="block text-sm font-medium" htmlFor="scenario-search">Find a scenario</label><input id="scenario-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Try parent, training or data" className="w-full border rounded-lg p-3 text-base"/><div aria-label="Example scenarios" className="max-h-64 lg:max-h-[620px] overflow-auto space-y-1">{filtered.map(f=><button key={f.id} data-scenario-id={f.id} aria-pressed={selected===f.id&&!custom} onClick={()=>choose(f.id)} className={'w-full text-left rounded-lg px-3 py-3 text-sm '+(selected===f.id&&!custom?'bg-sky-50 text-sky-900 font-semibold border border-sky-200':'hover:bg-slate-50 border border-transparent')}>{f.label}</button>)}{!filtered.length&&<p className="p-3 text-sm">No matching examples. Try a different word.</p>}</div></aside>
    <section className="min-w-0 space-y-4">
     <div className="bg-white border rounded-xl p-5 space-y-3"><h2 className="text-xl font-semibold">{custom?'Your JSON example':scenario.label}</h2><p className="text-sm text-slate-600"><strong>User says: </strong>{scenario.request}</p><p className="text-sm text-slate-700"><strong>Counselling expectation: </strong>{scenario.expected}</p><div className="flex flex-wrap gap-3 items-center text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={phone} onChange={e=>setPhone(e.target.checked)}/>Narrow preview</label><label className="flex items-center gap-2"><input type="checkbox" checked={simulateFailure} onChange={e=>setSimulateFailure(e.target.checked)}/>Fail the next example reply</label><button className="border rounded-lg px-3 py-2" onClick={()=>choose(selected)}>Reset example</button></div></div>
     <article data-review-preview className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm mx-auto w-full" style={phone?{maxWidth:390}:undefined}>
      <div className="mb-4 text-sm font-semibold text-sky-800">Oala <span className="text-slate-500 font-normal">· Designed example</span></div>
      {scenario.phase&&!custom&&!stopped&&<ChatStreamingStatus key={selected+'-'+revision} phase={scenario.phase} startedAt={startedAt-(scenario.state==='slow'?15000:0)} onStop={()=>setStopped(true)}/>}
      {(stopped||scenario.state==='stopped')&&!custom&&<div className="main-chat-stopped"><span>Stopped. Your question is still here.</span><button onClick={()=>{setStopped(false);setNotice('Example retry selected. In the live chat, this sends the saved question again.');}}>Try again</button></div>}
      {scenario.state==='invalid'&&!custom&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"><p>This response could not be displayed. Please try again.</p><button className="border rounded-lg px-3 py-2 bg-white" onClick={()=>setNotice('Example retry selected. No AI call is made on this page.')}>Try again</button></div>}
      {response&&<ProtocolV13Renderer key={selected+'-'+revision} data={response} readOnly={scenario.state==='earlier'} onInteract={async event=>{
       if(simulateFailure){setNotice('Connection failure simulated. Your answer stays in the form. Turn off the failure option and try again.');return false;}
       const result=event.userEvent?validateUserEventAgainstActiveInteraction(event,response.interaction):{valid:true,errors:[]};
       setNotice(result.valid?'Example answer accepted: '+event.value+'. In live chat, Gemini uses this answer to continue.':result.errors.join(' '));return result.valid;
      }}/>}
     </article>
     {notice&&<p role="status" className="border border-sky-200 bg-sky-50 rounded-xl p-4 text-sm whitespace-pre-line">{notice}</p>}
     {response&&<details className="rounded-xl border bg-white p-4 text-sm"><summary className="cursor-pointer">Inspect the readable output and JSON</summary><pre className="whitespace-pre-wrap break-words mt-4 font-sans">{responseToReadableText(response)}</pre><pre className="whitespace-pre-wrap break-all mt-5 text-xs">{JSON.stringify(response,null,2)}</pre></details>}
    </section>
   </div>
   <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">What works, what was fixed, and what still needs checking</summary><div className="grid sm:grid-cols-2 gap-4 mt-4">{outputReviewIssues.map(issue=><div key={issue.title} className="border rounded-xl p-4"><span className="text-xs font-semibold text-sky-800">{issue.status}</span><h3 className="font-semibold mt-1">{issue.title}</h3><p className="text-sm text-slate-600 mt-2">{issue.detail}</p></div>)}</div></details>
   <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">Try another JSON response</summary><div className="space-y-4 mt-4"><label className="block" htmlFor="response-json">Response JSON</label><textarea id="response-json" rows={7} value={draft} onChange={e=>setDraft(e.target.value)} className="w-full rounded-xl border p-3 font-mono text-sm"/><button className="rounded-lg bg-sky-800 text-white px-4 py-3" onClick={()=>{const parsed=acceptedResponse(draft);if(!parsed){setError('This response does not match the supported format. Check its fields and question before trying again.');return;}setCustom(parsed);setError('');setNotice('');setRevision(r=>r+1);}}>Preview response</button>{error&&<p role="alert" className="text-red-700">{error}</p>}</div></details>
  </main>
 </div>;
}
