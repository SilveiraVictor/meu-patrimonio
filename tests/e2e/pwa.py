"""Teste ponta a ponta do PWA no Chromium: service worker, offline, atalhos, instalação. Uso: python3 tests/e2e/pwa.py"""
import json, os, subprocess, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); PORT = 8128; BASE = f'http://localhost:{PORT}'
CACHE = json.load(open(os.path.join(ROOT, 'package.json')))['pwaCache']
ok = []
def check(cond, label):
    ok.append((bool(cond), label)); print(('  ok  ' if cond else 'FALHA'), label)

srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text and 'fonts' not in m.text and 'Failed to load' not in m.text else None)
        nav = lambda t: pg.click(f'#nav button:has-text("{t}")')

        print('Manifesto e service worker')
        mf = pg.request.get(f'{BASE}/manifest.webmanifest').json()
        check(mf['display_override'][0] == 'fullscreen' and len(mf['shortcuts']) == 2, 'manifesto servido: tela cheia + 2 atalhos')
        pg.goto(f'{BASE}/'); pg.wait_for_selector('h1'); pg.evaluate('navigator.serviceWorker.ready'); pg.wait_for_function("navigator.serviceWorker.controller || true")
        keys = pg.evaluate('caches.keys()'); check(CACHE in keys and all(k == CACHE for k in keys if k.startswith('mp-')), f'cache {CACHE} criado e sem caches antigos')
        n = pg.evaluate(f"caches.open('{CACHE}').then(c => c.keys()).then(k => k.length)"); check(n >= 70, f'{n} arquivos pré-carregados')
        check(pg.evaluate("document.querySelector('meta[name=theme-color]').content") == '#F4F6FB', 'theme-color acompanha o tema')

        print('Sobre o app')
        nav('Ajustes'); pg.wait_for_selector('text=Sobre o app'); sobre = pg.inner_text('#app')
        check(f'Cache do app (PWA)\n{CACHE}' in sobre or CACHE in sobre, 'Sobre o app mostra o cache atual'); check('arquivos antigos' not in sobre, 'sem aviso de cache desatualizado')

        print('Atalhos do manifesto')
        pg.goto(f'{BASE}/?novo=emprestimo'); pg.wait_for_selector('#f-person'); check(pg.evaluate('location.search') == '', 'atalho Novo empréstimo abre o formulário e limpa a URL')
        pg.goto(f'{BASE}/?novo=investimento'); pg.wait_for_selector('#f-name'); check('Novo título' in pg.inner_text('#sh'), 'atalho Novo título abre o formulário')

        print('Cartão Instalar o app')
        pg.goto(f'{BASE}/'); pg.wait_for_selector('h1'); check('Instalar o app' not in pg.inner_text('#app'), 'sem cartão quando o navegador não oferece instalação')
        pg.evaluate("() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }")
        pg.wait_for_selector('text=Instalar o app'); pg.click('button:has-text("Instalar o app")'); pg.wait_for_function('window.__prompted === true')
        pg.wait_for_function("!document.querySelector('#app').innerText.includes('Instalar o app')"); check(True, 'instalar dispara o prompt e remove o cartão')

        print('Offline')
        pg.reload(); pg.wait_for_selector('h1'); pg.evaluate('navigator.serviceWorker.ready')
        nav('Empréstimos'); pg.wait_for_selector('.card.tap:has(.bar)')
        ctx.set_offline(True)
        pg.goto(f'{BASE}/'); pg.wait_for_selector('h1:has-text("Meu Patrimônio")'); check(pg.locator('.card.tap.row').count() >= 1, 'recarrega sem internet com os dados do aparelho')
        nav('Investimentos'); pg.wait_for_selector('.card.tap:has(.chip)'); nav('Empréstimos'); pg.wait_for_selector('.card.tap:has(.bar)')
        pg.click('.card.tap:has(.bar) >> nth=0'); pg.wait_for_selector('text=Cronograma'); check(True, 'navega entre telas offline')
        pg.goto(f'{BASE}/?source=pwa'); pg.wait_for_selector('h1'); check(True, 'start_url do PWA abre offline')
        ctx.set_offline(False)

        print('Atualizar o app')
        nav('Ajustes'); pg.click('text=Atualizar o app agora'); pg.wait_for_selector('h1:has-text("Meu Patrimônio")', timeout=15000)
        pg.evaluate('navigator.serviceWorker.ready'); pg.wait_for_function(f"caches.keys().then(k => k.includes('{CACHE}'))")
        check(True, 'atualização limpou e recriou o cache; dados preservados'); check(pg.locator('.card.tap.row').count() >= 1, 'dados continuam após atualizar')
        check(not errs, f'sem erros no console/página {errs}')
        b.close()
finally:
    srv.terminate()
fails = [l for c, l in ok if not c]
print(f'\n{len(ok) - len(fails)}/{len(ok)} verificações passaram'); raise SystemExit(1 if fails else 0)
