import { addMonths, diffDays } from '../shared/dates.js';

/** Monta as parcelas; `principalOf` decide quanto de cada parcela amortiza o saldo. */
function installmentsOf({ principal, installments: n, monthlyRate: i, firstDue }, principalOf) {
  const rows = []; let balance = principal;
  for (let k = 0; k < n; k++) {
    const interest = balance * i;
    const part = k === n - 1 ? balance : principalOf(balance, interest);
    balance = Math.max(0, balance - part);
    rows.push({ due: addMonths(firstDue, k), principal: part, interest, payment: part + interest, balance });
  }
  return rows;
}

const price = (p) => {
  const { principal, installments: n, monthlyRate: i } = p;
  const pmt = i > 0 ? (principal * i) / (1 - (1 + i) ** -n) : principal / n;
  return installmentsOf(p, (_b, interest) => pmt - interest);
};
const sac = (p) => { const a = p.principal / p.installments; return installmentsOf(p, () => a); };
const noInterest = (p) => price({ ...p, monthlyRate: 0 });
const single = ({ principal, monthlyRate: i, issuedOn, firstDue, compounding }) => {
  const t = Math.max(0, diffDays(issuedOn, firstDue)) / 30;
  const interest = i > 0 ? (compounding === 'compound' ? principal * ((1 + i) ** t - 1) : principal * i * t) : 0;
  return [{ due: firstDue, principal, interest, payment: principal + interest, balance: 0 }];
};

/** Registro aberto: novos sistemas entram sem alterar o código existente (OCP). */
export const amortizationSystems = { none: noInterest, price, sac, single };
export const registerSystem = (id, strategy) => { amortizationSystems[id] = strategy; };

export function buildSchedule(system, params) {
  const strategy = amortizationSystems[system];
  if (!strategy) throw new Error(`Sistema de amortização desconhecido: ${system}`);
  return strategy(params);
}
export const totalInterest = (rows) => rows.reduce((a, r) => a + r.interest, 0);
