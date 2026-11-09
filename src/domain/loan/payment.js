import { payNext, scheduleOf } from './loan.js';
import { lateCharges } from './lateFees.js';
import { amortize, nominalPrepay } from './prepayment.js';

const CENT = 0.01, MODES = ['term', 'installment', 'nominal'], PARTS = ['fine', 'lateInterest', 'interest', 'principal'];

/** O que a próxima parcela custa se for paga em `paidOn`: multa e mora são calculadas nessa data. */
export function dueAt(loan, paidOn) {
  const row = scheduleOf(loan)[0];
  if (!row) throw new Error('Empréstimo já quitado');
  const charges = lateCharges(loan, row, paidOn);
  return { row, charges, total: row.payment + charges.total };
}

/**
 * Registra um pagamento com data e valor (imputação do Código Civil, art. 354: encargos e juros antes do capital).
 * Ordem: multa moratória → juros de mora → juros da parcela → principal da parcela → sobra.
 * - integral (valor dentro de 1 centavo do devido): igual a `payNext`;
 * - a mais: paga a parcela e a sobra amortiza o saldo (`surplus`: term | installment | nominal) ou vira troco;
 * - a menos: o restante fica numa linha residual da mesma parcela, com o vencimento original.
 * Devolve { loan, summary } com summary.kind = 'full' | 'surplus' | 'partial'.
 */
export function payInstallment(loan, { paidOn, amount, surplus = 'term' }) {
  if (!(paidOn instanceof Date) || Number.isNaN(+paidOn)) throw new Error('Informe a data do pagamento');
  if (!(amount > 0)) throw new Error('Informe o valor pago');
  if (!MODES.includes(surplus)) throw new RangeError('Forma de abater a sobra inválida');
  const { row, charges, total } = dueAt(loan, paidOn), number = loan.payments.length + 1;
  const comp = { fine: charges.fine, lateInterest: charges.interest, interest: row.interest, principal: row.principal };
  const base = { number, due: row.due, paidOn, amount, owed: total };

  if (Math.abs(amount - total) <= CENT + 1e-9) {
    return { loan: payNext(loan, paidOn), summary: { ...base, kind: 'full', amount: total, applied: comp, unpaid: null, surplus: null } };
  }

  if (amount > total) {
    const extra = amount - total, paid = payNext(loan, paidOn);
    let next = paid, applied = 0, change = extra, saved = 0;
    if (paid.remaining > 0) {
      if (surplus === 'nominal') { const r = nominalPrepay(paid, extra, paidOn); next = r.loan; applied = r.applied; change = r.change; }
      else {
        applied = Math.min(extra, paid.balance); change = extra - applied;
        next = amortize(paid, applied, surplus, paidOn, `Excedente do pagamento (${surplus === 'term' ? 'reduziu prazo' : 'reduziu parcela'})`);
        saved = next.events.at(-1).savedInterest;
      }
    }
    return { loan: next, summary: { ...base, kind: 'surplus', applied: comp, unpaid: null, surplus: { amount: extra, applied, change, mode: surplus, amortizable: paid.remaining > 0, savedInterest: saved } } };
  }

  let left = amount; const applied = {}, unpaid = {};
  for (const k of PARTS) { const a = Math.min(left, comp[k]); applied[k] = a; unpaid[k] = comp[k] - a; left -= a; }
  unpaid.total = PARTS.reduce((a, k) => a + unpaid[k], 0);
  const rows = scheduleOf(loan), prior = row.residual ? row.carried : null;
  const residual = {
    due: row.due, principal: unpaid.principal, interest: unpaid.interest, payment: unpaid.principal + unpaid.interest, balance: row.balance,
    residual: true, since: paidOn, carried: { fine: unpaid.fine, lateInterest: unpaid.lateInterest, fineCharged: charges.days > 0 || !!prior?.fineCharged },
  };
  const next = { ...loan, partials: [...(loan.partials ?? []), { number, due: row.due, paidOn, amount, applied, unpaid }], balance: Math.max(0, loan.balance - applied.principal), plan: [residual, ...rows.slice(1)] };
  return { loan: next, summary: { ...base, kind: 'partial', applied, unpaid, surplus: null } };
}
