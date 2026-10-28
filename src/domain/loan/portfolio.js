import { figuresOf, scheduleOf } from './loan.js';
import { lateCharges } from './lateFees.js';

/** Valor atualizado da próxima parcela (parcela + encargos). */
export function nextInstallmentValue(loan, today) {
  const r = scheduleOf(loan)[0];
  return r ? r.payment + lateCharges(loan, r, today).total : 0;
}
const isOpen = (l) => l.remaining > 0;
const inMonth = (d, t) => d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();

export const receivableThisMonth = (loans, today) =>
  loans.filter((l) => isOpen(l) && (l.nextDue < today || inMonth(l.nextDue, today))).reduce((a, l) => a + nextInstallmentValue(l, today), 0);
export const openPrincipal = (loans) => loans.filter(isOpen).reduce((a, l) => a + l.balance, 0);

export function personSummary(loans, today) {
  let lent = 0, received = 0, open = 0, overdue = 0, openCount = 0, nextDue = null;
  for (const l of loans) {
    const f = figuresOf(l, today);
    lent += l.principal; received += f.paid; open += f.toPay + f.chargesDue;
    if (!isOpen(l)) continue;
    openCount++; if (!nextDue || l.nextDue < nextDue) nextDue = l.nextDue;
    for (const r of scheduleOf(l)) if (r.due < today) overdue += r.payment + lateCharges(l, r, today).total;
  }
  return { lent, received, open, overdue, openCount, nextDue, badge: overdue > 0 ? 'overdue' : openCount ? 'onTime' : 'settled' };
}

/** Pessoas com atraso primeiro; depois, maior valor em aberto. */
export function groupByPerson(loans, today) {
  const by = Map.groupBy(loans, (l) => l.personId);
  return [...by].map(([personId, ls]) => ({ personId, loans: ls, ...personSummary(ls, today) }))
    .sort((a, b) => (b.overdue > 0) - (a.overdue > 0) || b.open - a.open);
}
