import { addDays, addMonths } from '../domain/shared/dates.js';
import { buildInvestment, recordRedemption } from '../domain/investment/investment.js';
import { resolveTerm } from '../domain/investment/term.js';
import { DEFAULT_INDICATORS } from '../domain/investment/indicators.js';
import { createLoan } from '../domain/loan/factory.js';
import { payNext } from '../domain/loan/loan.js';

/** Dados de exemplo da primeira execução. Tudo marcado com demo:true para "Apagar exemplos". */
export function demoData(today) {
  const D = (n) => addDays(today, n), insts = new Map();
  const I = (name) => { if (!insts.has(name)) insts.set(name, { id: `demo-inst-${insts.size + 1}`, name, cnpj: '', note: '', demo: true }); return insts.get(name).id; };
  // nome, custodiante, emissor, categoria, indexador, taxa, valor, aplicação (dias), vencimento (dias), extras
  const specs = [
    ['Tesouro IPCA+ 2029', 'Banco XPTO', 'Tesouro Nacional', 'Tesouro Direto', 'ipca', 6.2, 12000, -420, 18, { rule: 'daily' }],
    ['CDB Banco Azul 112% CDI', 'Banco Azul', 'Banco Azul', 'CDB', 'cdi', 112, 5000, -200, 95, { grace: 90, rule: 'penalty', penalty: '10% sobre o rendimento' }],
    ['LCA Banco ABC 11%', 'Banco XPTO', 'Banco ABC', 'LCA', 'fixed', 11, 8000, -60, 240, { grace: 90 }],
    ['CDB Banco Beta 105% CDI', 'Banco XPTO', 'Banco Beta', 'CDB', 'cdi', 105, 2000, null, 150, { term: 240, rule: 'daily' }],
    ['LCI Banco Gama 93% CDI', 'Banco XPTO', 'Banco Gama', 'LCI', 'cdi', 93, 3000, null, 400, {}],
    ['CDB Banco Delta 110% CDI', 'Banco XPTO', 'Banco Delta', 'CDB', 'cdi', 110, 4000, -130, -10, {}],
    ['LC Banco Épsilon 102% CDI', 'Banco XPTO', 'Banco Épsilon', 'LC', 'cdi', 102, 2500, -200, -3, {}],
  ];
  let investments = specs.map(([name, c, e, category, indexer, rate, amount, ap, mat, x], k) => {
    const i = { id: `demo-inv-${k + 1}`, name, custodianId: I(c), issuerId: I(e), category, indexer, rate, amount, appliedOn: ap == null ? null : D(ap), maturity: D(mat), graceDays: x.grace, redemptionRule: x.rule, penaltyNote: x.penalty };
    return { ...buildInvestment(i, resolveTerm({ appliedOn: i.appliedOn, maturity: i.maturity, informed: x.term })), demo: true };
  });
  const done = recordRedemption(investments[5], { date: D(-10), mode: 'total', gross: 4196.4, net: 4152.21 }, DEFAULT_INDICATORS, 'demo-red-1').investment;
  investments = investments.map((i) => (i.id === done.id ? { ...done, demo: true } : i));

  const person = (n, name, nickname, phone, extra = {}) => ({ id: `demo-pes-${n}`, name, nickname, note: '', cpf: '', pix: '', phone, email: '', demo: true, ...extra });
  const people = [person(1, 'Carlos Menezes', 'Carlão', '(77) 99999-0001', { pix: 'carlos@email.com', email: 'carlos@email.com' }), person(2, 'Mariana Souza', 'Mari', '(77) 98888-0002'), person(3, 'João Pereira', '', ''), person(4, 'Rafael Lima', '', '')];
  const loan = (o) => ({ ...createLoan(o), demo: true });
  const paid = (l, n) => { for (let k = 0; k < n; k++) l = payNext(l, l.nextDue); return l; };
  const loans = [
    paid(loan({ id: 'demo-loan-1', personId: 'demo-pes-1', principal: 6000, system: 'price', monthlyRate: 0.015, installments: 10, firstDue: addMonths(today, -2), description: 'Caixa de som comprada no meu cartão de crédito' }), 3),
    paid(loan({ id: 'demo-loan-2', personId: 'demo-pes-2', principal: 2400, system: 'none', installments: 6, firstDue: addMonths(today, -1) }), 2),
    loan({ id: 'demo-loan-3', personId: 'demo-pes-3', principal: 3000, system: 'sac', monthlyRate: 0.02, installments: 5, firstDue: D(-5), description: 'Reforma da cozinha', fine: 2, lateRate: 1 }),
    loan({ id: 'demo-loan-4', personId: 'demo-pes-4', principal: 800, system: 'single', monthlyRate: 0.03, issuedOn: D(-16), firstDue: D(12), compounding: 'simple', description: 'Dinheiro emprestado para o aluguel', fine: 2, lateRate: 1 }),
  ];
  return { investments, loans, people, institutions: [...insts.values()], indicators: { ...DEFAULT_INDICATORS }, creditor: { name: '', pix: '' } };
}
