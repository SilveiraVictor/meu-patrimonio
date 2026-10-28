"""Teste ponta a ponta no Chromium: Investimentos e Ajustes. Uso: python3 tests/e2e/investments_settings.py"""
import datetime as dt, json, os, subprocess, tempfile, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = 8124
today = dt.date.today(); iso = lambda n: (today + dt.timedelta(days=n)).isoformat()
ok = []
def check(cond, label):
    ok.append((bool(cond), label)); print(('  ok  ' if cond else 'FALHA'), label)

srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True, color_scheme='light'); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text and 'fonts' not in m.text else None)
        pg.goto(f'http://localhost:{PORT}/'); pg.wait_for_selector('h1')
        nav = lambda t: pg.click(f'#nav button:has-text("{t}")')
        wait_enabled = lambda sel: pg.wait_for_function(f"!document.querySelector('{sel}').disabled")

        print('Lista de investimentos')
        nav('Investimentos'); pg.wait_for_selector('h1:has-text("Investimentos")')
        check(pg.locator('.card.tap:has(.chip)').count() >= 7, 'lista com títulos ativos e resgatado')
        check('Resgatados' in pg.inner_text('#app'), 'seção Resgatados')
        check('6,2%' not in pg.inner_text('.three') and '13,9%' in pg.inner_text('.three'), 'indicadores CDI 13,9%')
        check(pg.locator('#fab').inner_text().strip() == 'Novo título', 'FAB: Novo título')

        print('Indicadores')
        pg.click('text=Editar >> nth=0'); pg.fill('#f-cdi', '10'); pg.click('text=Salvar indicadores')
        pg.wait_for_selector('.three >> text=10%'); check(True, 'CDI atualizado para 10%')

        pg.screenshot(path='/tmp/inv_list.png')
        print('Detalhe e edição')
        pg.click('.card.tap:has-text("CDB Banco Azul 112% CDI")'); pg.wait_for_selector('text=Dados da aplicação')
        check('Valor líquido no vencimento' in pg.inner_text('#app') and 'Estimativa de rendimento' in pg.inner_text('#app'), 'detalhe com projeção')
        pg.screenshot(path='/tmp/inv_detail.png')
        pg.click('text=Editar título'); pg.wait_for_selector('#f-name'); wait_enabled('#i-s'); pg.screenshot(path='/tmp/inv_form.png')
        check(pg.input_value('#f-custodian') == 'Banco Azul' and pg.input_value('#f-termDays') == '295', 'formulário preenchido (prazo 295)')
        pg.fill('#f-name', 'CDB Azul Editado'); pg.click('#i-s'); pg.wait_for_selector('h1:has-text("CDB Azul Editado")'); check(True, 'edição salva')

        print('Resgate parcial: registrar, editar e excluir')
        pg.click('text=Registrar resgate ou vencimento'); pg.wait_for_selector('#f-date')
        pg.click('#r-seg button:has-text("Resgate parcial")'); pg.fill('#f-gross', '1000')
        pg.wait_for_selector('#rpv >> text=Líquido estimado'); wait_enabled('#r-s'); check('Rendimento líquido' in pg.inner_text('#rpv'), 'prévia do resgate parcial')
        pg.click('#r-s'); pg.wait_for_selector('text=Resgates registrados'); check('Ainda aplicado' in pg.inner_text('#app'), 'resgate registrado; ainda aplicado')
        pg.click('.card.tap:has-text("Resgate parcial")'); pg.wait_for_selector('#f-gross'); pg.fill('#f-net', '990'); pg.wait_for_selector('#rpv >> text=Líquido recebido')
        pg.click('#r-s'); pg.wait_for_selector('.chip:has-text("Valor real")'); check(True, 'edição com líquido informado → valor real')
        pg.click('.card.tap:has-text("Resgate parcial")'); pg.click('text=Excluir este resgate'); pg.click('.btn.dg:has-text("Excluir")')
        pg.wait_for_selector('text=Registrar resgate ou vencimento'); check('Resgates registrados' not in pg.inner_text('#app'), 'resgate excluído')

        print('Novo título com cadastro rápido e regra do prazo')
        nav('Investimentos'); pg.click('#fab'); pg.wait_for_selector('#f-name')
        check(pg.is_disabled('#i-s'), 'salvar desabilitado com formulário vazio')
        pg.fill('#f-name', 'LCA Teste 11%'); pg.fill('#f-custodian', 'Banco Az'); pg.click('#opts-custodian button[role=option]')
        check(pg.input_value('#f-custodian') == 'Banco Azul', 'custodiante escolhido na lista')
        pg.fill('#f-issuer', 'Banco Novo'); pg.click('text=Cadastrar instituição'); pg.fill('#f-q_note', 'agência teste'); pg.click('text=Salvar e usar')
        pg.wait_for_function("document.querySelector('#f-issuer').dataset.selected"); check(pg.input_value('#f-issuer').startswith('Banco Novo'), 'emissor cadastrado na hora')
        pg.select_option('#f-category', 'LCA'); pg.fill('#f-rate', '11'); pg.fill('#f-amount', '1000')
        pg.fill('#f-appliedOn', iso(-10)); pg.fill('#f-maturity', iso(200)); pg.wait_for_function("document.querySelector('#f-termDays').value==='210'")
        check('Isento de IR' in pg.inner_text('#ipv') and 'Valor real' in pg.inner_text('#ipv'), 'prévia: LCA isenta, prefixado = valor real')
        pg.fill('#f-termDays', '100'); pg.wait_for_selector('text=Qual faz mais sentido agora?'); check(pg.is_disabled('#i-s'), 'conflito de prazo bloqueia salvar')
        pg.click('text=Usar 210 dias'); wait_enabled('#i-s'); check(pg.input_value('#f-termDays') == '210', 'usar prazo calculado')
        pg.click('#i-s'); pg.wait_for_selector('.card.tap:has-text("LCA Teste 11%")'); check(True, 'título criado e listado')

        print('Instituições')
        pg.click('text=Gerenciar instituições'); pg.wait_for_selector('text=Nova instituição'); pg.click('text=Nova instituição'); pg.fill('#f-name', 'Banco Azul'); pg.click('.foot >> text=Salvar')
        pg.wait_for_selector('#toast:has-text("CNPJ ou uma observação")'); check(True, 'homônimo sem diferenciador é recusado')
        pg.fill('#f-note', 'filial'); pg.click('.foot >> text=Salvar'); pg.wait_for_selector('.card.row:has-text("filial")'); check(True, 'homônimo com observação é aceito')
        pg.click('.x[aria-label=Fechar]')

        print('Excluir título')
        pg.click('.card.tap:has-text("LCA Teste 11%")'); pg.click('text=Excluir título'); pg.click('.btn.dg:has-text("Excluir")')
        pg.wait_for_selector('h1:has-text("Investimentos")'); check(pg.locator('.card.tap:has-text("LCA Teste 11%")').count() == 0, 'título excluído')

        print('Ajustes')
        nav('Ajustes'); pg.wait_for_selector('h1:has-text("Ajustes")'); check(not pg.is_visible('#fab'), 'sem FAB em Ajustes')
        pg.click('.seg button:has-text("Escuro")'); pg.wait_for_function("document.documentElement.dataset.theme==='dark'")
        check(pg.get_attribute('meta[name=theme-color]', 'content') == '#0A1020', 'tema escuro + theme-color')
        pg.click('.seg button:has-text("Muito grande")'); check(pg.evaluate("document.documentElement.classList.contains('fs-xl')"), 'texto muito grande')
        pg.click('[role=switch][aria-labelledby=a-hc]'); check(pg.evaluate("document.documentElement.classList.contains('hc')"), 'alto contraste')
        pg.click('text=Restaurar padrões'); check(pg.evaluate("document.documentElement.dataset.theme") is None, 'aparência restaurada')
        with pg.expect_download() as d: pg.click('text=Exportar backup')
        path = d.value.path(); data = json.load(open(path)); check(data['version'] == 2 and len(data['loans']) == 4, 'backup v2 exportado com os 4 empréstimos')
        check('Apagar dados de exemplo' in pg.inner_text('#app'), 'cartão de dados de exemplo')
        pg.click('text=Apagar dados de exemplo'); pg.click('.btn.dg:has-text("Apagar exemplos")'); pg.wait_for_function("!document.querySelector('#app').innerText.includes('Apagar dados de exemplo')")
        check('0' in pg.inner_text('.card.kv'), 'exemplos apagados')
        bad = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False); bad.write('{"x":1}'); bad.close()
        pg.set_input_files('#imp', bad.name); pg.wait_for_selector('#toast:has-text("inválido")'); check(True, 'importação de arquivo inválido recusada')
        pg.set_input_files('#imp', path); pg.wait_for_selector('text=Importar backup?'); pg.click('button.btn:text-is("Importar")')
        pg.wait_for_selector('#toast:has-text("Backup importado")'); nav('Investimentos'); pg.wait_for_selector('.card.tap:has(.chip)'); check(pg.locator('.card.tap:has(.chip)').count() >= 7, 'backup importado restaurou os títulos')
        nav('Ajustes'); pg.click('text=Apagar todos os dados'); pg.wait_for_selector('#f-confirm'); check(pg.is_disabled('#w-b'), 'apagar tudo exige APAGAR')
        pg.fill('#f-confirm', 'apagar'); wait_enabled('#w-b'); pg.click('#w-b'); pg.wait_for_selector('#toast:has-text("apagados")')
        check(pg.evaluate("document.documentElement.dataset.theme") is None and 'Sobre o app' in pg.inner_text('#app'), 'tudo apagado; tela de Ajustes permanece')
        nav('Início'); pg.wait_for_selector('text=Nenhum título cadastrado'); check(True, 'início vazio após apagar tudo')
        check(not errs, f'sem erros no console/página {errs}')
        b.close()
finally:
    srv.terminate()
fails = [l for c, l in ok if not c]
print(f'\n{len(ok) - len(fails)}/{len(ok)} verificações passaram'); raise SystemExit(1 if fails else 0)
