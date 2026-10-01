import mongoose from 'mongoose';
import Chunk from '../models/Chunk.js';
import { config } from '../config.js';
import { getProvider } from '../ai/index.js';
import { BM25 } from '../rag/bm25.js';
import { cosine, reciprocalRankFusion } from '../rag/vector.js';

// Small in-memory cache of per-document indexes (chunks + BM25).
const cache = new Map();
const MAX_CACHED = 20;

export function invalidate(docId) {
  cache.delete(String(docId));
}

async function loadIndex(docId) {
  const key = String(docId);
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit); // refresh LRU order
    return hit;
  }
  const chunks = await Chunk.find({ doc: docId }).select('+embedding').sort({ idx: 1 }).lean();
  const index = { chunks, byIdx: new Map(chunks.map((c) => [c.idx, c])), bm25: new BM25(chunks.map((c) => `${c.section || ''} ${c.text}`)) };
  cache.set(key, index);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value);
  return index;
}

/**
 * Hybrid retrieval: semantic (embeddings) + lexical (BM25), merged with
 * Reciprocal Rank Fusion. Each result says which retrievers found it.
 */
export async function retrieve(doc, query, k = config.topK) {
  const index = await loadIndex(doc._id);
  const provider = getProvider();
  const lists = {
    keywords: index.bm25.search(query, 20).map((r) => index.chunks[r.i].idx),
  };

  // Vectors are only comparable if made by the same embedding model.
  if (doc.embedModel === provider.embedId) {
    const [qv] = await provider.embed([query], { type: 'query' });
    if (config.atlasVector) {
      const hits = await Chunk.aggregate([
        {
          $vectorSearch: {
            index: 'chunk_vector',
            path: 'embedding',
            queryVector: qv,
            numCandidates: 150,
            limit: 20,
            filter: { doc: new mongoose.Types.ObjectId(String(doc._id)) },
          },
        },
        { $project: { idx: 1 } },
      ]);
      lists.meaning = hits.map((h) => h.idx);
    } else {
      lists.meaning = index.chunks
        .map((c) => ({ idx: c.idx, s: cosine(qv, c.embedding || []) }))
        .filter((x) => x.s > 0.05)
        .sort((a, b) => b.s - a.s)
        .slice(0, 20)
        .map((x) => x.idx);
    }
  }

  // Offline hash vectors are weak, so lean on keywords; real embeddings get equal say.
  const weights = provider.name === 'local' ? { meaning: 0.2 } : {};
  return reciprocalRankFusion(lists, 60, weights)
    .slice(0, k)
    .map((f, i) => {
      const c = index.byIdx.get(f.id);
      return { n: i + 1, idx: c.idx, page: c.page, section: c.section, text: c.text, via: f.via, score: Number(f.score.toFixed(4)) };
    });
}

export async function allChunks(docId) {
  return (await loadIndex(docId)).chunks;
}
