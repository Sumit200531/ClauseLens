import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkPages, detectHeading } from '../src/rag/chunker.js';
import { BM25 } from '../src/rag/bm25.js';
import { cosine, reciprocalRankFusion } from '../src/rag/vector.js';
import { createVerdictParser, citedNumbers } from '../src/rag/verdict.js';
import { hashEmbed, extractiveAnswer, heuristicCoverage } from '../src/ai/local.js';
import { sanitizeCoverage } from '../src/services/ingest.js';
import { SAMPLE_PAGES } from '../src/sample/policy.js';

const pages = SAMPLE_PAGES.map((text, i) => ({ page: i + 1, text }));
const chunks = chunkPages(pages);

// Same hybrid retrieval the server runs, minus MongoDB.
function hybrid(query, k = 6) {
  const bm25 = new BM25(chunks.map((c) => `${c.section || ''} ${c.text}`));
  const vecs = chunks.map((c) => hashEmbed(`${c.section || ''}\n${c.text}`));
  const qv = hashEmbed(query);
  const lists = {
    keywords: bm25.search(query).map((r) => chunks[r.i].idx),
    meaning: vecs.map((v, i) => ({ i, s: cosine(qv, v) })).sort((a, b) => b.s - a.s).slice(0, 20).map((x) => chunks[x.i].idx),
  };
  return reciprocalRankFusion(lists, 60, { meaning: 0.2 }).slice(0, k).map((f, n) => ({ n: n + 1, ...chunks[f.id], via: f.via }));
}

test('detects numbered and all-caps headings, not sentences', () => {
  assert.ok(detectHeading('4.2 Specified disease waiting period'));
  assert.ok(detectHeading('5. EXCLUSIONS'));
  assert.ok(detectHeading('WHAT IS COVERED'));
  assert.equal(detectHeading('We will pay for room, boarding and nursing.'), null);
});

test('chunks keep page numbers and clause headings', () => {
  assert.ok(chunks.length >= 25);
  const knee = chunks.find((c) => /knee/.test(c.text));
  assert.equal(knee.page, 4);
  assert.match(knee.section, /4\.2/);
  assert.ok(chunks.every((c) => c.text.length <= 900));
});

test('hybrid retrieval puts the right clause first', () => {
  const top = hybrid('Is knee replacement surgery covered?');
  assert.match(top[0].section, /4\.2/);
  const dental = hybrid('Is dental treatment covered?');
  assert.match(dental[0].text, /Dental/);
});

test('reciprocal rank fusion rewards agreement between retrievers', () => {
  const fused = reciprocalRankFusion({ a: [1, 2, 3], b: [3, 1, 9] });
  assert.equal(fused[0].id, 1);
  assert.deepEqual(fused[0].via, ['a', 'b']);
  const weighted = reciprocalRankFusion({ a: [7], b: [8] }, 60, { b: 0.5 });
  assert.equal(weighted[0].id, 7);
});

test('verdict parser handles a verdict split across stream tokens', () => {
  const p = createVerdictParser();
  const out = ['VERD', 'ICT: NOT_CO', 'VERED\n\nDental ', 'is excluded [2].'].map((t) => p.push(t));
  assert.equal(out.find((o) => o.verdict).verdict, 'NOT_COVERED');
  assert.equal(out.map((o) => o.text || '').join(''), 'Dental is excluded [2].');
  assert.deepEqual(citedNumbers('a [2] b [5] c [2]'), [2, 5]);
});

test('verdict parser falls back to UNCLEAR when the model ignores the format', () => {
  const p = createVerdictParser();
  const r = p.push('Sure! Here is the answer about your policy and what it covers in detail.');
  assert.equal(r.verdict, 'UNCLEAR');
});

test('offline answers: conditional and excluded cases', () => {
  const knee = extractiveAnswer('Is knee replacement covered?', hybrid('Is knee replacement covered?'));
  assert.match(knee, /^VERDICT: CONDITIONAL/);
  assert.match(knee, /24 months/);
  const dental = extractiveAnswer('Is dental treatment covered?', hybrid('Is dental treatment covered?'));
  assert.match(dental, /^VERDICT: NOT_COVERED/);
});

test('offline coverage map finds waiting periods, exclusions and sum insured', () => {
  const cov = sanitizeCoverage(heuristicCoverage(chunks, 'Sample'));
  assert.equal(cov.sumInsured, '₹5,00,000');
  for (const kind of ['waiting', 'exclusion', 'limit', 'copay']) assert.ok(cov.highlights.some((h) => h.kind === kind), kind);
});

test('sanitizeCoverage drops junk from a model response', () => {
  const cov = sanitizeCoverage({ highlights: [{ label: 'x', value: 'y', kind: 'weird', page: '3' }, { label: '' }], summary: 7 });
  assert.equal(cov.highlights.length, 1);
  assert.equal(cov.highlights[0].kind, 'benefit');
  assert.equal(cov.highlights[0].page, 3);
  assert.equal(cov.summary, null);
});
