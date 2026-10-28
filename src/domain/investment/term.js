import { diffDays } from '../shared/dates.js';

const stamp = (d) => d?.getTime() ?? '';
/**
 * Prazo em dias a partir das datas e/ou do valor digitado.
 * status: 'ok' | 'missing' (pode salvar, sem rendimento) | 'conflict' (a pessoa precisa escolher).
 * `decision` = { key, choice: 'use-calculated' | 'keep-informed' } vale só para a mesma combinação de datas e prazo.
 */
export function resolveTerm({ appliedOn, maturity, informed, decision }) {
  const calc = appliedOn && maturity && maturity > appliedOn ? diffDays(appliedOn, maturity) : null;
  const inf = Number.isFinite(informed) && informed >= 1 ? Math.round(informed) : null;
  const key = [stamp(appliedOn), stamp(maturity), inf ?? ''].join('|');
  const ok = (term, source) => ({ status: 'ok', term, source, calculated: calc, informed: inf, key });
  if (inf == null) return calc != null ? ok(calc, 'calculated') : { status: 'missing', term: null, source: null, calculated: null, informed: null, key };
  if (calc == null) return ok(inf, 'informed');
  if (inf === calc) return ok(calc, 'calculated');
  if (decision?.key === key) return decision.choice === 'use-calculated' ? ok(calc, 'calculated') : ok(inf, 'informed');
  return { status: 'conflict', term: null, source: null, calculated: calc, informed: inf, key };
}
