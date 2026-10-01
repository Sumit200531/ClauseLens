import * as THREE from 'three';

// Deterministic pseudo-random so every reload draws the same pages.
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

const CLAUSES = ['4.2', '5.3', '6.1', '3.2', '7.1', '6.4', '2.3', '5.5', '4.3'];

/** Draws a policy page (title, clause number, text lines, one highlighted rule) onto a canvas. */
export function makePageTexture(index) {
  const W = 512, H = 724;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rng(index + 3);

  g.fillStyle = '#e9eef2';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(14,23,38,.06)';
  g.fillRect(0, 0, W, 6);

  g.fillStyle = '#5a6b80';
  g.font = '500 15px "IBM Plex Sans", sans-serif';
  g.fillText('Policy wording', 44, 58);
  g.fillText(`Page ${index + 3}`, W - 104, 58);

  g.fillStyle = '#16233a';
  g.font = '64px "Instrument Serif", Georgia, serif';
  g.fillText(CLAUSES[index % CLAUSES.length], 44, 140);

  const highlightRow = 4 + Math.floor(r() * 10);
  let y = 190;
  for (let row = 0; row < 26; row++) {
    if (row % 7 === 6) { y += 16; continue; }
    const w = row % 7 === 5 ? 120 + r() * 200 : 330 + r() * 100;
    if (row === highlightRow) {
      g.fillStyle = 'rgba(242,193,78,.75)';
      g.fillRect(38, y - 13, w + 12, 22);
    }
    g.fillStyle = row === highlightRow ? '#1b2a41' : '#9aa7b6';
    g.fillRect(44, y - 5, w, 7);
    y += 19;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
