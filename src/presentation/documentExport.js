import { shortDate } from './format.js';

const FONT = 'Manrope,system-ui,-apple-system,"Segoe UI",sans-serif', font = (w, z) => `${w} ${z}px ${FONT}`;

/** Desenha o documento em um canvas de largura W; devolve a altura usada. */
function paint(g, d, W) {
  const P = 40; let y = 0;
  const round = (x, t, w, h, r) => { g.beginPath(); g.moveTo(x + r, t); g.arcTo(x + w, t, x + w, t + h, r); g.arcTo(x + w, t + h, x, t + h, r); g.arcTo(x, t + h, x, t, r); g.arcTo(x, t, x + w, t, r); g.closePath(); g.fill(); };
  g.fillStyle = '#0B1F4B'; g.fillRect(0, 0, W, 150); g.fillStyle = '#FF7A1A'; g.fillRect(0, 150, W, 6);
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = font(800, 34); g.fillText(d.title, P, 76); g.fillStyle = '#DDE5FF'; g.font = font(500, 19); g.fillText(d.sub, P, 118);
  g.textAlign = 'right'; g.fillStyle = '#FF8A33'; g.font = font(800, 19); g.fillText('Meu Patrimônio', W - P, 46); y = 194;
  if (d.hero) { g.fillStyle = '#E8EEFF'; round(P, y, W - 2 * P, 128, 20); g.textAlign = 'left'; g.fillStyle = '#3A4665'; g.font = font(600, 20); g.fillText(d.hero.label, P + 28, y + 46); g.fillStyle = '#0B1F4B'; g.font = font(800, 50); g.fillText(d.hero.value, P + 28, y + 102); y += 170; }
  if (d.note) {
    g.font = font(500, 21); let line = ''; const lines = [];
    d.note.split(' ').forEach((w) => { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > W - 2 * P && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); g.textAlign = 'left'; g.fillStyle = '#1b2440'; lines.forEach((t) => { g.fillText(t, P, y); y += 33; }); y += 22;
  }
  d.rows.forEach(([a, b]) => { g.textAlign = 'left'; g.fillStyle = '#3A4665'; g.font = font(500, 20); g.fillText(a, P, y); g.textAlign = 'right'; g.fillStyle = '#1b2440'; g.font = font(800, 21); g.fillText(b, W - P, y); y += 20; g.fillStyle = '#D5DCEB'; g.fillRect(P, y, W - 2 * P, 2); y += 40; });
  if (d.table) {
    y += 10; const X = [P + 14, P + 96, W - P - 176, W - P - 14], AL = ['left', 'left', 'right', 'right'];
    g.fillStyle = '#E8EEFF'; g.fillRect(P, y - 32, W - 2 * P, 48); g.fillStyle = '#0B1F4B'; g.font = font(800, 16); d.table.head.forEach((h, i) => { g.textAlign = AL[i]; g.fillText(h, X[i], y); }); y += 54;
    d.table.body.forEach((r) => { r.forEach((c, i) => { g.textAlign = AL[i]; g.font = font(i === 3 ? 800 : 500, 18); g.fillStyle = i === 3 ? (c === 'Paga' ? '#157A46' : c === 'Atrasada' ? '#C42A31' : '#1b2440') : '#1b2440'; g.fillText(c, X[i], y); }); y += 18; g.fillStyle = '#D5DCEB'; g.fillRect(P, y, W - 2 * P, 1); y += 34; });
  }
  if (d.sign) { y += 64; g.fillStyle = '#1b2440'; g.fillRect(W - P - 320, y, 320, 2); y += 32; g.textAlign = 'center'; g.fillStyle = '#3A4665'; g.font = font(500, 17); g.fillText('Assinatura do credor', W - P - 160, y); }
  y += 64; g.textAlign = 'center'; g.fillStyle = '#5A6684'; g.font = font(500, 16); g.fillText(`Gerado pelo app Meu Patrimônio em ${shortDate(new Date())}`, W / 2, y); return y + 44;
}

/** Imagem PNG de 720 px de largura em escala 2. */
export function documentCanvas(d, doc = document) {
  const K = 2, W = 720, probe = doc.createElement('canvas').getContext('2d'), h = Math.ceil(paint(probe, d, W)), c = doc.createElement('canvas');
  c.width = W * K; c.height = h * K; const g = c.getContext('2d'); g.scale(K, K); g.fillStyle = '#fff'; g.fillRect(0, 0, W, h); paint(g, d, W); return c;
}

/** PDF de uma página com a imagem do documento (JPEG embutido). */
export function pdfFrom(canvas) {
  const jpg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]), (k) => k.charCodeAt(0)), w = canvas.width, h = canvas.height, PW = 595, PH = Math.round((595 * h) / w);
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const add = (b) => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; }, obj = (n, b) => { offs[n] = len; add(`${n} 0 obj\n${b}\nendobj\n`); };
  add('%PDF-1.4\n'); obj(1, '<</Type/Catalog/Pages 2 0 R>>'); obj(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>');
  obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PW} ${PH}]/Resources<</XObject<</I 4 0 R>>>>/Contents 5 0 R>>`);
  offs[4] = len; add(`4 0 obj\n<</Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>\nstream\n`); add(jpg); add('\nendstream\nendobj\n');
  const cs = `q ${PW} 0 0 ${PH} 0 0 cm /I Do Q`; obj(5, `<</Length ${cs.length}>>\nstream\n${cs}\nendstream`);
  const x = len; add('xref\n0 6\n0000000000 65535 f \n'); for (let i = 1; i <= 5; i++) add(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  add(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`); return new Blob(parts, { type: 'application/pdf' });
}

/** kind: 'img' | 'pdf' | 'print'. Sem compartilhamento nativo de arquivos, baixa o arquivo. */
export async function exportDocument({ kind, doc, filename, shell, win = window }) {
  if (kind === 'print') { win.print(); return; }
  try { await Promise.all(['500 20px Manrope', '600 20px Manrope', '800 20px Manrope'].map((f) => win.document.fonts.load(f))); } catch { /* usa a fonte do sistema */ }
  const canvas = documentCanvas(doc, win.document);
  if (kind === 'pdf') { shell.download(`${filename}.pdf`, pdfFrom(canvas), 'application/pdf'); return; }
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png')), file = new win.File([blob], `${filename}.png`, { type: 'image/png' });
  if (win.navigator.canShare?.({ files: [file] })) { try { await win.navigator.share({ files: [file], title: doc.title }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  shell.download(`${filename}.png`, blob, 'image/png');
}
