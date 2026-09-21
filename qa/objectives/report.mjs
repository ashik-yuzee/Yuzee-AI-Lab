import fs from 'node:fs/promises';
import path from 'node:path';
const csv=rows=>rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const count=xs=>Object.fromEntries([...new Set(xs)].map(k=>[k,xs.filter(x=>x===k).length]));
export async function writeReports(dir,metadata,results,registry){
  const out=path.join(dir,'reports');await fs.mkdir(out,{recursive:true});
  const objectives=[...new Set(results.map(r=>r.objective_id))].map(id=>{
    const rr=results.filter(r=>r.objective_id===id&&r.suite==='prepared'),total=registry.tests.filter(t=>t.tool_id===id).length;
    return {objective_id:id,total_prepared:total,executed:rr.length,hard_pass:rr.filter(r=>r.hard_pass).length,
      pass:rr.filter(r=>r.status==='PASS').length,fixture_blocked:rr.filter(r=>r.fixture_issues.length).length,
      production_status:'NOT_PRODUCTION_VALIDATED',failure_codes:[...new Set(rr.flatMap(r=>r.failures.map(f=>f.code)))]};
  });
  const summary={...metadata,completed:results.length,status_counts:count(results.map(r=>r.status)),
    prepared:results.filter(r=>r.suite==='prepared').length,supplemental:results.filter(r=>r.suite==='supplemental').length,
    hard_pass:results.filter(r=>r.hard_pass).length,retried:results.filter(r=>r.attempts>1).length,
    first_attempt_hard_pass:results.filter(r=>r.first_attempt_pass).length,
    family_results:Object.fromEntries([...new Set(registry.objectives.map(o=>o.primary_category))].map(f=>{const ids=registry.objectives.filter(o=>o.primary_category===f).map(o=>o.tool_id);return [f,count(results.filter(r=>ids.includes(r.objective_id)).map(r=>r.status))];})),
    objectives,results};
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify(summary,null,2));
  await fs.writeFile(path.join(out,'objective-results.csv'),csv([['objective_id','prepared_cases','executed','hard_pass','overall_pass','fixture_blocked','production_status','failure_codes'],...objectives.map(o=>[o.objective_id,o.total_prepared,o.executed,o.hard_pass,o.pass,o.fixture_blocked,o.production_status,o.failure_codes.join('; ')])]));
  await fs.writeFile(path.join(out,'test-results.csv'),csv([['test_id','objective_id','suite','status','hard_pass','attempts','latency_ms','failure_codes','fixture_issues'],...results.map(r=>[r.test_id,r.objective_id,r.suite,r.status,r.hard_pass,r.attempts,r.latency_ms,r.failures.map(f=>f.code).join('; '),r.fixture_issues.join('; ')])]));
  await fs.writeFile(path.join(out,'failures.json'),JSON.stringify(results.filter(r=>r.status!=='PASS'),null,2));
  const md=`# Yuzee objective harness smoke results\n\nRun: ${metadata.run_id}\n\nModel: ${metadata.model}, ${metadata.api} API. Original workbook V2 prompts unchanged.\n\nExecuted ${results.length}/${metadata.test_count} selected cases: ${summary.prepared} prepared, ${summary.supplemental} separate synthetic cases.\n\nHard validator passes: ${summary.hard_pass}/${results.length}. First-attempt hard passes: ${summary.first_attempt_hard_pass}/${results.length}. Retries: ${summary.retried}.\n\n${Object.entries(summary.status_counts).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\n## Interpretation\n\nSchema passes are not production validation. Missing fixtures are not counted as model-only failures. Semantic evaluator responses are independent calls to the same model, not human certification. No production code, routing, 103-skill registry or right-side workspace behaviour was changed.\n\nThe full 3,140-case acceptance run is gated on concrete context/evidence fixtures and resolved schema annotations. Single-turn tests cannot establish multi-turn stopping, persistence, current-data connectors or BGE objective selection.\n\n## Objective results\n\n| Objective | Prepared runs | Hard pass | Overall pass | Fixture gaps |\n|---|---:|---:|---:|---:|\n${objectives.map(o=>`| ${o.objective_id} | ${o.executed}/${o.total_prepared} | ${o.hard_pass} | ${o.pass} | ${o.fixture_blocked} |`).join('\n')}\n\n## Next work\n\n1. Review failures against raw responses and separate contract/fixture defects from model defects.\n2. Materialise missing confirmed facts, completed results, conflicts and current-source fixtures without changing prepared user prompts or expected behaviour.\n3. Finalise typed UI payloads and approved read/tool/navigation catalogues.\n4. Re-run complete affected objective suites before promoting any objective.\n5. Run full validation, human review of decision-critical failures and separate router/multi-turn tests before integration.\n`;
  await fs.writeFile(path.join(out,'run-summary.md'),md);
  return summary;
}
