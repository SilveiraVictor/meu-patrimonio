import { DAY_MS } from '../shared/dates.js';
import { annualRate, remainingPrincipal, startDate } from './yield.js';
import { iofApplies, iofRate, irRate } from './tax.js';

/** Posição bruta estimada do que ainda está aplicado, na data informada (null sem data de início). */
export function estimatedPosition(inv, date, ind) {
  const start = startDate(inv);
  return start ? remainingPrincipal(inv) * (1 + annualRate(inv, ind)) ** (Math.max(0, (date - start) / DAY_MS) / 365) : null;
}

/**
 * input: { date, mode: 'total'|'partial', gross?, net?, ir?, iof? } (null = não informado).
 * Valores informados do extrato prevalecem sobre estimativas.
 */
export function calculateRedemption(inv, input, ind) {
  const remaining = remainingPrincipal(inv), start = startDate(inv), held = estimatedPosition(inv, input.date, ind);
  const days = start ? Math.max(0, Math.round((input.date - start) / DAY_MS)) : null;

  let gross = input.gross ?? null, grossEstimated = false;
  if (gross == null && input.mode === 'total' && held != null) { gross = held; grossEstimated = true; }
  if (gross == null && input.net != null) gross = input.net + (input.ir ?? 0) + (input.iof ?? 0);
  if (!(gross > 0)) return null;

  const principal = input.mode === 'total' ? remaining : remaining * Math.min(1, gross / (held > 0 ? held : remaining));
  const earnings = gross - principal;
  const iof = input.iof ?? (days != null && iofApplies(inv.category) && earnings > 0 ? earnings * iofRate(days) : 0);
  const ir = input.ir ?? (days != null && earnings > 0 ? Math.max(0, earnings - iof) * irRate(inv.category, days) : 0);
  const real = input.net != null;
  const net = real ? input.net : gross - iof - ir;
  return { principal, gross, earnings, iof, ir, net, days, real, grossEstimated, iofInformed: input.iof != null, irInformed: input.ir != null };
}

/** Rentabilidade de um resgate. */
export const returnOf = (r) => ({
  percent: r.principal > 0 ? (r.net / r.principal - 1) * 100 : 0,
  perYear: r.days > 0 && r.principal > 0 && r.net > 0 ? ((r.net / r.principal) ** (365 / r.days) - 1) * 100 : null,
});
