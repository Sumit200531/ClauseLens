export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Reciprocal Rank Fusion: merge several ranked lists without having to
 * calibrate their scores against each other.
 * @param {Object<string, Array<string|number>>} lists  name -> ids in rank order
 * @param {number} k  damping constant (60 is the value from the original paper)
 * @param {Object<string, number>} weights  optional per-retriever weight (default 1)
 * @returns {Array<{id, score, via:string[]}>}
 */
export function reciprocalRankFusion(lists, k = 60, weights = {}) {
  const acc = new Map();
  for (const [name, ids] of Object.entries(lists)) {
    ids.forEach((id, rank) => {
      const e = acc.get(id) || { id, score: 0, via: [] };
      e.score += (weights[name] ?? 1) / (k + rank + 1);
      e.via.push(name);
      acc.set(id, e);
    });
  }
  return [...acc.values()].sort((a, b) => b.score - a.score);
}
