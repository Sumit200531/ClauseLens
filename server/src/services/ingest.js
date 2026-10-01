import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import { getProvider } from '../ai/index.js';
import { chunkPages } from '../rag/chunker.js';
import { COVERAGE_SYSTEM, COVERAGE_QUERIES } from '../rag/prompts.js';
import { retrieve, allChunks, invalidate } from './retrieve.js';

const KINDS = ['benefit', 'waiting', 'exclusion', 'limit', 'copay', 'claim'];
const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : null);

export function sanitizeCoverage(raw = {}) {
  return {
    planName: clip(raw.planName, 120),
    insurer: clip(raw.insurer, 120),
    sumInsured: clip(raw.sumInsured, 60),
    summary: clip(raw.summary, 500),
    highlights: (Array.isArray(raw.highlights) ? raw.highlights : [])
      .filter((h) => h && h.label && h.value)
      .slice(0, 16)
      .map((h) => ({
        label: clip(String(h.label), 60),
        value: clip(String(h.value), 200),
        kind: KINDS.includes(h.kind) ? h.kind : 'benefit',
        page: Number.isFinite(Number(h.page)) ? Number(h.page) : undefined,
      })),
  };
}

/** Full pipeline: pages -> chunks -> embeddings -> coverage map. Updates progress as it goes. */
export async function ingest(docId, pages) {
  const provider = getProvider();
  const set = (fields) => Document.updateOne({ _id: docId }, { $set: fields });

  try {
    await set({ status: 'chunking', progress: 15, pageCount: pages.length });
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new Error('No readable text found in this PDF.');

    await set({ status: 'embedding', progress: 25, chunkCount: chunks.length });
    const vectors = [];
    const BATCH = 32;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      vectors.push(...(await provider.embed(batch.map((c) => `${c.section || ''}\n${c.text}`), { type: 'document' })));
      await set({ progress: 25 + Math.round(((i + batch.length) / chunks.length) * 50) });
    }

    await Chunk.deleteMany({ doc: docId });
    await Chunk.insertMany(chunks.map((c, i) => ({ ...c, doc: docId, embedding: vectors[i] })));
    invalidate(docId);
    await set({ status: 'mapping', progress: 80, embedModel: provider.embedId });

    // Multi-query retrieval to collect the clauses that matter most for claims.
    const doc = await Document.findById(docId).lean();
    const seen = new Map();
    for (const q of COVERAGE_QUERIES) {
      for (const s of await retrieve(doc, q, 3)) seen.set(s.idx, s);
    }
    const selected = [...seen.values()].sort((a, b) => a.idx - b.idx);
    const prompt = selected.map((s) => `(page ${s.page}${s.section ? `, ${s.section}` : ''})\n${s.text}`).join('\n\n');
    const raw = await provider.generateJson({
      system: COVERAGE_SYSTEM,
      prompt,
      context: { chunks: await allChunks(docId), title: doc.title },
    });

    await set({ status: 'ready', progress: 100, coverage: sanitizeCoverage(raw) });
  } catch (err) {
    console.error('[ingest]', err.message);
    await set({ status: 'failed', error: err.message.slice(0, 300) });
  }
}
