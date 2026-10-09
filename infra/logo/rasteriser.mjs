import { chromium } from '@playwright/test';
import fs from 'node:fs';
const A = '../../frontend/src/assets/';
const logo = fs.readFileSync(A + 'logo.svg', 'utf8');
const pic = fs.readFileSync(A + 'logo-pictogramme.svg', 'utf8');
const b = await chromium.launch();
async function rendre(html, w, h, out, transparent) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${html}</body></html>`);
  await p.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
}
const H = 240, W = Math.round(H * 3.3277);
const svgLogo = (c) => `<div style="color:${c};width:${W}px;height:${H}px">${logo.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`;
const E = '../../backend/apps/noyau/assets/';
await rendre(svgLogo('#9E0202'), W, H, E + 'logo-rouge.png', true);
await rendre(svgLogo('#FFFFFF'), W, H, E + 'logo-blanc.png', true);
const P = '../../frontend/public/';
for (const [taille, nom, marge] of [[192, 'pwa-192.png', 0.12], [512, 'pwa-512.png', 0.12], [512, 'pwa-maskable-512.png', 0.22], [180, 'apple-touch-icon.png', 0.12], [64, 'favicon-64.png', 0.04]]) {
  const i = Math.round(taille * (1 - 2 * marge));
  await rendre(`<div style="width:${taille}px;height:${taille}px;display:flex;align-items:center;justify-content:center;background:#fff;color:#9E0202"><div style="width:${i}px;height:${i}px">${pic.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div>`, taille, taille, P + nom, false);
}
await b.close();
console.log('ok', W, H);
