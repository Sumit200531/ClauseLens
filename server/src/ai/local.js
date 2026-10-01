/**
 * Offline provider: no network, no key.
 * - Embeddings: feature hashing of words and word pairs into 512 dims.
 * - Answers: extractive. Picks the policy sentences that best match the
 *   question, cites them, and infers a verdict from their wording.
 * Lets the whole pipeline (and the demo) run anywhere.
 */
import { tokenize, splitSentences } from '../rag/text.js';

const DIM = 512;

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashEmbed(text) {
  const v = new Array(DIM).fill(0);
  const toks = tokenize(text);
  const feats = [...toks, ...toks.slice(1).map((t, i) => `${toks[i]}_${t}`)];
  for (const f of feats) {
    const h = fnv1a(f);
    v[h % DIM] += h & 0x80000000 ? -1 : 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

const NEG = /\b(not covered|excluded|exclusion|shall not|will not pay|does not cover|not payable|no cover)\b/i;
const COND = /\b(waiting period|only after|subject to|limited to|up to|maximum|only if|provided that|co-?payment|sub-?limit|pre-?authori[sz]ation|deduct)/i;
const POS = /\b(covered|will pay|shall pay|indemnif|reimburse|payable|we pay)\b/i;
// Words that appear in almost every clause and say nothing about the topic.
const GENERIC = new Set(['cover', 'covered', 'coverage', 'policy', 'plan', 'insured', 'insurance', 'claim', 'pay', 'paid', 'treatment', 'get', 'need', 'much', 'how', 'many']);

/** Verdict from the single best-matching sentence; conditions win over a plain yes. */
export function inferVerdict(best) {
  if (!best) return 'UNCLEAR';
  if (COND.test(best)) return 'CONDITIONAL';
  if (NEG.test(best)) return 'NOT_COVERED';
  if (POS.test(best)) return 'COVERED';
  return 'UNCLEAR';
}

export function extractiveAnswer(question, sources) {
  const q = new Set(tokenize(question).filter((t) => !GENERIC.has(t)));
  const scored = [];
  for (const s of sources.slice(0, 5)) {
    splitSentences(s.text).forEach((raw, i) => {
      const sent = raw.replace(/^\d+(\.\d+)*\s+/, '');
      const toks = tokenize(sent);
      const hits = new Set(toks.filter((t) => q.has(t))).size;
      if (hits) scored.push({ sent, n: s.n, score: hits / Math.sqrt(toks.length + 4) + (6 - s.n) * 0.03, order: s.n * 100 + i });
    });
  }
  const ranked = scored.sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    return 'VERDICT: UNCLEAR\n\nI could not find a clause in this policy that answers this. Ask your insurer directly and request the clause number in writing.';
  }
  // Keep sentences reasonably close in relevance to the best one.
  const picked = ranked.filter((r) => r.score >= ranked[0].score * 0.45).slice(0, 3).sort((a, b) => a.order - b.order);
  const verdict = inferVerdict(ranked[0].sent);
  const lead = {
    COVERED: 'Your policy appears to cover this.',
    NOT_COVERED: 'Your policy appears to exclude this.',
    CONDITIONAL: 'This is covered only if certain conditions are met.',
    UNCLEAR: 'The policy does not settle this clearly.',
  }[verdict];
  const body = picked.map((p) => `${p.sent.replace(/\s*$/, '')} [${p.n}]`).join(' ');
  return `VERDICT: ${verdict}\n\n${lead} Here is what the policy says: ${body}`;
}

const KIND_RULES = [
  ['waiting', /waiting period/i],
  ['exclusion', /\b(excluded|exclusion|not covered|shall not)\b/i],
  ['copay', /co-?payment/i],
  ['limit', /\b(room rent|sub-?limit|limited to|maximum of|up to|proportionate)\b/i],
  ['claim', /\b(intimat|notify|within \d+ (?:hours|days)|documents)\b/i],
  ['benefit', /\b(we will pay|covered|reimburse|indemnif)\b/i],
];

export function heuristicCoverage(chunks, title) {
  const highlights = [];
  const perKind = {};
  let sumInsured = null;
  for (const c of chunks) {
    for (const sent of splitSentences(c.text)) {
      if (!sumInsured) {
        const m = sent.match(/sum insured[^.]*?((?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d+)?|[\d]{1,3}(?:,\d{2,3})+)/i);
        if (m) sumInsured = m[1];
      }
      const rule = KIND_RULES.find(([, re]) => re.test(sent));
      if (!rule) continue;
      const kind = rule[0];
      if ((perKind[kind] = (perKind[kind] || 0) + 1) > 2) continue;
      const words = sent.split(/\s+/);
      highlights.push({
        label: (c.section || kind).replace(/^[\d.\s]+/, '').split(/\s+/).slice(0, 6).join(' '),
        value: words.slice(0, 18).join(' ') + (words.length > 18 ? '…' : ''),
        kind,
        page: c.page,
      });
    }
  }
  return {
    planName: title,
    insurer: null,
    sumInsured,
    summary: 'Key rules found in this policy. Running in offline mode, so this summary is extracted rather than written by a model.',
    highlights: highlights.slice(0, 12),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function localProvider() {
  return {
    name: 'local',
    embedId: 'local:hash-512',
    async embed(texts) {
      return texts.map(hashEmbed);
    },
    async generateJson({ context }) {
      return heuristicCoverage(context.chunks, context.title);
    },
    async stream({ question, sources, onToken }) {
      const text = extractiveAnswer(question, sources);
      for (const piece of text.match(/\S+\s*/g) || []) {
        onToken(piece);
        await sleep(14);
      }
      return text;
    },
  };
}
