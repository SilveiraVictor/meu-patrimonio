import { addMonths } from '../shared/dates.js';
import { buildSchedule } from './amortization.js';
import { lateCharges } from './lateFees.js';

/** Parcelas ainda não pagas. Após uma antecipação, vale o plano (`loan.plan`) com as parcelas restantes inalteradas. */
export const scheduleOf = (loan) => loan.remaining > 0
  ? loan.plan ?? buildSchedule(loan.system, {
      principal: loan.balance, installments: loan.remaining, monthlyRate: loan.monthlyRate,
      firstDue: loan.nextDue, issuedOn: loan.issuedOn, compounding: loan.compounding,
    })
  : [];

export const totalInstallments = (loan) => loan.payments.length + loan.remaining;

/** Retorna um novo empréstimo com a próxima parcela paga. */
export function payNext(loan, today) {
  const [next] = scheduleOf(loan);
  if (!next) throw new Error('Empréstimo já quitado');
  const charges = lateCharges(loan, next, today);
  return {
    ...loan,
    payments: [...loan.payments, { ...next, number: loan.payments.length + 1, paidOn: today, charges: charges.total > 0 ? charges : null }],
    balance: next.balance,
    remaining: loan.remaining - 1,
    nextDue: addMonths(loan.nextDue, 1),
    plan: loan.plan && loan.remaining > 1 ? loan.plan.slice(1) : null,
  };
}

export function statusOf(loan, today) {
  if (loan.remaining === 0) return { code: 'settled' };
  if (loan.nextDue < today) return { code: 'overdue', days: Math.round((today - loan.nextDue) / 864e5) };
  return { code: loan.nextDue.getTime() === today.getTime() ? 'dueToday' : 'onTime' };
}

export function figuresOf(loan, today) {
  const future = scheduleOf(loan);
  const chargesPaid = loan.payments.reduce((a, p) => a + (p.charges?.total ?? 0), 0);
  const paid = loan.payments.reduce((a, p) => a + p.payment, 0) + chargesPaid + loan.events.reduce((a, e) => a + e.amount, 0);
  const toPay = future.reduce((a, r) => a + r.payment, 0);
  const chargesDue = future.reduce((a, r) => a + lateCharges(loan, r, today).total, 0);
  return { paid, toPay, chargesDue, total: paid - chargesPaid + toPay };
}
