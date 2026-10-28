// Gera sw.js com a lista de arquivos do app e mantém o nome do cache em sincronia com appInfo.js.
// Uso: npm run build:sw  (rode a cada publicação; o nome do cache vem de "pwaCache" no package.json)
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => relative(ROOT, p).split(sep).join('/');

/** Arquivos que precisam estar disponíveis offline. */
export function precacheList(root = ROOT) {
  const src = walk(join(root, 'src')).map((p) => relative(root, p).split(sep).join('/')).filter((f) => /\.(js|css)$/.test(f));
  const icons = walk(join(root, 'icons')).map((p) => relative(root, p).split(sep).join('/'));
  return ['./', 'index.html', 'manifest.webmanifest', ...icons, ...src].sort();
}

export function renderSw({ cache, files }) {
  return `// GERADO por tools/build-sw.mjs. Não edite à mão: rode "npm run build:sw".
const CACHE = '${cache}';
const PRECACHE = ${JSON.stringify(files, null, 2)};
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('mp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Mesmo domínio: rede primeiro; sem internet, usa a última versão salva. Fontes: cache primeiro.
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(r)
        .then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r.mode === 'navigate' ? 'index.html' : r, cp)); } return res; })
        .catch(() => caches.match(r, { ignoreSearch: true }).then((hit) => hit || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
    return;
  }
  if (FONT_HOSTS.includes(u.hostname)) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res; })));
  }
});
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cache = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).pwaCache;
  const files = precacheList();
  writeFileSync(join(ROOT, 'sw.js'), renderSw({ cache, files }));
  const info = join(ROOT, 'src/presentation/appInfo.js');
  writeFileSync(info, readFileSync(info, 'utf8').replace(/cacheExpected: '[^']*'/, `cacheExpected: '${cache}'`));
  console.log(`sw.js gerado: cache ${cache}, ${files.length} arquivos`);
}
