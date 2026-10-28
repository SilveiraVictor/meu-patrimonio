import { isRedeemed } from './investment.js';
import { projectToMaturity, remainingPrincipal } from './yield.js';
import { nextInstallmentValue } from '../loan/portfolio.js';
import { totalInstallments } from '../loan/loan.js';

export const activeInvestments = (invs) => invs.filter((i) => !isRedeemed(i)).sort((a, b) => a.maturity - b.maturity);
export const redeemedInvestments = (invs) => invs.filter((i) => isRedeemed(i) && i.redemptions.length);

/** Cabeçalho de Investimentos; título sem prazo entra pelo valor aplicado. */
export function portfolioTotals(invs, indicators) {
  let applied = 0, netAtMaturity = 0, missingTerm = 0;
  const active = activeInvestments(invs);
  for (const i of active) {
    const principal = remainingPrincipal(i), p = projectToMaturity(i, indicators);
    applied += principal; netAtMaturity += p ? p.finalNet : principal; if (!p) missingTerm++;
  }
  return { count: active.length, applied, netAtMaturity, missingTerm };
}

/** Próximos vencimentos: títulos ainda aplicados e próximas parcelas, em ordem de data. */
export function upcomingEvents(invs, loans, today, limit = 6) {
  return [
    ...activeInvestments(invs).map((i) => ({ kind: 'investment', id: i.id, date: i.maturity, amount: remainingPrincipal(i), overdue: i.maturity < today })),
    ...loans.filter((l) => l.remaining > 0).map((l) => ({ kind: 'loan', id: l.id, date: l.nextDue, amount: nextInstallmentValue(l, today), single: l.system === 'single', number: l.payments.length + 1, total: totalInstallments(l), overdue: l.nextDue < today })),
  ].sort((a, b) => a.date - b.date).slice(0, limit);
}
