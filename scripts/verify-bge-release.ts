import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chooseNeed} from '../src/routing/turnNeeds';
import {bgeProfiles} from '../src/routing/bgeProfiles';
const browser=JSON.parse(await fs.readFile('output/bge-v2/browser-results.json','utf8'))[0];
const final=JSON.parse(await fs.readFile('output/bge-v2/browser-final-checks.json','utf8'));
const live=JSON.parse(await fs.readFile('output/bge-v2/live-integration.json','utf8'));
const s=final.summary;
assert.ok(s.correct>=40&&s.wrong<=1&&s.top1>=83);assert.equal(s.negativeRoutes,0);assert.equal(s.negativeSuggestions,0);assert.ok(s.suggestionsWithRelevant>=8);assert.equal(s.irrelevantOffers,0);
assert.ok(s.needsCorrect>=12&&s.pathwayCorrect>=14);assert.equal(s.serverMismatch,0);assert.equal(s.queuePass,true);
assert.equal(final.concurrency[1].cancelledReplies,0);assert.equal(final.concurrency[1].recovered,true);
// Detailed vectors precede the clarification guard. Recompute with current policy,
// and also require the fresh browser rerun to agree; do not rewrite historical results.
const needs=browser.newNeeds.map((r:any)=>({...r,hint:chooseNeed(r.rank,'Xenova/bge-small-en-v1.5')}));
assert.ok(needs.every((r:any)=>r.hint.status!=='selected'||r.hint.kind===r.expected));
assert.equal(needs.filter((r:any)=>(r.hint.kind||'other')===r.expected).length,s.newNeedsCorrect);
assert.equal(s.needsProfile,bgeProfiles.needs.version);assert.equal(s.newNeedsWrong,0);assert.equal(s.newPathwaysWrong,0);
assert.equal(final.clarificationRegression.status,'abstained');
assert.ok(browser.newPaths.every((r:any)=>r.hint.status!=='selected'||r.pass));
assert.equal(live.results.length,3);for(const r of live.results){assert.equal(r.validation.protocolAccepted,true);assert.equal(r.providerUsage.isMock,false);}
assert.equal(live.results[1].routing.toolId,'COURSE_011');assert.equal(live.results[2].routing.status,'abstained');
console.log('PASS recorded local release gates: frozen browser baseline, all unrelated requests rejected, improved needs/pathways, no wrong suggestions, shared queue and 3 real Gemini turns. Independent production certification remains outstanding.');
