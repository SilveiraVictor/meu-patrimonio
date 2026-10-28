import { diffDaysFloor } from '../shared/dates.js';

const NONE = Object.freeze({ days: 0, fine: 0, interest: 0, total: 0 });

/** Multa (uma vez) + juros de mora proporcionais, mês de 30 dias. */
export function lateCharges({ fine = 0, lateRate = 0 }, installment, today) {
  const days = Math.max(0, diffDaysFloor(installment.due, today));
  if (!days || !(fine || lateRate)) return NONE;
  const f = (installment.payment * fine) / 100;
  const interest = (installment.payment * lateRate) / 100 / 30 * days;
  return { days, fine: f, interest, total: f + interest };
}
