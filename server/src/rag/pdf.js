/**
 * Extract text page by page from a PDF buffer, rebuilding line breaks from
 * text positions so headings stay on their own lines.
 */
export async function extractPdfPages(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let lastY = null;
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        // bigger gaps mean a new paragraph
        text += Math.abs(y - lastY) > 18 ? '\n\n' : '\n';
      } else if (text && !text.endsWith(' ') && item.str && !item.str.startsWith(' ')) {
        text += ' ';
      }
      text += item.str;
      lastY = y;
    }
    pages.push({ page: p, text: text.replace(/[ \t]+/g, ' ').trim() });
    page.cleanup();
  }
  await pdf.destroy();
  return pages;
}
