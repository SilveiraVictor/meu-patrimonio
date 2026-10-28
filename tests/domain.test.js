import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, totalInterest } from '../src/domain/loan/amortization.js';
import { payNext, statusOf, scheduleOf } from '../src/domain/loan/loan.js';
import { isValidCpf, isValidCnpj } from '../src/domain/validators.js';
import { irRate, iofRate } from '../src/domain/investment/tax.js';
import { calculateRedemption } from '../src/domain/investment/redemption.js';
import { projectToMaturity } from '../src/domain/investment/yield.js';
import { JsonRepository } from '../src/infrastructure/jsonRepository.js';
import { LoanService } from '../src/application/loanService.js';

const d = (s) => new Date(s + 'T00:00:00');
const base = { principal: 6000, installments: 10, monthlyRate: 0.015, firstDue: d('2026-01-10') };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test('Price: parcela fixa e saldo zerado', () => {
  const r = buildSchedule('price', base);
  near(r[0].payment, r[8].payment, 1e-6); near(r[9].balance, 0);
  near(r.reduce((a, x) => a + x.principal, 0), 6000);
});
test('SAC: amortização constante, parcelas decrescentes', () => {
  const r = buildSchedule('sac', base);
  near(r[0].principal, 600); assert.ok(r[0].payment > r[9].payment);
});
test('Sem juros ignora a taxa', () => near(totalInterest(buildSchedule('none', base)), 0));
test('Pagamento único: juros simples x compostos (30 dias, 3%)', () => {
  const p = { principal: 800, monthlyRate: 0.03, issuedOn: d('2026-01-01'), firstDue: d('2026-01-31') };
  near(buildSchedule('single', { ...p, compounding: 'simple' })[0].interest, 24);
  near(buildSchedule('single', { ...p, compounding: 'compound' })[0].interest, 24);
});
test('Pagar parcela atrasada cobra multa e mora; não muta o original', () => {
  const loan = { system: 'price', balance: 6000, remaining: 10, monthlyRate: 0.015, nextDue: d('2026-01-10'), payments: [], events: [], fine: 2, lateRate: 1 };
  const paid = payNext(loan, d('2026-01-20'));
  assert.equal(loan.remaining, 10); assert.equal(paid.remaining, 9);
  near(paid.payments[0].charges.fine, paid.payments[0].payment * 0.02);
  assert.equal(statusOf(loan, d('2026-01-20')).code, 'overdue');
  assert.equal(scheduleOf(paid).length, 9);
});
test('CPF e CNPJ', () => {
  assert.ok(isValidCpf('529.982.247-25')); assert.ok(!isValidCpf('111.111.111-11'));
  assert.ok(isValidCnpj('11.222.333/0001-81')); assert.ok(!isValidCnpj('11.222.333/0001-82'));
});
test('IR regressivo e IOF', () => {
  assert.equal(irRate('CDB', 180), 0.225); assert.equal(irRate('CDB', 721), 0.15); assert.equal(irRate('LCA', 10), 0);
  assert.equal(iofRate(1), 0.96); assert.equal(iofRate(29), 0.03); assert.equal(iofRate(30), 0);
});
const ind = { cdi: 13.9, selic: 14, ipca: 4.22 };
const cdb = { category: 'CDB', indexer: 'cdi', rate: 110, amount: 4000, appliedOn: d('2026-01-01'), maturity: d('2026-05-01'), redemptions: [] };
test('Projeção e resgate total estimado', () => {
  const p = projectToMaturity(cdb, ind); assert.equal(p.days, 120); assert.ok(p.finalNet > 4000);
  const r = calculateRedemption(cdb, { date: d('2026-05-01'), mode: 'total' }, ind);
  assert.ok(r.grossEstimated && !r.real && r.iof === 0); near(r.net, p.finalNet, 1e-6);
});
test('Valor líquido informado torna o resgate "real"', () => {
  const r = calculateRedemption(cdb, { date: d('2026-05-01'), mode: 'total', net: 4152.21 }, ind);
  assert.ok(r.real); assert.equal(r.net, 4152.21);
});
test('Serviço + repositório: registra pagamento e persiste', async () => {
  const mem = new Map(), storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const repo = new JsonRepository(storage, 'loans');
  await repo.save({ id: 'a', system: 'none', balance: 2400, remaining: 6, monthlyRate: 0, nextDue: d('2026-02-01'), payments: [], events: [] });
  const svc = new LoanService({ loans: repo, clock: { today: () => d('2026-02-01') } });
  await svc.registerPayment('a');
  const saved = await repo.get('a');
  assert.equal(saved.remaining, 5); assert.ok(saved.nextDue instanceof Date);
});
