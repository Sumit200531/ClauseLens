import { tokenize } from './text.js';

/** Okapi BM25 over a small corpus (one policy). */
export class BM25 {
  constructor(docs, { k1 = 1.4, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.docs = docs.map((d) => {
      const tokens = tokenize(d);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      return { len: tokens.length, tf };
    });
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / (this.docs.length || 1);
    this.df = new Map();
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
  }

  idf(t) {
    const n = this.docs.length;
    const df = this.df.get(t) || 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** Returns [{ i, score }] sorted by score, only score > 0. */
  search(query, limit = 20) {
    const q = [...new Set(tokenize(query))];
    const out = [];
    this.docs.forEach((d, i) => {
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        score += this.idf(t) * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen)));
      }
      if (score > 0) out.push({ i, score });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
