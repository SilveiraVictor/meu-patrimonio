import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateOptions, simulateLate } from '../src/domain/loan/simulation.js';
import { createApp } from '../src/main.js';
import { totalInterest } from '../src/domain/loan/amortization.js';

const d = (s) => new Date(s + 'T00:00:00'), today = d('2026-10-24'), clock = { today: () => today };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test('simulador: seis opções coerentes', () => {
  const o = simulateOptions({ value: 1000, ratePct: 2, installments: 3, days: 30 }, today);
  assert.deepEqual(o.map((x) => x.id), ['none', 'price', 'sac', 'single0', 'simple', 'compound']);
  assert.equal(o[0].interest, 0); assert.ok(o[2].interest < o[1].interest); near(o[4].interest, 20); near(o[5].interest, 20, 1e-6);
  assert.equal(o[1].rows.length, 3); assert.equal(o[4].rows.length, 1); near(o[1].total, 1000 + totalInterest(o[1].rows));
  assert.deepEqual([o[2].preset.system, o[5].preset.compounding, o[3].preset.mode], ['sac', 'compound', 'single']);
  near(simulateLate({ installment: 500, finePct: 2, latePct: 1, days: 15 }).total, 500 + 10 + 2.5);
});
test('consultas de empréstimos com os dados de exemplo', async () => {
  const app = await createApp({ storage: mem(), clock }), o = await app.loans.overview();
  assert.equal(o.items.length, 4); assert.equal(o.peopleWithOpen, 4); near(o.openPrincipal, o.items.reduce((a, i) => a + i.loan.balance, 0));
  assert.equal(o.groups[0].name, 'João Pereira'); assert.equal(o.groups[0].badge, 'overdue');
  const det = await app.loans.detail('demo-loan-3'); assert.equal(det.status.code, 'overdue'); assert.ok(det.charges.total > 0); assert.equal(det.rows.length, 5);
  const p = await app.loans.personDetail('demo-pes-1'); assert.equal(p.items.length, 1); assert.ok(p.summary.open > 0);
  assert.equal((await app.loans.receiptOptions('demo-loan-1')).length, 3);
});
test('prévia do formulário, criação e desfazer', async () => {
  const app = await createApp({ storage: mem(), clock });
  const bad = await app.loans.preview({ personId: 'demo-pes-1', principal: 0, system: 'none', installments: 2, firstDue: d('2026-11-01') }); assert.equal(bad.ok, false);
  const ok = await app.loans.preview({ personId: 'demo-pes-1', principal: 1000, system: 'price', monthlyRate: 0.02, installments: 4, firstDue: d('2026-11-01'), fine: 2, lateRate: 1 });
  assert.equal(ok.ok, true); assert.equal(ok.rows.length, 4); assert.ok(ok.lateExample > 0); assert.ok(ok.interest > 0);
  const edit = await app.loans.preview({ installments: 8 }, 'demo-loan-1'); assert.equal(edit.ok, true); assert.equal(edit.loan.remaining, 5);
  assert.equal((await app.loans.preview({ installments: 2 }, 'demo-loan-1')).ok, false);
  const before = (await app.loans.detail('demo-loan-3')).loan.remaining;
  await app.loans.registerPayment('demo-loan-3'); assert.equal((await app.loans.detail('demo-loan-3')).loan.remaining, before - 1);
  assert.equal(await app.loans.undo(), true); assert.equal((await app.loans.detail('demo-loan-3')).loan.remaining, before); assert.equal(await app.loans.undo(), false);
});
