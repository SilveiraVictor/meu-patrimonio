import { buildSchedule, totalInterest } from './amortization.js';
import { scheduleOf } from './loan.js';
import { diffDays } from '../shared/dates.js';

function guard(loan) {
  if (loan.system === 'single') throw new Error('Pagamento único não permite antecipar nem amortizar');
  if (loan.remaining <= 0) throw new Error('Empréstimo já quitado');
  if (scheduleOf(loan)[0]?.residual) throw new Error('Registre o restante da parcela em aberto antes de antecipar ou amortizar');
}
const rebuild = (loan, balance, remaining) =>
  buildSchedule(loan.system, { principal: balance, installments: remaining, monthlyRate: loan.monthlyRate, firstDue: loan.nextDue });
const outcome = (before, after, amount, remaining) =>
  ({ amount, remaining, payment: after[0]?.payment ?? 0, savedInterest: totalInterest(before) - totalInterest(after), after });

const presentValue = (amount, rate, due, today) => amount / (1 + rate) ** (Math.max(0, diffDays(today, due)) / 30);

/**
 * Antecipação pela matemática financeira: cada parcela paga adiantada vale o seu valor presente,
 * descontado à taxa do contrato (juros compostos, mês de 30 dias). Os juros economizados são
 * (soma nominal − valor presente). As parcelas restantes permanecem inalteradas (mesmo valor e datas).
 */
export function previewAnticipation(loan, count, today) {
  guard(loan);
  if (!Number.isInteger(count) || count < 1 || count > loan.remaining) throw new RangeError('Quantidade de parcelas inválida');
  const rows = scheduleOf(loan), keep = rows.length - count, gone = rows.slice(keep);
  const amount = gone.reduce((a, r) => a + presentValue(r.payment, loan.monthlyRate, r.due, today), 0);
  const nominal = gone.reduce((a, r) => a + r.payment, 0), tail = gone.reduce((a, r) => a + r.principal, 0);
  const after = rows.slice(0, keep).map((r, k) => ({ ...r, balance: k === keep - 1 ? 0 : Math.max(0, r.balance - tail) }));
  return { amount, nominal, savedInterest: nominal - amount, remaining: keep, payment: after[0]?.payment ?? 0, after, tail };
}

export function anticipate(loan, count, today) {
  const p = previewAnticipation(loan, count, today);
  const events = [...loan.events, { label: `Antecipou ${count} parcela${count > 1 ? 's' : ''}`, date: today, amount: p.amount, nominal: p.nominal, savedInterest: p.savedInterest }];
  return p.remaining === 0 ? { ...loan, balance: 0, remaining: 0, plan: null, events }
    : { ...loan, balance: loan.balance - p.tail, remaining: p.remaining, plan: p.after, events };
}

/** Abate `amount` do saldo: mode 'term' reduz o prazo; 'installment' reduz a parcela. */
export function previewAmortization(loan, amount, mode) {
  guard(loan);
  if (!(amount > 0) || amount > loan.balance + 0.005) throw new RangeError('Valor de amortização inválido');
  const before = scheduleOf(loan), B = loan.balance - amount, first = before[0], i = loan.monthlyRate;
  if (B <= 0.005) return outcome(before, [], amount, 0);
  const exact = loan.system === 'sac' ? B / first.principal
    : i > 0 ? -Math.log(1 - (B * i) / first.payment) / Math.log(1 + i) : B / first.payment;
  const left = mode === 'term' ? Math.max(1, Math.ceil(exact - 1e-6)) : loan.remaining;
  return outcome(before, rebuild(loan, B, left), amount, left);
}

function apply(loan, p, label, today) {
  const events = [...loan.events, { label, date: today, amount: p.amount, savedInterest: p.savedInterest }];
  return p.remaining === 0 ? { ...loan, balance: 0, remaining: 0, plan: null, events }
    : { ...loan, balance: loan.balance - p.amount, remaining: p.remaining, plan: null, events };
}
export const amortize = (loan, amount, mode, today, label) =>
  apply(loan, previewAmortization(loan, amount, mode), label ?? `Amortizou (${mode === 'term' ? 'reduziu prazo' : 'reduziu parcela'})`, today);

/**
 * Abate `amount` das últimas parcelas pelo valor cheio, sem desconto de juros (quando as partes combinam assim):
 * remove parcelas inteiras do fim e reduz a última restante em principal e juros, na mesma proporção.
 * Juros economizados = 0. O que passar da soma das parcelas é troco. Σ parcelas antes − Σ depois = valor abatido.
 */
export function nominalPrepay(loan, amount, today, label = 'Abateu parcelas (sem desconto de juros)') {
  guard(loan);
  if (!(amount > 0)) throw new RangeError('Valor de abatimento inválido');
  const rows = scheduleOf(loan), kept = rows.map((r) => ({ ...r })), total = rows.reduce((a, r) => a + r.payment, 0);
  const applied = Math.min(amount, total); let left = applied;
  while (left > 0.005 && kept.length) {
    const last = kept.at(-1);
    if (last.payment <= left + 0.005) { left -= last.payment; kept.pop(); }
    else { const f = (last.payment - left) / last.payment; last.principal *= f; last.interest *= f; last.payment *= f; left = 0; }
  }
  const tail = rows.reduce((a, r) => a + r.principal, 0) - kept.reduce((a, r) => a + r.principal, 0);
  const plan = kept.map((r, k) => ({ ...r, balance: k === kept.length - 1 ? 0 : Math.max(0, r.balance - tail) }));
  const events = [...loan.events, { label, date: today, amount: applied, nominal: applied, savedInterest: 0 }];
  const next = plan.length ? { ...loan, balance: Math.max(0, loan.balance - tail), remaining: plan.length, plan, events } : { ...loan, balance: 0, remaining: 0, plan: null, events };
  return { loan: next, applied, change: Math.max(0, amount - applied) };
}
