/**
 * Clause-aware chunking.
 * Policies are written as numbered clauses ("4.2 Specified disease waiting
 * period"). We split at clause headings first so a chunk never mixes two
 * unrelated rules, then pack paragraphs up to a size limit with overlap.
 * Every chunk keeps its page number and nearest heading for citations.
 */

const HEADING_RE = /^(?:(?:section|clause|part|article)\s+)?(\d{1,2}(?:\.\d{1,2}){0,3})[.)]?\s+([A-Z][^\n]{2,90})$|^([A-Z][A-Z &/,'-]{4,70})$/i;

export function detectHeading(line) {
  const l = line.trim();
  if (!l || l.length > 100) return null;
  const m = l.match(HEADING_RE);
  if (!m) return null;
  if (m[3] && m[3] !== m[3].toUpperCase()) return null; // all-caps headings only
  if (m[2] && /[.;]$/.test(m[2].trim()) && m[2].split(' ').length > 8) return null; // a sentence, not a heading
  return l.replace(/\s+/g, ' ');
}

/**
 * @param {Array<{page:number,text:string}>} pages
 * @returns {Array<{page:number, section:string|null, text:string}>}
 */
export function chunkPages(pages, { maxChars = 900, targetChars = 420, overlap = 150 } = {}) {
  // 1) Turn pages into blocks: { page, section, text }
  const blocks = [];
  let section = null;
  for (const { page, text } of pages) {
    let buf = [];
    const flush = () => {
      const t = buf.join(' ').replace(/\s+/g, ' ').trim();
      if (t) blocks.push({ page, section, text: t });
      buf = [];
    };
    for (const raw of text.split(/\n/)) {
      const line = raw.trim();
      const h = detectHeading(line);
      if (h) {
        flush();
        section = h;
        continue;
      }
      if (!line) {
        flush();
        continue;
      }
      buf.push(line);
    }
    flush();
  }

  // 2) Pack blocks of the same section into chunks, splitting long ones.
  const chunks = [];
  let cur = null;
  const push = () => {
    if (cur && cur.text.trim()) chunks.push({ ...cur, text: cur.text.trim() });
    cur = null;
  };
  for (const b of blocks) {
    // Clauses are atomic rules: merge small neighbours, but keep chunks focused.
    if (cur && (cur.section !== b.section || cur.text.length + b.text.length + 1 > targetChars)) push();
    if (!cur) cur = { page: b.page, section: b.section, text: '' };
    if (b.text.length > maxChars) {
      for (let i = 0; i < b.text.length; i += maxChars - overlap) {
        let piece = b.text.slice(i, i + maxChars);
        // try not to cut mid-word
        if (i + maxChars < b.text.length) piece = piece.replace(/\s+\S*$/, '');
        cur.text = piece;
        push();
        cur = { page: b.page, section: b.section, text: '' };
      }
      continue;
    }
    cur.text += (cur.text ? ' ' : '') + b.text;
  }
  push();
  return chunks.map((c, idx) => ({ idx, ...c }));
}
