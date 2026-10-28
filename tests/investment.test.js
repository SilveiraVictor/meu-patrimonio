import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTerm } from '../src/domain/investment/term.js';
import { buildInvestment, reviseInvestment, investmentStatus, progress, graceEnds, recordRedemption, editRedemption, deleteRedemption, redemptionWarnings, summarizeRedemptions, isRedeemed, InvestmentError } from '../src/domain/investment/investment.js';
import { portfolioTotals, upcomingEvents, activeInvestments, redeemedInvestments } from '../src/domain/investment/portfolio.js';
import { createLoan } from '../src/domain/loan/factory.js';
import { InvestmentService } from '../src/application/investmentService.js';
import { JsonRepository } from '../src/infrastructure/jsonRepository.js';

const d = (s) => new Date(s + 'T00:00:00'), today = d('2026-06-01'), ind = { cdi: 13.9, selic: 14, ipca: 4.22 };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const base = { id: 'i1', name: 'CDB Delta 110% CDI', custodianId: 'c', issuerId: 'e', category: 'CDB', indexer: 'cdi', rate: 110, amount: 4000, appliedOn: d('2026-01-01'), maturity: d('2026-05-01') };
const make = (o = {}) => { const i = { ...base, ...o }; return buildInvestment(i, resolveTerm({ appliedOn: i.appliedOn, maturity: i.maturity, informed: i.termDays })); };

