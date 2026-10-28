import { diffDays } from '../shared/dates.js';
import { scheduleOf, totalInstallments, figuresOf } from '../loan/loan.js';
import { lateCharges } from '../loan/lateFees.js';

const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

/** Parcelas vencidas; se não houver, a próxima. null quando quitado. */
export function collectionModel(loan, today) {
  const rows = scheduleOf(loan); if (!rows.length) return null;
  const late = rows.filter((r) => r.due < today), picked = late.length ? late : [rows[0]], n = totalInstallments(loan);
  const items = picked.map((r) => {
    const number = loan.payments.length + rows.indexOf(r) + 1, charges = lateCharges(loan, r, today), days = diffDays(today, r.due);
    return { number, label: loan.system === 'single' ? 'Pagamento único' : `Parcela ${number}/${n}`, short: loan.system === 'single' ? 'Única' : String(number),
      due: r.due, amount: r.payment, charges, days, value: r.payment + charges.total, state: days < 0 ? 'late' : days === 0 ? 'today' : 'upcoming' };
  });
  return { items, total: sum(items, (i) => i.value), fine: sum(items, (i) => i.charges.fine), lateInterest: sum(items, (i) => i.charges.interest) };
}

export const receiptItems = (loan) => [
  ...loan.payments.map((p) => ({ type: 'installment', date: p.paidOn, amount: p.payment + (p.charges?.total ?? 0), payment: p })),
  ...loan.events.map((e) => ({ type: 'event', date: e.date, amount: e.amount, event: e })),
].sort((a, b) => a.date - b.date);

export const receiptModel = (loan, index) => {
  const item = receiptItems(loan)[index];
  return item ? { item, installments: totalInstallments(loan) } : null;
};

export function statusModel(loan, today) {
  const f = figuresOf(loan, today), future = scheduleOf(loan), n = totalInstallments(loan);
  const table = [
    ...loan.payments.map((p) => ({ label: String(p.number), due: p.due, amount: p.payment + (p.charges?.total ?? 0), state: 'paid' })),
    ...loan.events.map((e) => ({ label: /^Antecipou/.test(e.label) ? 'Antec.' : 'Amort.', due: e.date, amount: e.amount, state: 'paid' })),
    ...future.map((r, k) => ({ label: String(loan.payments.length + k + 1), due: r.due, amount: r.payment, state: r.due < today ? 'late' : 'upcoming' })),
  ];
  return { ...f, lent: loan.principal, withInterest: loan.monthlyRate > 0, paidCount: loan.payments.length, installments: n, settled: loan.remaining === 0,
    nextDue: loan.nextDue, nextPayment: future[0]?.payment ?? 0, toPayNow: f.toPay + f.chargesDue, table };
}

const openLoans = (loans) => loans.filter((l) => l.remaining > 0);
export function personCollectionModel(loans, today) {
  const sections = openLoans(loans).map((l) => ({ loan: l, model: collectionModel(l, today) }));
  return sections.length ? { sections, total: sum(sections, (s) => s.model.total) } : null;
}
export function personStatusModel(loans, today) {
  const lines = openLoans(loans).map((l) => ({ loan: l, toPay: figuresOf(l, today).toPay + figuresOf(l, today).chargesDue, nextPayment: scheduleOf(l)[0].payment }));
  if (!lines.length) return null;
  const overdue = sum(openLoans(loans), (l) => sum(scheduleOf(l).filter((r) => r.due < today), (r) => r.payment + lateCharges(l, r, today).total));
  return { lines, open: sum(lines, (x) => x.toPay), overdue };
}
