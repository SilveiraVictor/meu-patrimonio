import { diffDaysFloor } from '../shared/dates.js';

const NONE = Object.freeze({ days: 0, fine: 0, interest: 0, total: 0 });

/**
 * Multa (uma vez) + juros de mora proporcionais, mês de 30 dias.
 * Linha residual (sobra de um pagamento parcial): `payment` é o que ficou em aberto de juros e principal da parcela;
 * `carried` traz a multa e a mora que já estavam vencidas e não foram pagas. A multa nunca é cobrada duas vezes
 * (`fineCharged`) e a mora nova só conta a partir do maior entre o pagamento parcial (`since`) e o vencimento.
 */
export function lateCharges({ fine = 0, lateRate = 0 }, installment, today) {
  const days = Math.max(0, diffDaysFloor(installment.due, today));
  if (!installment.residual) {
    if (!days || !(fine || lateRate)) return NONE;
    const f = (installment.payment * fine) / 100;
    const interest = (installment.payment * lateRate) / 100 / 30 * days;
    return { days, fine: f, interest, total: f + interest };
  }
  const c = installment.carried ?? {}, from = installment.since > installment.due ? installment.since : installment.due;
  const f = c.fineCharged ? c.fine ?? 0 : days ? (installment.payment * fine) / 100 : 0;
  const interest = (c.lateInterest ?? 0) + (installment.payment * lateRate) / 100 / 30 * Math.max(0, diffDaysFloor(from, today));
  return f + interest > 0 ? { days, fine: f, interest, total: f + interest } : NONE;
}
