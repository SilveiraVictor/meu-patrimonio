import { addMonths } from '../shared/dates.js';
import { buildSchedule } from './amortization.js';
import { totalInstallments } from './loan.js';

const SCHEDULE_KEYS = ['principal', 'installments', 'monthlyRate', 'system', 'firstDue', 'issuedOn', 'compounding'];
const same = (a, b) => a instanceof Date && b instanceof Date ? +a === +b
  : typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;

export const firstDueOf = (l) => l.system === 'single' ? (l.payments[0]?.due ?? l.nextDue) : addMonths(l.nextDue, -l.payments.length);
const currentTerms = (l) => ({ principal: l.principal, installments: totalInstallments(l), monthlyRate: l.monthlyRate, system: l.system, firstDue: firstDueOf(l), issuedOn: l.issuedOn, compounding: l.compounding });

/** Diz o que uma edição provoca, para a tela pedir confirmação antes de aplicar. */
export function revisionImpact(loan, changes) {
  const cur = currentTerms(loan), next = { ...cur };
  SCHEDULE_KEYS.forEach((k) => { if (changes[k] !== undefined) next[k] = changes[k]; });
  if (next.system === 'none') next.monthlyRate = 0;
  if (next.system === 'single') next.installments = 1;
  else { next.issuedOn = null; next.compounding = null; }
  const changed = SCHEDULE_KEYS.some((k) => !same(cur[k], next[k]));
  return { next, changed, discardsEvents: changed && loan.events.length > 0 };
}

/** Nome, descrição, multa e mora não afetam o cronograma; o resto recalcula o que falta pagar. */
export function reviseLoan(loan, changes) {
  const { next, changed } = revisionImpact(loan, changes);
  const meta = { ...loan, personId: changes.personId ?? loan.personId, description: changes.description ?? loan.description, fine: changes.fine ?? loan.fine, lateRate: changes.lateRate ?? loan.lateRate };
  if (!changed) return meta;
  const k = loan.payments.length, isSingle = next.system === 'single';
  if ((loan.system === 'single') !== isSingle && (k || loan.events.length)) throw new Error('Depois de registrar pagamentos não dá para trocar entre parcelado e pagamento único');
  if (!(next.principal > 0)) throw new RangeError('O valor emprestado deve ser maior que zero');
  if (!Number.isInteger(next.installments) || next.installments < 1) throw new RangeError('Informe o número de parcelas');
  if (!(next.firstDue instanceof Date) || Number.isNaN(+next.firstDue)) throw new Error('Informe a data de vencimento');
  if (next.installments < k) throw new RangeError(`Já foram pagas ${k} parcelas; o total não pode ser menor`);
  if (isSingle && !(next.firstDue > next.issuedOn)) throw new Error('O vencimento deve ser posterior à data do empréstimo');
  const rows = buildSchedule(next.system, next);
  const remaining = Math.max(0, next.installments - k);
  return { ...meta, principal: next.principal, system: next.system, monthlyRate: next.monthlyRate, issuedOn: next.issuedOn, compounding: isSingle ? next.compounding ?? 'simple' : null,
    balance: remaining ? (k ? rows[k - 1].balance : next.principal) : 0, remaining, nextDue: isSingle ? next.firstDue : addMonths(next.firstDue, k), events: [], plan: null };
}
