export const VERDICTS = ['COVERED', 'NOT_COVERED', 'CONDITIONAL', 'UNCLEAR'];

/**
 * Incrementally split a streamed answer into its verdict line and body.
 * Feed tokens with push(); it returns { verdict?, text? } as they become known.
 */
export function createVerdictParser() {
  let head = '';
  let decided = false;
  return {
    push(chunk) {
      if (decided) return { text: chunk };
      head += chunk;
      const m = head.match(/^\s*VERDICT:\s*(COVERED|NOT[_ ]COVERED|CONDITIONAL|UNCLEAR)\b[^\n]*\n?/i);
      if (m) {
        decided = true;
        const verdict = m[1].toUpperCase().replace(' ', '_');
        return { verdict, text: head.slice(m[0].length).replace(/^\s+/, '') };
      }
      if (head.length > 60 || (head.includes('\n') && !/^\s*VERDICT/i.test(head))) {
        decided = true;
        return { verdict: 'UNCLEAR', text: head };
      }
      return {};
    },
    end() {
      if (decided) return {};
      decided = true;
      return { verdict: 'UNCLEAR', text: head };
    },
  };
}

export function citedNumbers(text) {
  return [...new Set([...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])))];
}
