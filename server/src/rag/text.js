const STOP = new Set(
  'a an and are as at be but by for from has have i if in into is it its my of on or our so such that the their then there these this to under was we were what when where which while who will with would you your can do does any all am me'.split(' ')
);

/** Lowercase, split, drop stop words, light plural stemming. */
export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((t) => !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith('ies') ? t.slice(0, -3) + 'y' : t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

export function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.;:])\s+(?=[A-Z(0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}
