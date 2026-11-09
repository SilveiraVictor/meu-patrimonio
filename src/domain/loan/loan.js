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

/** Retorna um novo empréstimo com a próxima parcela paga por inteiro (com os encargos de `today`). O registro é montado campo a campo para não copiar as marcas de linha residual. */
export function payNext(loan, today) {
  const [next] = scheduleOf(loan);
  if (!next) throw new Error('Empréstimo já quitado');
  const charges = lateCharges(loan, next, today);
  return {
    ...loan,
    payments: [...loan.payments, { number: loan.payments.length + 1, due: next.due, principal: next.principal, interest: next.interest, payment: next.payment, balance: next.balance, paidOn: today, charges: charges.total > 0 ? charges : null }],
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
  const partials = loan.partials ?? [];
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
  const payCharges = sum(loan.payments, (p) => p.charges?.total ?? 0), partCharges = sum(partials, (p) => p.applied.fine + p.applied.lateInterest);
  const paid = sum(loan.payments, (p) => p.payment) + payCharges + sum(partials, (p) => p.amount) + sum(loan.events, (e) => e.amount);
  const toPay = sum(future, (r) => r.payment);
  const chargesDue = sum(future, (r) => lateCharges(loan, r, today).total);
  return { paid, toPay, chargesDue, total: paid - payCharges - partCharges + toPay };
}
