import test from 'node:test';
import assert from 'node:assert/strict';
import { html, raw, escape } from '../src/presentation/html.js';
import { chip, card, button, kv, navBar, bar, seg, alert } from '../src/presentation/components.js';
import { navigate, initialState, routeOf, fabVisible, fabLabel } from '../src/presentation/navigation.js';
import { Store } from '../src/presentation/store.js';
import { dueChip, loanChip, investmentChip, personBadge, rateLabel, systemLabel, redemptionLabel } from '../src/presentation/presenters.js';
import { brl, pct, shortDate } from '../src/presentation/format.js';
import { homeView } from '../src/presentation/views/home.js';
import { createController } from '../src/presentation/controller.js';
import { createApp } from '../src/main.js';

const d = (s) => new Date(s + 'T00:00:00'), today = d('2026-10-24'), clock = { today: () => today };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('html escapa por padrão e aceita trechos seguros', () => {
  const evil = '<img src=x onerror="alert(1)">';
  assert.equal(String(html`<b>${evil}</b>`), '<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b>');
  assert.equal(String(html`<i>${raw('<u>ok</u>')}${[1, html`<s>${'<'}</s>`]}${null}${false}</i>`), '<i><u>ok</u>1<s>&lt;</s></i>');
  assert.equal(escape(`'"&`), '&#39;&quot;&amp;');
});
test('componentes: atributos de ação escapados e estados', () => {
  assert.equal(String(chip('Em dia', 'ok')), '<span class="chip ok">Em dia</span>');
  assert.match(String(card('x', { action: 'openLoan', arg: 'a"b', cls: 'row' })), /^<button class="card tap row" data-action="openLoan" data-arg="a&quot;b">x<\/button>$/);
  assert.match(String(button('Ir', { variant: 'sec', disabled: true, action: 'go', arg: 'home' })), /class="btn sec" data-action="go" data-arg="home" disabled/);
  assert.match(String(kv([['A', '<x>']])), /<b>&lt;x&gt;<\/b>/); assert.match(String(bar(40, { attention: true })), /bar or.*width:40%/);
  assert.match(String(seg([['a', 'A'], ['b', 'B']], 'b', 'pick')), /aria-pressed="false" data-action="pick" data-arg="a".*aria-pressed="true"/);
  assert.match(String(alert('oi', { tone: 'info' })), /alert info/);
  const nav = String(navBar({ ...initialState, tab: 'loans' }));
  assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1); assert.match(nav, /aria-current="page" data-action="go" data-arg="loans"/);
  assert.doesNotMatch(String(navBar({ ...initialState, tab: 'loans', loanId: 'x' })), /aria-current/);
  assert.doesNotMatch(nav, /<\/button>,<button/); assert.equal(nav.startsWith('<button'), true);
});
test('navegação: reducers puros, voltar e rotas', () => {
  const s = initialState, inv = navigate.openInvestment(s, 'i1');
  assert.deepEqual([routeOf(inv), inv.tab, fabVisible(inv)], ['investment-detail', 'investments', false]);
  assert.equal(routeOf(navigate.go(inv, 'loans')), 'loans'); assert.equal(navigate.back(inv).tab, 'investments');
  const viaPerson = navigate.openLoanFrom(navigate.openPerson(s, 'p1'), 'l1', 'p1');
  assert.equal(routeOf(viaPerson), 'loan-detail'); assert.equal(routeOf(navigate.back(viaPerson)), 'person-detail');
  const fromList = navigate.openLoan(s, 'l1'); assert.equal(routeOf(navigate.back(fromList)), 'loans');
  const back = navigate.back(navigate.openPerson(s, 'p1')); assert.deepEqual([routeOf(back), back.loansView], ['loans', 'person']);
  assert.equal(navigate.back(s), s); assert.equal(fabVisible({ ...s, tab: 'settings' }), false); assert.equal(fabLabel({ ...s, tab: 'loans' }), 'Novo empréstimo'); assert.equal(fabLabel(s), 'Adicionar');
  assert.equal(Object.isFrozen(initialState), true);
});
test('store notifica só quando o estado muda', () => {
  const st = new Store(initialState); let calls = 0; const off = st.subscribe(() => calls++);
  st.dispatch(navigate.back); assert.equal(calls, 0); st.dispatch(navigate.go, 'loans'); assert.equal(calls, 1);
  off(); st.dispatch(navigate.go, 'home'); assert.equal(calls, 1); assert.equal(st.get().tab, 'home');
});
test('apresentadores e formatadores', () => {
  assert.deepEqual([dueChip(-3), dueChip(0), dueChip(1), dueChip(20), dueChip(90)], [['3d em atraso', 'bad'], ['Hoje', 'or'], ['Amanhã', 'or'], ['em 20 dias', 'or'], ['em 90 dias', 'blue']]);
  assert.deepEqual(loanChip({ code: 'overdue', days: 5 }), ['5d em atraso', 'bad']); assert.deepEqual(investmentChip({ code: 'matured' }), ['Venceu', 'or']);
  assert.deepEqual(personBadge('settled'), ['Quitado', '']);
  assert.equal(rateLabel({ indexer: 'ipca', rate: 6.2 }), 'IPCA + 6,2% a.a.'); assert.equal(rateLabel({ indexer: 'cdi', rate: 112 }), '112% do CDI');
  assert.equal(systemLabel({ system: 'single', monthlyRate: 0.03, compounding: 'compound' }), 'Pagamento único (juros compostos) · 3% a.m.');
  assert.equal(redemptionLabel({ redemptionRule: 'daily', graceDays: 90 }), 'Liquidez diária · carência de 90 dias');
  assert.match(brl(1234.5), /R\$\s?1\.234,50/); assert.equal(pct(11), '11%'); assert.equal(shortDate(d('2026-03-10')), '10 de mar de 26');
});
test('tela inicial com os dados de exemplo', async () => {
  const app = await createApp({ storage: mem(), clock }), m = await homeView.load(app), out = String(homeView.render(m));
  assert.match(out, /Você está vendo dados de exemplo/); assert.match(out, /data-action="clearDemo.confirm"/);
  assert.match(out, /Título vencido sem resgate registrado/); assert.match(out, /3<span[^>]*> dias atrás/);
  assert.match(out, /1 parcela atrasada: João/); assert.match(out, /A receber este mês/);
  assert.equal((out.match(/class="card tap row"/g) ?? []).length, 6); assert.match(out, /data-action="openInvestment" data-arg="demo-inv-7"/);
  assert.match(out, /Devolução de Rafael/); assert.match(out, /Pagamento único · /);
  await app.backup.wipe('APAGAR'); const e = String(homeView.render(await homeView.load(app)));
  assert.match(e, /Nenhum título cadastrado/); assert.match(e, /Nada por aqui ainda/); assert.doesNotMatch(e, /dados de exemplo/);
});
test('tela inicial escapa nomes vindos do usuário', async () => {
  const app = await createApp({ storage: mem(), clock }); await app.backup.wipe('apagar');
  const p = await app.people.create({ name: '<script>x</script> Silva' });
  await app.loans.create({ personId: p.id, principal: 100, system: 'none', installments: 1, firstDue: d('2026-10-01') });
  const out = String(homeView.render(await homeView.load(app)));
  assert.doesNotMatch(out, /<script>/); assert.match(out, /&lt;script&gt;x&lt;\/script&gt;/);
});
test('controlador: rota → tela, ações e descarte de respostas atrasadas', async () => {
  const log = [], shell = { render: (h, k) => log.push(['render', h, k]), setNav: (s) => log.push(['nav', s.tab]), setFab: (f) => log.push(['fab', f.visible, f.label]), onAction(fn) { this.fire = fn; } };
  let release; const slow = new Promise((r) => { release = r; });
  const views = { home: { load: async () => 'H', render: (m) => `home:${m}` }, loans: { load: async () => { await slow; return 'L'; }, render: (m) => `loans:${m}` }, fallback: { load: async () => null, render: () => 'fb' } };
  const store = new Store(initialState), c = createController({ app: {}, store, shell, views, actions: { custom: (a) => log.push(['custom', a]) } });
  await c.render(); assert.deepEqual(log.slice(0, 3), [['render', 'home:H', 'home|'], ['nav', 'home'], ['fab', true, 'Adicionar']]);
  shell.fire('go', 'loans'); shell.fire('go', 'settings'); release(); await new Promise((r) => setTimeout(r, 10));
  const renders = log.filter((x) => x[0] === 'render').map((x) => x[1]); assert.deepEqual(renders, ['home:H', 'fb']);
  shell.fire('custom', 'z'); shell.fire('inexistente'); assert.ok(log.some((x) => x[0] === 'custom' && x[1] === 'z'));
});

import { warningText } from '../src/presentation/forms/redemptionForm.js';
test('avisos de resgate: cada código monta só o seu texto', () => {
  assert.match(warningText({ code: 'penalty' }), /penalidade/);
  assert.match(warningText({ code: 'grace', until: d('2026-05-31') }), /carência \(até 31\/05\/2026\)/);
  assert.match(warningText({ code: 'maturity-only', date: d('2026-12-01') }), /01\/12\/2026/);
});
