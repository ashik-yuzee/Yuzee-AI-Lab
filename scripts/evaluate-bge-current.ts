/**
 * Standalone BGE-only held-out evaluation. No lock file, no MiniLM dependency.
 * Tests bgeCalibration.json against all 103 held-out skill cases,
 * 24 held-out negatives, 23 held-out suggestion cases, 16 needs, 16 pathway.
 */
import fs from 'node:fs/promises';
import {env} from '@huggingface/transformers';
import {loadEmbeddingModel} from '../src/routing/loadEmbeddingModel';
import {routerModel} from '../src/routing/models';
import {BGE_MODEL_ID, bgeMatchingIndex, rankBge} from '../src/routing/bgeMatching';
import {chooseRoute, routingSkipReason, abstain} from '../src/routing/policy';
import {selectSkillOffers} from '../src/routing/skillSuggestions';
import {heldoutNegatives, heldoutSuggestions} from '../tests/fixtures/bge-calibration-extra';
import {bgeNeedScenarios, bgePathwayScenarios} from '../src/routing/bgeTaskContent';
import {bgeProfiles, bgeQuery, taskRanking, rankNeeds} from '../src/routing/bgeProfiles';
import {chooseNeed} from '../src/routing/turnNeeds';
import {choosePathwayHint, pathwayScenarios} from '../src/miniPathway/policy';
import {needs as needFixtures, pathways as pathwayFixtures} from '../tests/fixtures/router-model-extra';

env.allowRemoteModels = false;
env.allowLocalModels = true;

const m = routerModel(BGE_MODEL_ID);
const e = await loadEmbeddingModel(m, {
  sourceDirectory: `./data/minilm-cache/${m.id}/${m.revision}`,
  device: 'cpu',
  local_files_only: true,
  session_options: {intraOpNumThreads: 1, interOpNumThreads: 1},
});

const encode = async (text: string) =>
  (await e(text, {pooling: 'cls', normalize: true})).data as Float32Array;

const dot = (a: Float32Array, b: Float32Array) => a.reduce((s, v, i) => s + v * b[i], 0);

console.log('Embedding skill index...');
const indexVectors: Float32Array[] = [];
for (const p of bgeMatchingIndex) indexVectors.push(await encode(p.text));

console.log('Embedding needs index...');
const needVectors: Float32Array[] = [];
for (const p of bgeNeedScenarios) needVectors.push(await encode(bgeQuery(p.text, 'needs')));

console.log('Embedding pathway index...');
// pathwayScenarios is the definitive list used by choosePathwayHint
const pathwayVectors: Float32Array[] = [];
for (const p of pathwayScenarios) pathwayVectors.push(await encode(p.text));

// ── SKILL ROUTING (103 held-out cases) ──────────────────────────────────────
console.log('\nEvaluating 103 held-out skill cases...');
const heldoutText = await fs.readFile('tests/fixtures/bge-heldout-skills.txt', 'utf8');
const skillCases = heldoutText.trim().split('\n').map(l => {
  const [expected, text] = l.split('|');
  return {expected, text};
});

const skillResults = [];
for (const c of skillCases) {
  const q = await encode(c.text);
  const rank = rankBge(q, indexVectors);
  const skip = routingSkipReason(c.text);
  const decision = skip ? abstain(skip) : chooseRoute(rank, BGE_MODEL_ID);
  const topic = chooseRoute(rank, BGE_MODEL_ID, 'topic');
  skillResults.push({
    expected: c.expected,
    text: c.text,
    top1: rank[0].toolId === c.expected,
    selected: decision.status === 'selected',
    correct: decision.toolId === c.expected,
    wrong: decision.status === 'selected' && decision.toolId !== c.expected,
    topicCorrect: topic.toolId === c.expected,
    reason: decision.status === 'abstained' ? (decision as any).reason : decision.status,
    toolId: (decision as any).toolId,
    score: (decision as any).score,
    margin: (decision as any).margin,
    domainMargin: (decision as any).domainMargin,
    top5: rank.slice(0, 4).map(r => r.toolId),
  });
}

// ── NEGATIVES (24 held-out) ──────────────────────────────────────────────────
console.log('Evaluating 24 held-out negatives...');
const negResults = [];
for (const text of heldoutNegatives) {
  const q = await encode(text);
  const rank = rankBge(q, indexVectors);
  const skip = routingSkipReason(text);
  const decision = skip ? abstain(skip) : chooseRoute(rank, BGE_MODEL_ID);
  const offer = selectSkillOffers([rank], BGE_MODEL_ID);
  negResults.push({text, decision, offerCount: offer.offers.length, routeSelected: decision.status === 'selected'});
}

// ── SUGGESTIONS (23 held-out) ────────────────────────────────────────────────
console.log('Evaluating 23 held-out suggestion cases...');
const sugResults = [];
for (const c of heldoutSuggestions) {
  const q = await encode(c.text);
  const rank = rankBge(q, indexVectors);
  const review = selectSkillOffers([rank], BGE_MODEL_ID);
  sugResults.push({
    text: c.text,
    allowed: c.allowed,
    offered: review.offers.map(o => o.toolId),
    relevant: review.offers.filter(o => c.allowed.includes(o.toolId)).length,
    irrelevant: review.offers.filter(o => !c.allowed.includes(o.toolId)).length,
  });
}

// ── NEEDS ASSESSMENT (16 fixtures) ──────────────────────────────────────────
console.log('Evaluating needs assessment (16 cases)...');
const needResults = [];
for (const [text, expected] of needFixtures) {
  const q = await encode(bgeQuery(text, 'needs'));
  const candidates = bgeNeedScenarios.map((p, i) => ({id: p.id, score: dot(q, needVectors[i])}));
  const result = chooseNeed(candidates, BGE_MODEL_ID);
  needResults.push({text, expected, got: result.kind ?? 'abstained', correct: result.kind === expected});
}

