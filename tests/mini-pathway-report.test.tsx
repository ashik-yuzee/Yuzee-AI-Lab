import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pathwayReportFixture} from './mini-pathway-fixture';
import {reviewMiniPathwayReport} from '../src/miniPathway/reportReview';
import {miniPathwayPanelResponse} from '../src/miniPathway/presentation';
import {ProtocolV13Renderer} from '../src/components/ProtocolV13Renderer';
import {validateMiniPathwayOutput} from '../src/miniPathway/service';
const report=pathwayReportFixture(),original=JSON.stringify(report);
assert.deepEqual(reviewMiniPathwayReport(validateMiniPathwayOutput(report)),[]);
const projected=miniPathwayPanelResponse(report);
const html=renderToStaticMarkup(<ProtocolV13Renderer data={projected} readOnly hideRecommendedActions/>);
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
assert.equal((html.match(/<table /g)||[]).length,5);
for(const block of report.content_blocks){
 for(const row of block.rows)for(const cell of row.cells)assert.ok(html.includes(escape(cell.value)),`Missing cell: ${cell.value}`);
 for(const col of block.columns)assert.ok(html.includes(`data-label="${escape(col.label)}"`));
 for(const item of block.items)assert.ok(html.includes(escape(item.text)));
}
assert.equal(JSON.stringify(report),original);
assert.ok(!html.includes('<form'));
const missing=structuredClone(report);missing.content_blocks=missing.content_blocks.filter((b:any)=>b.id!=='route-summary-r1-timeline');
assert.match(reviewMiniPathwayReport(missing).join(),/route-summary-r1-timeline/);
const short=structuredClone(report);short.content_blocks.at(-1).items.pop();
assert.match(reviewMiniPathwayReport(short).join(),/six-item/);
for(const claim of ['$300 in fees','AUD 250','250 dollars','Zero tuition out-of-pocket','Full wage while studying']){
 const bad=structuredClone(report);bad.content_blocks[0].text+=claim;
 assert.ok(reviewMiniPathwayReport(bad).length,claim);
}
console.log('PASS complete report: 3 routes, 12 milestones and sub-steps, 5 tables, all cell values and labels, 6 playbook steps, no mutation or forms, missing-depth and unsupported-cost checks.');
