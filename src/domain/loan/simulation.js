import { addDays, addMonths } from '../shared/dates.js';
import { buildSchedule, totalInterest } from './amortization.js';

/**
 * Compara as seis formas de cobrar (parcelado sem juros, Price, SAC e pagamento único sem juros, simples e composto).
 * Entrada: { value, ratePct (% ao mês), installments, days (até a devolução do pagamento único) }.
 */
export function simulateOptions({ value, ratePct, installments, days }, today) {
  const i = ratePct / 100, first = addMonths(today, 1), due = addDays(today, days);
  const base = { principal: value, installments, firstDue: first }, one = { principal: value, issuedOn: today, firstDue: due };
  const defs = [
    ['none', 'Parcelado sem juros', `${installments} parcelas iguais, sem acréscimo.`, 'none', { ...base, monthlyRate: 0 }, { mode: 'installment', interest: false }],
    ['price', 'Parcelado na Tabela Price', `${installments} parcelas de valor igual, com juros.`, 'price', { ...base, monthlyRate: i }, { mode: 'installment', interest: true, system: 'price' }],
    ['sac', 'Parcelado no SAC', `${installments} parcelas que diminuem ao longo do tempo.`, 'sac', { ...base, monthlyRate: i }, { mode: 'installment', interest: true, system: 'sac' }],
    ['single0', 'Pagamento único sem juros', `Devolução de uma vez, em ${days} dias.`, 'single', { ...one, monthlyRate: 0, compounding: 'simple' }, { mode: 'single', interest: false }],
    ['simple', 'Pagamento único com juros simples', `Devolução em ${days} dias.`, 'single', { ...one, monthlyRate: i, compounding: 'simple' }, { mode: 'single', interest: true, compounding: 'simple' }],
    ['compound', 'Pagamento único com juros compostos', `Devolução em ${days} dias.`, 'single', { ...one, monthlyRate: i, compounding: 'compound' }, { mode: 'single', interest: true, compounding: 'compound' }],
  ];
  return defs.map(([id, title, description, system, params, preset]) => {
    const rows = buildSchedule(system, params), interest = totalInterest(rows);
    return { id, title, description, system, rows, interest, total: value + interest, preset: { ...preset, value, ratePct, installments, issuedOn: today, dueDate: due, firstDue: first } };
  });
}

/** E se a pessoa atrasar? Multa uma vez + juros de mora proporcionais (mês de 30 dias). */
export function simulateLate({ installment, finePct, latePct, days }) {
  const fine = (installment * finePct) / 100, interest = (installment * latePct) / 100 / 30 * days;
  return { fine, interest, total: installment + fine + interest };
}
