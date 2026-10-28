// GERADO por tools/build-sw.mjs. Não edite à mão: rode "npm run build:sw".
const CACHE = 'mp-v6';
const PRECACHE = [
  "./",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest",
  "src/application/backupService.js",
  "src/application/demoData.js",
  "src/application/homeService.js",
  "src/application/investmentService.js",
  "src/application/loanService.js",
  "src/application/messageService.js",
  "src/application/ports.js",
  "src/application/preferences.js",
  "src/application/registryService.js",
  "src/domain/communication/channels.js",
  "src/domain/communication/models.js",
  "src/domain/communication/render.js",
  "src/domain/investment/indicators.js",
  "src/domain/investment/investment.js",
  "src/domain/investment/portfolio.js",
  "src/domain/investment/redemption.js",
  "src/domain/investment/tax.js",
  "src/domain/investment/term.js",
  "src/domain/investment/yield.js",
  "src/domain/loan/amortization.js",
  "src/domain/loan/factory.js",
  "src/domain/loan/lateFees.js",
  "src/domain/loan/loan.js",
  "src/domain/loan/portfolio.js",
  "src/domain/loan/prepayment.js",
  "src/domain/loan/revision.js",
  "src/domain/loan/simulation.js",
  "src/domain/registry/institution.js",
  "src/domain/registry/person.js",
  "src/domain/registry/registry.js",
  "src/domain/shared/dates.js",
  "src/domain/shared/format.js",
  "src/domain/shared/masks.js",
  "src/domain/shared/text.js",
  "src/domain/validators.js",
  "src/infrastructure/backupCodec.js",
  "src/infrastructure/bootstrap.js",
  "src/infrastructure/jsonRepository.js",
  "src/infrastructure/legacyV1.js",
  "src/infrastructure/storage.js",
  "src/main.js",
  "src/presentation/actions/common.js",
  "src/presentation/actions/investments.js",
  "src/presentation/actions/loans.js",
  "src/presentation/actions/settings.js",
  "src/presentation/app.js",
  "src/presentation/appInfo.js",
  "src/presentation/combo.js",
  "src/presentation/components.js",
  "src/presentation/controller.js",
  "src/presentation/documentExport.js",
  "src/presentation/format.js",
  "src/presentation/forms/investmentForm.js",
  "src/presentation/forms/loanForm.js",
  "src/presentation/forms/loanSheets.js",
  "src/presentation/forms/redemptionForm.js",
  "src/presentation/glossary.js",
  "src/presentation/html.js",
  "src/presentation/navigation.js",
  "src/presentation/peopleKind.js",
  "src/presentation/presenters.js",
  "src/presentation/runtimeInfo.js",
  "src/presentation/shell.js",
  "src/presentation/store.js",
  "src/presentation/styles/app.css",
  "src/presentation/views/home.js",
  "src/presentation/views/index.js",
  "src/presentation/views/investments.js",
  "src/presentation/views/loans.js",
  "src/presentation/views/settings.js"
];
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
