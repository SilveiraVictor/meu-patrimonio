import { addDays, diffDays } from '../shared/dates.js';
import { annualRateBy, remainingPrincipal, startDate } from './yield.js';
import { calculateRedemption } from './redemption.js';

export class InvestmentError extends Error {}
export const CATEGORIES = ['CDB', 'LCI', 'LCA', 'LC', 'CRI', 'CRA', 'Tesouro Direto', 'Debênture'];
export const REDEMPTION_RULES = ['maturity', 'daily', 'penalty'];

/** Cria ou revalida um título. `termResolution` vem de resolveTerm(). */
export function buildInvestment(i, termResolution, { requireIssuer = true } = {}) {
  const fail = (m) => { throw new InvestmentError(m); };
  if (!String(i.name ?? '').trim()) fail('Informe o nome do título');
  if (!i.custodianId) fail('Informe a instituição custodiante');
  if (requireIssuer && !i.issuerId) fail('Informe a instituição emissora');
  if (!CATEGORIES.includes(i.category)) fail('Categoria inválida');
  if (!(i.indexer in annualRateBy)) fail('Indexador inválido');
  if (!Number.isFinite(i.rate) || i.rate < 0) fail('Informe a taxa');
  if (!(i.amount > 0)) fail('O valor aplicado deve ser maior que zero');
  if (!(i.maturity instanceof Date)) fail('Informe a data de vencimento');
  if (i.appliedOn && i.maturity <= i.appliedOn) fail('O vencimento precisa ser depois da aplicação');
  if (termResolution.status === 'conflict') fail('Escolha qual prazo usar: o calculado pelas datas ou o informado');
  const rule = i.redemptionRule ?? 'maturity';
  if (!REDEMPTION_RULES.includes(rule)) fail('Forma de resgate inválida');
  return {
    id: i.id, name: i.name.trim(), custodianId: i.custodianId, issuerId: i.issuerId ?? null, category: i.category, indexer: i.indexer, rate: i.rate,
    amount: i.amount, appliedOn: i.appliedOn ?? null, maturity: i.maturity, termDays: termResolution.term, termSource: termResolution.source,
    graceDays: Math.max(0, Math.round(i.graceDays || 0)), redemptionRule: rule, penaltyNote: rule === 'penalty' ? String(i.penaltyNote ?? '').trim() : '',
    redemptions: i.redemptions ?? [],
  };
}
export const reviseInvestment = (inv, changes, termResolution, opts) => buildInvestment({ ...inv, ...changes }, termResolution, { requireIssuer: false, ...opts });

export const isRedeemed = (inv) => remainingPrincipal(inv) < 0.005;
export const graceEnds = (inv) => (inv.appliedOn && inv.graceDays > 0 ? addDays(inv.appliedOn, inv.graceDays) : null);

/** 'redeemed' | 'matured' (venceu sem resgate) | 'today' | 'tomorrow' | 'upcoming' (attention até 30 dias). */
export function investmentStatus(inv, today) {
  if (isRedeemed(inv)) return { code: 'redeemed' };
  const days = diffDays(today, inv.maturity);
  if (days < 0) return { code: 'matured', days };
  return { code: days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'upcoming', days, attention: days <= 30 };
}
export function progress(inv, today) {
  const s = startDate(inv); if (!s || inv.maturity <= s) return null;
  return Math.min(100, Math.max(0, ((today - s) / (inv.maturity - s)) * 100));
}

const byDate = (a, b) => a.date - b.date;
function assertDate(inv, input) {
  if (!(input.date instanceof Date)) throw new InvestmentError('Informe a data.');
  const s = startDate(inv); if (s && input.date < s) throw new InvestmentError('A data não pode ser anterior à aplicação.');
}
export function recordRedemption(inv, input, indicators, id) {
  assertDate(inv, input);
  const calc = calculateRedemption(inv, input, indicators);
  if (!calc) throw new InvestmentError('Informe o valor bruto ou o líquido recebido para calcular o resgate');
  const record = { id, date: input.date, mode: input.mode, note: input.note ?? '', ...calc };
  return { investment: { ...inv, redemptions: [...inv.redemptions, record].sort(byDate) }, record };
}
/** Ao editar, o cálculo ignora o próprio registro. */
export function editRedemption(inv, id, input, indicators) {
  if (!inv.redemptions.some((r) => r.id === id)) throw new InvestmentError('Resgate não encontrado');
  return recordRedemption({ ...inv, redemptions: inv.redemptions.filter((r) => r.id !== id) }, input, indicators, id);
}
export const deleteRedemption = (inv, id) => ({ ...inv, redemptions: inv.redemptions.filter((r) => r.id !== id) });

/** Avisos que não bloqueiam o registro. */
export function redemptionWarnings(inv, date) {
  if (!date) return [];
  if (inv.redemptionRule === 'maturity' && date < inv.maturity) return [{ code: 'maturity-only', date: inv.maturity }];
  const g = graceEnds(inv); if (g && date < g) return [{ code: 'grace', until: g }];
  if (inv.redemptionRule === 'penalty' && date < inv.maturity) return [{ code: 'penalty' }];
  return [];
}

/** Rentabilidade consolidada dos resgates; "real" só se todos tiveram o líquido informado. */
export function summarizeRedemptions(inv) {
  const L = inv.redemptions; if (!L.length) return null;
  const net = L.reduce((a, r) => a + r.net, 0), principal = L.reduce((a, r) => a + r.principal, 0);
  const days = principal > 0 ? L.reduce((a, r) => a + (r.days ?? 0) * r.principal, 0) / principal : 0;
  return { count: L.length, net, principal, profit: net - principal, percent: principal > 0 ? (net / principal - 1) * 100 : 0,
    perYear: days > 0 && principal > 0 && net > 0 ? ((net / principal) ** (365 / days) - 1) * 100 : null,
    real: L.every((r) => r.real), lastDate: L.reduce((m, r) => (r.date > m ? r.date : m), L[0].date) };
}
