"""Teste ponta a ponta no Chromium: Empréstimos. Uso: python3 tests/e2e/loans.py"""
import datetime as dt, os, subprocess, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); PORT = 8126
today = dt.date.today(); iso = lambda n: (today + dt.timedelta(days=n)).isoformat()
ok = []
def check(cond, label):
    ok.append((bool(cond), label)); print(('  ok  ' if cond else 'FALHA'), label)

srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text and 'fonts' not in m.text else None)
        pg.goto(f'http://localhost:{PORT}/'); pg.wait_for_selector('h1')
        nav = lambda t: pg.click(f'#nav button:has-text("{t}")')
        enabled = lambda sel: pg.wait_for_function(f"!document.querySelector('{sel}').disabled")
        text = lambda sel='#app': pg.inner_text(sel)
        loans_cards = lambda: pg.locator('.card.tap:has(.bar)').count()

        print('Lista e visão por pessoa')
        nav('Empréstimos'); pg.wait_for_selector('h1:has-text("Empréstimos")')
        check(loans_cards() == 4, '4 empréstimos de exemplo'); check(pg.locator('#fab').inner_text().strip() == 'Novo empréstimo', 'FAB: Novo empréstimo')
        pg.click('.seg button:has-text("Por pessoa")'); pg.wait_for_selector('.card.tap:has-text("Em atraso")')
        check(pg.locator('.card.tap:has-text("Em aberto")').count() == 4 and 'João Pereira' in pg.locator('.card.tap').nth(2).inner_text(), 'por pessoa: 4 pessoas, atraso primeiro')
        pg.click('.seg button:has-text("Lista")')

        print('Detalhe, pagamento e desfazer')
        pg.click('.card.tap:has-text("Caixa de som")'); pg.wait_for_selector('text=Cronograma')
        check('Próxima parcela (4/10)' in text() and 'Saldo devedor' in text(), 'detalhe do empréstimo (parcela 4/10)')
        pg.click('text=Registrar pagamento'); pg.wait_for_selector('text=Próxima parcela (5/10)'); check(True, 'pagamento registrado')
        pg.click('#toast button:has-text("Desfazer")'); pg.wait_for_selector('text=Próxima parcela (4/10)'); check(True, 'desfazer restaura a parcela')

        print('Antecipar e amortizar')
        pg.click('text=Antecipar ou amortizar'); pg.wait_for_selector('.step'); pg.click('.step button[aria-label=Mais]'); pg.wait_for_selector('.step b:text-is("2")')
        check('Você paga agora' in text('#apv') and 'Juros economizados' in text('#apv') and 'Parcela (mantida)' in text('#apv'), 'prévia da antecipação (valor presente)')
        pg.click('text=Confirmar antecipação'); pg.wait_for_selector('text=Antecipou 2 parcelas'); check('Próxima parcela (4/8)' in text(), 'antecipou 2: restam 4/8')
        pg.click('text=Antecipar ou amortizar'); pg.click('.seg button:has-text("Amortizar valor")'); pg.fill('#f-amount', '500'); pg.wait_for_selector('#apv >> text=Nova parcela')
        pg.click('button.opt:has-text("Reduzir a parcela")'); pg.fill('#f-amount', '500'); pg.wait_for_selector('#apv >> text=Nova parcela'); enabled('#a-s')
        pg.click('text=Confirmar amortização'); pg.wait_for_selector('text=Amortizou (reduziu parcela)'); check(True, 'amortização registrada no histórico')

        print('Editar empréstimo')
        pg.click('text=Editar empréstimo'); pg.wait_for_selector('#f-description'); enabled('#f-s')
        check(pg.input_value('#f-person') == 'Carlos Menezes' and pg.input_value('#f-principal') == '6000', 'formulário preenchido')
        pg.fill('#f-description', 'Caixa de som JBL'); pg.click('#f-s'); pg.wait_for_selector('h1 >> text=Carlos'); pg.wait_for_selector('text=Caixa de som JBL'); check('Amortizou' in text(), 'só a descrição: histórico mantido')
        pg.click('text=Editar empréstimo'); pg.fill('#f-installments', '12'); enabled('#f-s'); pg.click('#f-s'); pg.wait_for_selector('text=Recalcular o cronograma?')
        pg.click('button.btn:text-is("Recalcular")'); pg.wait_for_selector('#toast:has-text("Empréstimo atualizado")'); check('Histórico' not in text(), 'recálculo apagou antecipação e amortização')
        pg.click('#toast button:has-text("Desfazer")'); pg.wait_for_selector('text=Amortizou'); check(True, 'desfazer da edição')

        print('Cobrança, recibo e situação (empréstimo)')
        pg.click('text=Cobrança, recibo e situação'); pg.wait_for_selector('#f-text'); t = pg.input_value('#f-text')
        check(t.startswith('Olá, Carlos!') and 'Parcela 4/' in t, 'mensagem de cobrança')
        check('wa.me/5577999990001' in pg.get_attribute('#mg-wa', 'href'), 'link do WhatsApp com 55 + telefone')
        pg.fill('#f-text', 'Texto editado'); pg.wait_for_function("document.querySelector('#mg-wa').href.includes('Texto%20editado')"); check(True, 'link acompanha a edição do texto')
        pg.click('summary:has-text("Seus dados")'); pg.fill('#f-creditorName', 'Eu Mesmo'); pg.wait_for_function("document.querySelector('#f-text').value.includes('Eu Mesmo')"); check(True, 'dados do credor entram na mensagem')
        pg.click('.seg button:has-text("Recibo")'); pg.wait_for_selector('.paper'); check('Recibo de pagamento' in text('.paper') and 'Assinatura do credor' in text('.paper'), 'recibo em documento (padrão)')
        with pg.expect_download() as d: pg.click('text=Salvar PDF')
        check(open(d.value.path(), 'rb').read(5) == b'%PDF-' and d.value.suggested_filename.startswith('recibo-carlos-'), 'PDF gerado e nomeado')
        with pg.expect_download() as d: pg.click('text=Compartilhar imagem')
        check(open(d.value.path(), 'rb').read(4) == b'\x89PNG', 'imagem PNG gerada')
        pg.click('.seg button:has-text("Situação")'); pg.wait_for_selector('#f-text'); check('*Situação do empréstimo*' in pg.input_value('#f-text'), 'situação em mensagem')
        pg.click('.x[aria-label=Fechar]')

        print('Novo empréstimo parcelado com juros e multa')
        nav('Empréstimos'); pg.click('#fab'); pg.wait_for_selector('#f-person'); check(pg.is_disabled('#f-s'), 'salvar desabilitado sem pessoa')
        pg.fill('#f-person', 'Mari'); pg.click('#opts-person button[role=option]'); check(pg.input_value('#f-person') == 'Mariana Souza', 'pessoa escolhida na lista')
        pg.fill('#f-description', 'Notebook'); pg.fill('#f-principal', '500'); pg.fill('#f-installments', '5'); enabled('#f-s')
        pg.click('#sw-interest'); pg.fill('#f-rate', '2'); pg.click('#sw-lateFees'); pg.wait_for_selector('#pv >> text=Se atrasar 15 dias')
        check('Total de juros' in text('#pv') and 'Valor da parcela' in text('#pv'), 'prévia com juros (Price) e atraso')
        pg.click('#seg-system button:has-text("SAC")'); pg.wait_for_selector('#pv >> text=Última parcela'); check(True, 'SAC mostra primeira e última parcela')
        pg.click('#f-s'); pg.wait_for_selector('#toast:has-text("Empréstimo salvo")'); check(loans_cards() == 5, 'empréstimo criado (5 na lista)')

        print('Pagamento único com cadastro rápido de pessoa')
        pg.click('#fab'); pg.fill('#f-person', 'Pedro Novo'); pg.click('text=Cadastrar pessoa'); pg.fill('#f-q_phone', '77999990009')
        check(pg.input_value('#f-q_phone') == '(77) 99999-0009', 'máscara de telefone'); pg.click('text=Salvar e usar'); pg.wait_for_function("document.querySelector('#f-person').dataset.selected")
        pg.click('#seg-mode button:has-text("Pagamento único")'); pg.fill('#f-principal', '300'); pg.fill('#f-issuedOn', iso(0)); pg.fill('#f-firstDue', iso(30))
        pg.click('#sw-interest'); pg.click('#seg-cap button:has-text("Juros compostos")'); pg.fill('#f-rate', '3'); pg.wait_for_selector('#pv >> text=Valor a receber no vencimento')
        check('30 dias' in text('#pv'), 'prévia do pagamento único (30 dias)'); enabled('#f-s'); pg.click('#f-s'); pg.wait_for_selector('#toast:has-text("Empréstimo salvo")'); check(loans_cards() == 6, 'pagamento único criado')

        print('Simulador e "Usar esta configuração"')
        pg.click('#fab'); pg.fill('#f-principal', '1000'); pg.fill('#f-installments', '4'); pg.click('text=Comparar opções antes de decidir'); pg.wait_for_selector('text=Simulador de empréstimo')
        check(pg.locator('#sr .card').count() == 6 and pg.input_value('#f-sv') == '1000' and pg.input_value('#f-sm') == '4', 'seis opções com os valores do formulário')
        check(float(pg.input_value('#f-sp')) > 0 and 'Total a pagar' in text('#sla'), 'simulação de atraso')
        pg.click('#sr .card:nth-child(2) button'); pg.wait_for_selector('#f-person'); check(pg.input_value('#f-principal') == '1000' and pg.get_attribute('#sw-interest', 'aria-checked') == 'true' and pg.input_value('#f-installments') == '4', 'Price aplicado no formulário')
        pg.click('.x[aria-label=Fechar]'); pg.click('text=Simular empréstimo'); pg.fill('#f-sv', '2000'); pg.wait_for_function("document.querySelector('#sr').innerText.includes('2.000')"); check(True, 'simulador avulso recalcula')
        pg.click('.x[aria-label=Fechar]')

        print('Pessoas')
        pg.click('text=Gerenciar pessoas'); pg.wait_for_selector('.card.row:has-text("Pedro Novo")'); pg.click('.card.row:has-text("Pedro Novo") >> text=Editar'); pg.fill('#f-nickname', 'Pê'); pg.click('.foot >> text=Salvar')
        pg.wait_for_selector('.card.row:has-text("“Pê”")'); check(True, 'pessoa editada')
        pg.click('.foot >> text=Nova pessoa'); pg.fill('#f-name', 'carlos menezes'); pg.click('.foot >> text=Salvar'); pg.wait_for_selector('#toast:has-text("apelido ou uma observação")'); check(True, 'homônimo exige apelido ou observação')
        pg.click('.x[aria-label=Voltar]'); pg.click('.card.row:has-text("Carlos Menezes") >> text=Editar'); pg.click('text=Excluir pessoa'); pg.wait_for_selector('#toast:has-text("Em uso por")'); check(True, 'pessoa em uso não é excluída')
        pg.click('.x[aria-label=Voltar]'); pg.click('.card.row:has-text("João Pereira") >> text=Ver'); pg.wait_for_selector('text=Total emprestado'); check('Em atraso' in text(), 'Ver abre a pessoa')

        print('Pessoa: cobrança com encargos')
        pg.click('text=Enviar cobrança ou situação'); pg.wait_for_selector('#f-text'); t = pg.input_value('#f-text')
        check('multa moratória' in t and '*Total a pagar:' in t, 'cobrança com multa e juros de mora'); check(pg.get_attribute('#mg-wa', 'href').startswith('https://wa.me/?text='), 'sem telefone: WhatsApp pede o contato')
        pg.click('.seg button:has-text("Situação")'); pg.wait_for_selector('#f-text'); check('*Situação dos empréstimos*' in pg.input_value('#f-text'), 'situação da pessoa')
        pg.click('.x[aria-label=Fechar]'); pg.click('text=Novo empréstimo para João'); pg.wait_for_selector('#f-person'); check(pg.input_value('#f-person') == 'João Pereira', 'novo empréstimo já com a pessoa'); pg.click('.x[aria-label=Fechar]')
        pg.click('.card.tap:has-text("Reforma da cozinha")'); pg.click('.back'); pg.wait_for_selector('text=Total emprestado'); check(True, 'voltar do empréstimo retorna à pessoa')
        pg.click('.back'); pg.wait_for_selector('.seg button[aria-pressed=true]:has-text("Por pessoa")'); check(True, 'voltar da pessoa retorna ao "Por pessoa"')

        print('Excluir')
        pg.click('.seg button:has-text("Lista")'); pg.click('.card.tap:has-text("aluguel")'); pg.click('text=Excluir empréstimo'); pg.click('.btn.dg:has-text("Excluir")'); pg.wait_for_selector('h1:has-text("Empréstimos")')
        check(loans_cards() == 5, 'empréstimo excluído')
        nav('Início'); pg.wait_for_selector('text=Próximos vencimentos'); check(not errs, f'sem erros no console/página {errs}')
        b.close()
finally:
    srv.terminate()
fails = [l for c, l in ok if not c]
print(f'\n{len(ok) - len(fails)}/{len(ok)} verificações passaram'); raise SystemExit(1 if fails else 0)