// ── PATHWAY DETECTION (16 fixtures) ─────────────────────────────────────────
console.log('Evaluating pathway detection (16 cases)...');
const pathwayResults = [];
for (const [text, expected] of pathwayFixtures) {
  const q = await encode(text);
  const candidates = pathwayScenarios.map((p, i) => ({id: p.id, score: dot(q, pathwayVectors[i])}));
  const result = choosePathwayHint(candidates, BGE_MODEL_ID);
  const got = result.status === 'selected';
  pathwayResults.push({text, expected, got, correct: got === expected, failedGates: result.failedGates});
}

await e.dispose();

// ── SUMMARY ──────────────────────────────────────────────────────────────────
const correct = skillResults.filter(r => r.correct).length;
const wrong = skillResults.filter(r => r.wrong).length;
const abstained = skillResults.filter(r => !r.selected).length;
const top1 = skillResults.filter(r => r.top1).length;

const summary = {
  skills: {
    total: 103,
    top1Accuracy: `${top1}/103 = ${(top1/103*100).toFixed(1)}%`,
    correct,
    wrong,
    abstained,
    precision: wrong === 0 ? 1 : +(correct / (correct + wrong)).toFixed(3),
    coverage: `${correct}/103 selected-correctly (${(correct/103*100).toFixed(1)}%)`,
    negativeRoutes: negResults.filter(r => r.routeSelected).length,
    negativeSuggestions: negResults.filter(r => r.offerCount > 0).length,
  },
  suggestions: {
    total: 23,
    withRelevant: sugResults.filter(r => r.relevant > 0).length,
    totalIrrelevantOffers: sugResults.reduce((n, r) => n + r.irrelevant, 0),
    totalOffers: sugResults.reduce((n, r) => n + r.offered.length, 0),
  },
  needs: {
    total: needFixtures.length,
    correct: needResults.filter(r => r.correct).length,
    breakdown: Object.fromEntries(
      ['answer', 'clarify', 'research'].map(k => [
        k,
        `${needResults.filter(r => r.expected === k && r.correct).length}/${needResults.filter(r => r.expected === k).length}`,
      ])
    ),
  },
  pathway: {
    total: pathwayFixtures.length,
    correct: pathwayResults.filter(r => r.correct).length,
    falsePositives: pathwayResults.filter(r => !r.expected && r.got).length,
    falseNegatives: pathwayResults.filter(r => r.expected && !r.got).length,
  },
};

console.log('\n══ RESULTS ════════════════════════════════════════');
console.log(JSON.stringify(summary, null, 2));

// Wrong routes
if (wrong > 0) {
  console.log('\n── WRONG ROUTES ─────────────────────────────────');
  skillResults.filter(r => r.wrong).forEach(r => {
    console.log(`  EXPECTED ${r.expected}, GOT ${r.toolId}`);
    console.log(`  score=${r.score?.toFixed(3)} margin=${r.margin?.toFixed(3)} dm=${r.domainMargin?.toFixed(3)}`);
    console.log(`  "${r.text}"`);
  });
}

// Abstained but top-1 was correct (missed coverage)
const wastedAbstain = skillResults.filter(r => !r.selected && r.top1);
console.log(`\n── ABSTAINED WITH CORRECT TOP-1 (${wastedAbstain.length} missed) ──`);
wastedAbstain.slice(0, 25).forEach(r => {
  console.log(`  ${r.expected} | reason=${r.reason} | score=${r.score?.toFixed(3)} m=${r.margin?.toFixed(3)} dm=${r.domainMargin?.toFixed(3)}`);
  console.log(`    "${r.text.slice(0, 80)}"`);
});

// Negatives that slipped through
const slippedNegs = negResults.filter(r => r.routeSelected);
if (slippedNegs.length > 0) {
  console.log('\n── NEGATIVES ROUTED (should be 0) ──────────────');
  slippedNegs.forEach(r => console.log(`  "${r.text}"`));
}

// Irrelevant suggestions
const badSuggestions = sugResults.filter(r => r.irrelevant > 0);
if (badSuggestions.length > 0) {
  console.log('\n── IRRELEVANT SUGGESTIONS ───────────────────────');
  badSuggestions.forEach(r => {
    console.log(`  Offered: [${r.offered.join(',')}] | Allowed: [${r.allowed.join(',')}]`);
    console.log(`  "${r.text.slice(0, 80)}"`);
  });
}

// Wrong needs
const wrongNeeds = needResults.filter(r => !r.correct);
if (wrongNeeds.length > 0) {
  console.log('\n── WRONG NEEDS ──────────────────────────────────');
  wrongNeeds.forEach(r => console.log(`  expected=${r.expected} got=${r.got} | "${r.text}"`));
}

// Wrong pathway
const wrongPathway = pathwayResults.filter(r => !r.correct);
if (wrongPathway.length > 0) {
  console.log('\n── WRONG PATHWAY ────────────────────────────────');
  wrongPathway.forEach(r => {
    console.log(`  expected=${r.expected} got=${r.got} failedGates=${JSON.stringify(r.failedGates)} | "${r.text}"`);
  });
}

await fs.writeFile('output/bge-calibration/current-eval.json',
  JSON.stringify({summary, skillResults, negResults, sugResults, needResults, pathwayResults}, null, 2));
console.log('\nFull results → output/bge-calibration/current-eval.json');
