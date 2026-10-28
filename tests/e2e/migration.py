"""Paridade: o app antigo grava os dados (mp:v1); o novo migra e deve mostrar os mesmos números. Uso: python3 tests/e2e/migration.py"""
import os, subprocess, time, re
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); PORT = 8129; BASE = f'http://localhost:{PORT}'
ok = []
def check(cond, label):
    ok.append((bool(cond), label)); print(('  ok  ' if cond else 'FALHA'), label)
norm = lambda s: re.sub(r'\s+', ' ', s.replace('\u00a0', ' ')).strip()

srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))

        print('App antigo (grava mp:v1)')
        pg.goto(f'{BASE}/legacy/index.html'); pg.wait_for_selector('h1'); pg.wait_for_timeout(300)
        old = {}
        old['receber'] = norm(pg.locator('.grid .card').nth(0).inner_text()); old['aberto'] = norm(pg.locator('.grid .card').nth(1).inner_text())
        pg.click('#nav button:has-text("Investimentos")'); pg.wait_for_selector('h1:has-text("Investimentos")'); old['inv'] = norm(pg.locator('.sub').inner_text())
        old['inv_cards'] = [norm(c.inner_text()) for c in pg.locator('.card.tap').all()]
        pg.click('#nav button:has-text("Empréstimos")'); pg.wait_for_selector('h1:has-text("Empréstimos")')
        old['loan_cards'] = [norm(c.inner_text()) for c in pg.locator('.card.tap:has(.bar)').all()]
        old_loans = pg.evaluate("S.loans.map(l => ({who: l.who, bal: l.bal, n: l.n, due: nowDue(l)}))")
        check(pg.evaluate("localStorage.getItem('mp:v1') !== null"), 'app antigo gravou mp:v1')

        print('App novo (migra mp:v1)')
        pg.goto(f'{BASE}/'); pg.wait_for_selector('h1'); pg.wait_for_selector('.card.tap.row')
        check(pg.evaluate("localStorage.getItem('mp:schema')") == '2' and pg.evaluate("localStorage.getItem('mp:v1') !== null"), 'migrou para o esquema 2 e manteve mp:v1 intacto')
        new = {'receber': norm(pg.locator('.grid .card').nth(0).inner_text()), 'aberto': norm(pg.locator('.grid .card').nth(1).inner_text())}
        check(new['receber'] == old['receber'], f"A receber este mês igual ({new['receber']})"); check(new['aberto'] == old['aberto'], f"Emprestado em aberto igual ({new['aberto']})")
        pg.click('#nav button:has-text("Investimentos")'); pg.wait_for_selector('h1:has-text("Investimentos")')
        check(norm(pg.locator('.sub').inner_text()) == old['inv'], f"totais de investimentos iguais ({old['inv']})")
        new_inv = [norm(c.inner_text()) for c in pg.locator('.card.tap').all()]
        pick = lambda cards: {re.split(r' (?:CDB|LCA|LCI|LC|Tesouro|IPCA|Emissor)', c)[0][:20]: re.findall(r'R\$ [\d.]+,\d{2}', c) for c in cards}
        nums_old = [re.findall(r'R\$ [\d.]+,\d{2}', c) for c in old['inv_cards'] if 'Aplicado' in c or 'Ainda aplicado' in c]
        nums_new = [re.findall(r'R\$ [\d.]+,\d{2}', c) for c in new_inv if 'Aplicado' in c or 'Ainda aplicado' in c]
        check(nums_old == nums_new and len(nums_old) >= 6, f'valores de cada título (aplicado e líquido) iguais: {len(nums_old)} títulos')
        pg.click('#nav button:has-text("Empréstimos")'); pg.wait_for_selector('h1:has-text("Empréstimos")')
        new_loans = [norm(c.inner_text()) for c in pg.locator('.card.tap:has(.bar)').all()]
        check(new_loans == old['loan_cards'], 'cartões de empréstimo idênticos (nome, sistema, parcelas pagas, valor atual, situação)')
        for l in old_loans:
            first = l['who'].split(' ')[0]; pg.click(f'.card.tap:has-text("{l["who"]}") >> nth=0'); pg.wait_for_selector('text=Cronograma')
            txt = norm(pg.inner_text('#app')); fmt = lambda v: re.sub(r'\.', '.', f"{v:,.2f}").replace(',', 'X').replace('.', ',').replace('X', '.')
            check(f"R$ {fmt(l['bal'])}" in txt, f"{first}: saldo devedor R$ {fmt(l['bal'])}"); check(f"R$ {fmt(l['due'])}" in txt, f"{first}: próxima parcela com encargos R$ {fmt(l['due'])}")
            pg.click('.back')
        check(not errs, f'sem erros {errs}'); b.close()
finally:
    srv.terminate()
fails = [l for c, l in ok if not c]
print(f'\n{len(ok) - len(fails)}/{len(ok)} verificações passaram'); raise SystemExit(1 if fails else 0)
