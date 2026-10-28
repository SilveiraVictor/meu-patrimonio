import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoan } from '../src/domain/loan/factory.js';
import { payNext, scheduleOf, figuresOf } from '../src/domain/loan/loan.js';
import { anticipate, amortize, previewAmortization } from '../src/domain/loan/prepayment.js';
import { reviseLoan, revisionImpact } from '../src/domain/loan/revision.js';
import { groupByPerson, receivableThisMonth, openPrincipal } from '../src/domain/loan/portfolio.js';
import { totalInterest } from '../src/domain/loan/amortization.js';
import { diffDays } from '../src/domain/shared/dates.js';
import { LoanService } from '../src/application/loanService.js';
import { JsonRepository } from '../src/infrastructure/jsonRepository.js';

const d = (s) => new Date(s + 'T00:00:00');
const today = d('2026-03-15');
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const price = (o = {}) => createLoan({ id: 'a', personId: 'p1', principal: 6000, system: 'price', monthlyRate: 0.015, installments: 10, firstDue: d('2026-04-10'), ...o });

test('createLoan valida e normaliza', () => {
  assert.throws(() => price({ personId: '' }), /quem recebeu/);
  assert.throws(() => price({ principal: 0 }), RangeError);
  assert.throws(() => price({ system: 'single', issuedOn: d('2026-05-01'), firstDue: d('2026-04-10') }), /posterior/);
  const none = price({ system: 'none' }); assert.equal(none.monthlyRate, 0);
  const single = price({ system: 'single', issuedOn: d('2026-03-01'), installments: 7 }); assert.equal(single.remaining, 1);
});
const pv = (rows, l, t) => rows.reduce((a, r) => a + r.payment / (1 + l.monthlyRate) ** (diffDays(t, r.due) / 30), 0);
test('antecipar (matemática financeira): paga o valor presente das últimas parcelas e mantém as demais', () => {
  const l = price(), before = scheduleOf(l), r = anticipate(l, 3, today), after = scheduleOf(r), ev = r.events[0];
  near(ev.amount, pv(before.slice(-3), l, today));            // PV à taxa do contrato
  near(ev.nominal, before.slice(-3).reduce((a, x) => a + x.payment, 0));
  near(ev.savedInterest, ev.nominal - ev.amount); assert.ok(ev.amount < ev.nominal);
  assert.equal(r.remaining, 7); assert.equal(after.length, 7);
  after.forEach((x, k) => { near(x.payment, before[k].payment); assert.equal(+x.due, +before[k].due); });
  near(after[6].balance, 0); near(r.balance, after.reduce((s, x) => s + x.principal, 0));
  near(pv(before, l, today), ev.amount + pv(after, l, today));   // valor total da dívida é preservado
  assert.equal(anticipate(l, 10, today).remaining, 0);
  assert.throws(() => anticipate(l, 11, today), RangeError);
});
test('antecipar no SAC mantém as parcelas restantes; sem juros paga o valor nominal', () => {
  const s = price({ system: 'sac' }), bs = scheduleOf(s), rs = scheduleOf(anticipate(s, 2, today));
  rs.forEach((x, k) => near(x.payment, bs[k].payment)); near(rs.reduce((a, x) => a + x.principal, 0), 6000 - bs.slice(-2).reduce((a, x) => a + x.principal, 0));
  const n = price({ system: 'none' }), e = anticipate(n, 2, today).events[0]; near(e.amount, 1200); near(e.savedInterest, 0);
});
test('antecipar e depois pagar tudo quita; amortizar depois recalcula e limpa o plano', () => {
  let l = anticipate(price(), 3, today);
  for (let k = 0; k < 7; k++) l = payNext(l, today);
  assert.equal(l.remaining, 0); near(l.balance, 0); assert.equal(l.plan, null);
  const a = amortize(anticipate(price(), 3, today), 1000, 'term', today); assert.equal(a.plan, null); assert.ok(a.remaining < 7);
});
test('amortizar: reduzir prazo mantém a parcela; reduzir parcela mantém o prazo', () => {
  const l = price(), pmt = scheduleOf(l)[0].payment;
  const term = amortize(l, 2000, 'term', today), inst = amortize(l, 2000, 'installment', today);
  assert.ok(term.remaining < 10); assert.ok(scheduleOf(term)[0].payment <= pmt + 1e-6);
  assert.equal(inst.remaining, 10); assert.ok(scheduleOf(inst)[0].payment < pmt);
  assert.ok(term.events[0].savedInterest > 0);
  const quit = amortize(l, 6000, 'term', today); assert.equal(quit.remaining, 0); assert.equal(quit.balance, 0);
  assert.throws(() => previewAmortization(l, 7000, 'term'), RangeError);
});
test('amortização no SAC e sem juros', () => {
  assert.equal(amortize(price({ system: 'sac' }), 1200, 'term', today).remaining, 8);
  assert.equal(amortize(price({ system: 'none' }), 1200, 'term', today).remaining, 8);
});
test('pagamento único não permite antecipar', () => {
  const s = price({ system: 'single', issuedOn: d('2026-03-01') });
  assert.throws(() => anticipate(s, 1, today), /único/);
});
test('revisar: descrição não mexe no cronograma; taxa recalcula e mantém pagamentos', () => {
  const paid = payNext(payNext(price(), d('2026-04-10')), d('2026-05-10'));
  const meta = reviseLoan(paid, { description: 'Reforma' });
  assert.equal(meta.description, 'Reforma'); assert.equal(meta.balance, paid.balance);
  assert.equal(revisionImpact(paid, { description: 'x' }).changed, false);
  const r = reviseLoan(paid, { monthlyRate: 0.02 });
  assert.equal(r.payments.length, 2); assert.equal(r.remaining, 8);
  assert.ok(totalInterest(scheduleOf(r)) > totalInterest(scheduleOf(paid)));
  near(r.nextDue - d('2026-06-10'), 0);
});
test('revisar: bloqueios e confirmação por eventos', () => {
  const paid = payNext(price(), d('2026-04-10'));
  assert.throws(() => reviseLoan(paid, { installments: 0 }), RangeError);
  assert.throws(() => reviseLoan(paid, { system: 'single', issuedOn: d('2026-01-01') }), /trocar/);
  const withEvent = anticipate(price(), 1, today);
  const imp = revisionImpact(withEvent, { installments: 12 });
  assert.ok(imp.changed && imp.discardsEvents);
  assert.equal(reviseLoan(withEvent, { installments: 12 }).events.length, 0);
});
test('carteira: a receber no mês, em aberto e agrupamento por pessoa', () => {
  const a = price({ id: 'a', personId: 'p1', fine: 2, lateRate: 1, firstDue: d('2026-03-01') });
  const b = price({ id: 'b', personId: 'p2', firstDue: d('2026-03-20'), principal: 3000 });
  const c = payNext(price({ id: 'c', personId: 'p2', system: 'none', installments: 1, principal: 500 }), d('2026-04-01'));
  const loans = [b, a, c];
  assert.ok(receivableThisMonth(loans, today) > scheduleOf(a)[0].payment);
  near(openPrincipal(loans), 9000);
  const g = groupByPerson(loans, today);
  assert.equal(g[0].personId, 'p1'); assert.equal(g[0].badge, 'overdue');
  assert.equal(g[1].openCount, 1); near(g[1].lent, 3500);
  near(figuresOf(c, today).paid, 500);
});
test('LoanService: criar, antecipar, revisar, resumir', async () => {
  const mem = new Map(), repo = new JsonRepository({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }, 'l');
  const svc = new LoanService({ loans: repo, clock: { today: () => today }, newId: () => 'x1' });
  await svc.create({ personId: 'p1', principal: 1000, system: 'sac', monthlyRate: 0.02, installments: 4, firstDue: d('2026-04-01') });
  assert.equal((await svc.previewAnticipation('x1', 2)).remaining, 2);
  assert.equal((await svc.anticipate('x1', 2)).remaining, 2);
  assert.ok((await repo.get('x1')).events[0].date instanceof Date);
  assert.equal((await svc.revise('x1', { installments: 6 })).remaining, 6);
  assert.equal((await svc.byPerson())[0].openCount, 1);
  assert.equal((await svc.home()).overdue.length, 0);
  await assert.rejects(svc.registerPayment('nope'), /não encontrado/);
  await svc.remove('x1'); assert.equal((await repo.list()).length, 0);
});
