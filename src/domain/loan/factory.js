/** Cria um empréstimo válido. Toda regra de cadastro fica aqui, não na tela. */
export function createLoan(i) {
  const single = i.system === 'single', n = single ? 1 : i.installments;
  if (!i.personId) throw new Error('Informe quem recebeu o empréstimo');
  if (!(i.principal > 0)) throw new RangeError('O valor emprestado deve ser maior que zero');
  if (!Number.isInteger(n) || n < 1) throw new RangeError('Informe o número de parcelas');
  if (!(i.firstDue instanceof Date)) throw new Error('Informe a data de vencimento');
  if (single && !(i.firstDue > i.issuedOn)) throw new Error('O vencimento deve ser posterior à data do empréstimo');
  return {
    id: i.id, personId: i.personId, description: i.description ?? '', principal: i.principal,
    system: i.system, monthlyRate: i.system === 'none' ? 0 : i.monthlyRate ?? 0,
    balance: i.principal, remaining: n, nextDue: i.firstDue,
    issuedOn: single ? i.issuedOn : null, compounding: single ? i.compounding ?? 'simple' : null,
    fine: i.fine ?? 0, lateRate: i.lateRate ?? 0, payments: [], events: [], plan: null,
  };
}
