import { diffDays } from '../shared/dates.js';
import { irRate } from './tax.js';

/** Taxa anual efetiva por indexador. Novos indexadores: basta adicionar uma entrada (OCP). */
export const annualRateBy = {
  fixed: (x) => x.rate / 100,
  cdi: (x, ind) => (ind.cdi / 100) * (x.rate / 100),
  ipca: (x, ind) => (1 + ind.ipca / 100) * (1 + x.rate / 100) - 1,
  selic: (x, ind) => ind.selic / 100 + x.rate / 100,
};
export const annualRate = (inv, ind) => annualRateBy[inv.indexer](inv, ind);

export const termDays = (inv) => inv.termDays ?? (inv.appliedOn && inv.maturity ? diffDays(inv.appliedOn, inv.maturity) : null);
export const startDate = (inv) => inv.appliedOn ?? (termDays(inv) != null ? new Date(inv.maturity.getTime() - termDays(inv) * 864e5) : null);
export const remainingPrincipal = (inv) => Math.max(0, inv.amount - inv.redemptions.reduce((a, r) => a + r.principal, 0));

/** Projeção até o vencimento sobre o valor ainda aplicado; null se não há prazo. */
export function projectToMaturity(inv, ind) {
  const days = termDays(inv), principal = remainingPrincipal(inv);
  if (!(days > 0)) return null;
  const rate = annualRate(inv, ind);
  const gross = principal * ((1 + rate) ** (days / 365) - 1);
  const taxRate = irRate(inv.category, days), tax = gross * taxRate;
  return { days, rate, gross, taxRate, tax, net: gross - tax, finalGross: principal + gross, finalNet: principal + gross - tax };
}
