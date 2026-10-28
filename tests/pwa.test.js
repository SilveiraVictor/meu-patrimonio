import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { precacheList, renderSw } from '../tools/build-sw.mjs';
import { APP_INFO } from '../src/presentation/appInfo.js';

const root = fileURLToPath(new URL('..', import.meta.url)), read = (f) => readFileSync(root + f, 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest')), pkg = JSON.parse(read('package.json'));

test('manifesto: tela cheia com fallback, ícones existentes e atalhos válidos', () => {
  assert.deepEqual(manifest.display_override, ['fullscreen', 'standalone']); assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable') && manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
  manifest.icons.forEach((i) => assert.ok(existsSync(root + i.src), i.src));
  assert.deepEqual(manifest.shortcuts.map((s) => s.url), ['./?novo=emprestimo', './?novo=investimento']);
  assert.equal(manifest.theme_color, '#0B1F4B'); assert.equal(manifest.lang, 'pt-BR');
});
test('index.html aponta para o manifesto, ícones e a primeira tela', () => {
  const h = read('index.html');
  for (const s of ['rel="manifest" href="manifest.webmanifest"', 'viewport-fit=cover', 'name="theme-color"', 'apple-touch-icon', 'src/presentation/styles/app.css', "src/presentation/app.js"]) assert.ok(h.includes(s), s);
  assert.ok(existsSync(root + 'legacy/index.html'), 'app antigo guardado em legacy/');
});
test('service worker: sw.js está em dia com os arquivos e com o nome do cache', () => {
  const files = precacheList(root), sw = read('sw.js');
  assert.equal(sw, renderSw({ cache: pkg.pwaCache, files }), 'sw.js desatualizado: rode "npm run build:sw"');
  assert.equal(APP_INFO.cacheExpected, pkg.pwaCache); assert.ok(sw.includes(`const CACHE = '${pkg.pwaCache}'`));
  for (const f of ['index.html', 'manifest.webmanifest', 'src/main.js', 'src/presentation/app.js', 'src/presentation/styles/app.css', 'src/domain/loan/prepayment.js']) assert.ok(files.includes(f), f);
  assert.ok(!files.some((f) => f.startsWith('tests/') || f.startsWith('docs/') || f.startsWith('legacy/')));
});
test('toda importação relativa do código aponta para um arquivo que existe', () => {
  for (const f of precacheList(root).filter((x) => x.endsWith('.js'))) {
    for (const m of read(f).matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)) {
      const target = new URL(m[1], new URL(f, 'file://' + root + '/')).pathname; assert.ok(existsSync(target), `${f} → ${m[1]}`);
    }
  }
});
