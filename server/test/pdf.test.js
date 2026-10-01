import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { extractPdfPages } from '../src/rag/pdf.js';
import { chunkPages } from '../src/rag/chunker.js';

const file = new URL('./fixtures/policy.pdf', import.meta.url);

test('extracts per-page text from a real PDF and chunks it', { skip: !existsSync(file) }, async () => {
  const pages = await extractPdfPages(readFileSync(file));
  assert.equal(pages.length, 8);
  assert.match(pages[3].text, /knee and hip replacement/);
  const chunks = chunkPages(pages);
  const knee = chunks.find((c) => /knee/.test(c.text));
  assert.equal(knee.page, 4);
  assert.match(knee.section, /4\.2/);
});