test('prazo: calculado, informado, conflito e decisão por combinação', () => {
  const a = d('2026-01-01'), m = d('2026-05-01');
  assert.deepEqual([resolveTerm({ appliedOn: a, maturity: m }).term, resolveTerm({ appliedOn: a, maturity: m }).source], [120, 'calculated']);
  assert.equal(resolveTerm({ appliedOn: a, maturity: m, informed: 120 }).source, 'calculated');
  assert.equal(resolveTerm({ maturity: m, informed: 240 }).source, 'informed');
  assert.equal(resolveTerm({ maturity: m }).status, 'missing');
  const c = resolveTerm({ appliedOn: a, maturity: m, informed: 100 });
  assert.equal(c.status, 'conflict'); assert.equal(c.calculated, 120);
  assert.equal(resolveTerm({ appliedOn: a, maturity: m, informed: 100, decision: { key: c.key, choice: 'use-calculated' } }).term, 120);
  assert.equal(resolveTerm({ appliedOn: a, maturity: m, informed: 100, decision: { key: c.key, choice: 'keep-informed' } }).source, 'informed');
  assert.equal(resolveTerm({ appliedOn: a, maturity: m, informed: 90, decision: { key: c.key, choice: 'keep-informed' } }).status, 'conflict'); // mudou: pergunta de novo
});
test('buildInvestment valida e bloqueia conflito de prazo', () => {
  assert.throws(() => make({ name: ' ' }), InvestmentError); assert.throws(() => make({ amount: 0 }), /maior que zero/);
  assert.throws(() => make({ maturity: d('2025-12-01') }), /depois da aplicação/);
  assert.throws(() => buildInvestment(base, resolveTerm({ ...base, informed: 99 })), /Escolha qual prazo/);
  const sem = buildInvestment({ ...base, appliedOn: null }, resolveTerm({ maturity: base.maturity }));
  assert.equal(sem.termDays, null); assert.equal(make().termDays, 120);
  assert.equal(reviseInvestment(make(), { name: 'Novo' }, resolveTerm({ ...base })).name, 'Novo');
});
test('status, progresso e carência', () => {
  const i = make({ maturity: d('2026-07-01'), appliedOn: d('2026-05-01'), graceDays: 30 });
  assert.deepEqual(investmentStatus(i, today), { code: 'upcoming', days: 30, attention: true });
  assert.equal(investmentStatus(i, d('2026-07-01')).code, 'today'); assert.equal(investmentStatus(i, d('2026-06-30')).code, 'tomorrow');
  assert.equal(investmentStatus(i, d('2026-07-05')).code, 'matured'); near(progress(i, d('2026-06-01')), (31 / 61) * 100);
  assert.equal(+graceEnds(i), +d('2026-05-31')); assert.equal(progress(make({ appliedOn: null, termDays: null }), today), null);
});
test('resgate: registrar, editar (ignora o próprio), excluir e resumo', () => {
  const i = make(), s = (inv) => summarizeRedemptions(inv);
  const p = recordRedemption(i, { date: d('2026-03-02'), mode: 'partial', gross: 2000 }, ind, 'r1');
  assert.ok(!isRedeemed(p.investment)); assert.ok(p.record.principal < 2000 && p.record.principal > 1800);
  const t = recordRedemption(p.investment, { date: d('2026-05-01'), mode: 'total', net: 2300 }, ind, 'r2');
  assert.ok(isRedeemed(t.investment)); assert.equal(t.investment.redemptions.map((r) => r.id).join(), 'r1,r2');
  const sm = s(t.investment); near(sm.principal, 4000); assert.equal(sm.real, false); assert.ok(sm.perYear > 0);
  const e = editRedemption(t.investment, 'r1', { date: d('2026-03-02'), mode: 'partial', gross: 2000, net: 1990 }, ind);
  assert.ok(e.record.real); assert.equal(e.investment.redemptions.length, 2);
  assert.equal(deleteRedemption(t.investment, 'r2').redemptions.length, 1); assert.ok(!isRedeemed(deleteRedemption(t.investment, 'r2')));
  assert.throws(() => recordRedemption(i, { date: d('2025-12-01'), mode: 'total' }, ind, 'x'), /anterior à aplicação/);
  assert.throws(() => recordRedemption(make({ appliedOn: null, termDays: null }), { date: today, mode: 'total' }, ind, 'x'), /valor bruto ou o líquido/);
  assert.throws(() => editRedemption(i, 'nope', { date: today, mode: 'total' }, ind), /não encontrado/);
});
test('avisos de resgate', () => {
  const v = make({ redemptionRule: 'maturity' }), g = make({ redemptionRule: 'daily', graceDays: 90 }), pn = make({ redemptionRule: 'penalty', penaltyNote: ' 10% ' });
  assert.equal(redemptionWarnings(v, d('2026-03-01'))[0].code, 'maturity-only'); assert.equal(redemptionWarnings(v, d('2026-05-01')).length, 0);
  assert.equal(redemptionWarnings(g, d('2026-02-01'))[0].code, 'grace'); assert.equal(redemptionWarnings(pn, d('2026-03-01'))[0].code, 'penalty'); assert.equal(pn.penaltyNote, '10%');
});
test('carteira: totais com título sem prazo, resgatados e próximos vencimentos', () => {
  const a = make({ id: 'a', maturity: d('2026-09-01') }), noTerm = buildInvestment({ ...base, id: 'b', appliedOn: null, amount: 1000, maturity: d('2026-08-01') }, resolveTerm({ maturity: d('2026-08-01') }));
  const done = recordRedemption(make({ id: 'c' }), { date: d('2026-05-01'), mode: 'total' }, ind, 'r').investment;
  const tot = portfolioTotals([a, noTerm, done], ind);
  assert.equal(tot.count, 2); near(tot.applied, 5000); assert.equal(tot.missingTerm, 1); assert.ok(tot.netAtMaturity > 5000);
  assert.deepEqual(activeInvestments([a, noTerm, done]).map((x) => x.id), ['b', 'a']); assert.deepEqual(redeemedInvestments([a, done]).map((x) => x.id), ['c']);
  const loan = createLoan({ id: 'l', personId: 'p', principal: 600, system: 'none', installments: 3, firstDue: d('2026-06-10') });
  const up = upcomingEvents([a, noTerm, done], [loan], today, 2);
  assert.deepEqual(up.map((x) => [x.kind, x.id]), [['loan', 'l'], ['investment', 'b']]); near(up[0].amount, 200);
});
test('InvestmentService: criar com conflito, registrar resgate, visão e totais', async () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  let n = 0; const svc = new InvestmentService({ investments: new JsonRepository(mem(), 'i'), loans: new JsonRepository(mem(), 'l'), institutions: new JsonRepository(mem(), 'n'), indicators: { get: async () => ind }, clock: { today: () => today }, newId: () => 'id' + ++n });
  const input = { ...base, id: undefined, termDays: 100 };
  assert.equal(svc.term(input).status, 'conflict'); await assert.rejects(svc.create(input), /Escolha qual prazo/);
  const ok = await svc.create({ ...input, termDecision: { key: svc.term(input).key, choice: 'use-calculated' } });
  assert.equal(ok.termDays, 120);
  const rec = await svc.registerRedemption(ok.id, { date: d('2026-05-01'), mode: 'total' });
  assert.ok(rec.id.startsWith('r')); const v = await svc.view(ok.id);
  assert.equal(v.status.code, 'redeemed'); assert.ok(v.summary.percent > 0);
  assert.equal((await svc.totals()).count, 0); assert.equal((await svc.revise(ok.id, { name: 'Renomeado' })).name, 'Renomeado');
  await svc.deleteRedemption(ok.id, rec.id); assert.equal((await svc.view(ok.id)).status.code, 'matured');
  await assert.rejects(svc.registerRedemption('zzz', {}), /não encontrado/);
});
