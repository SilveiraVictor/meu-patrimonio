import { firstName } from '../shared/text.js';
import { cpfMask } from '../shared/masks.js';

/** ctx: { fmt, today, creditor:{name,pix}, debtor } */
const sign = (c) => (c.creditor?.name ? [c.creditor.name] : []);
const pix = (c) => (c.creditor?.pix ? ['', `Pix: ${c.creditor.pix}`] : []);
const ds = (loan) => (loan.description ? ` "${loan.description}"` : '');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const stateText = (i) => i.days < 0 ? `atrasada há ${plural(-i.days, 'dia')}` : i.days === 0 ? 'vence hoje' : `vence em ${plural(i.days, 'dia')}`;
const loanTitle = (l, f) => l.description || (l.system === 'single' ? `Pagamento único de ${f.date(l.nextDue)}` : 'Empréstimo');

const itemLine = (i, f) => `• ${i.label}: ${f.money(i.amount)}, vencimento ${f.date(i.due)} (${stateText(i)}${i.charges.total > 0 ? `; multa moratória ${f.money(i.charges.fine)} + juros de mora ${f.money(i.charges.interest)} = *${f.money(i.value)}*` : ''})`;

export const emptyMessage = { collection: 'Este empréstimo já está quitado. Não há cobrança pendente.', receipt: 'Nenhum pagamento registrado ainda.', status: 'Não há empréstimos em aberto para esta pessoa.' };

/** Um renderizador por tipo e escopo; novos tipos de comunicação não alteram os existentes. */
export const messageRenderers = {
  collection: (m, c) => {
    const f = c.fmt, name = firstName(c.debtor.name), end = ['', 'Qualquer dúvida é só falar. Obrigado!', ...sign(c)];
    if (m.sections) return [`Olá, ${name}! Tudo bem?`, '', 'Passando para lembrar dos pagamentos em aberto:',
      ...m.sections.flatMap((s) => ['', `*${loanTitle(s.loan, f)}*`, ...s.model.items.map((i) => itemLine(i, f))]), '', `*Total a pagar: ${f.money(m.total)}*`, ...pix(c), ...end].join('\n');
    const many = m.items.length > 1 || m.items[0].charges.total > 0;
    return [`Olá, ${name}! Tudo bem?`, '', `Passando para lembrar do pagamento do empréstimo${ds(c.loan)}:`, ...m.items.map((i) => itemLine(i, f)),
      ...(many ? ['', `*Total a pagar: ${f.money(m.total)}*`] : []), ...pix(c), ...end].join('\n');
  },
  receipt: (m, c) => {
    const f = c.fmt, { item, installments } = m, p = item.payment, inst = item.type === 'installment';
    const what = inst ? (c.loan.system === 'single' ? 'pagamento único' : `parcela ${p.number} de ${installments}`) : item.event.label.toLowerCase();
    return ['*Recibo de pagamento*', '', `Recebi de ${c.debtor.name} a quantia de ${f.money(item.amount)}, referente a ${what} do empréstimo${ds(c.loan)}.`, '',
      `Data do recebimento: ${f.date(item.date)}`,
      ...(inst ? [`Valor da parcela: ${f.money(p.payment)}`, ...(p.charges ? [`Multa moratória: ${f.money(p.charges.fine)}`, `Juros de mora (${p.charges.days} dias): ${f.money(p.charges.interest)}`] : []), `Saldo devedor após o pagamento: ${f.money(p.balance)}`] : []),
      '', 'Obrigado!', ...sign(c)].join('\n');
  },
  status: (m, c) => {
    const f = c.fmt, name = firstName(c.debtor.name), end = ['', 'Qualquer dúvida é só falar.', ...sign(c)];
    if (m.lines) return ['*Situação dos empréstimos*', '', `Olá, ${name}! Segue a situação dos seus empréstimos comigo:`,
      ...m.lines.map((x) => `• ${loanTitle(x.loan, f)}: falta ${f.money(x.toPay)}, próximo vencimento ${f.date(x.loan.nextDue)} (${f.money(x.nextPayment)})`),
      '', `*Total em aberto: ${f.money(m.open)}*`, ...(m.overdue > 0 ? [`Em atraso: ${f.money(m.overdue)}`] : []), ...pix(c), ...end].join('\n');
    return ['*Situação do empréstimo*', '', `Olá, ${name}! Segue a situação do empréstimo${ds(c.loan)}:`, `• Valor emprestado: ${f.money(m.lent)}`,
      ...(m.withInterest ? [`• Valor total (com juros): ${f.money(m.total)}`] : []), `• Já pago: ${f.money(m.paid)}`, `• Falta pagar: ${f.money(m.toPay)}`,
      ...(m.chargesDue > 0 ? [`• Encargos por atraso (multa e juros de mora): ${f.money(m.chargesDue)}`] : []),
      ...(m.settled ? ['• Situação: quitado'] : c.loan.system === 'single' ? [`• Vencimento: ${f.date(m.nextDue)}`] : [`• Parcelas pagas: ${m.paidCount} de ${m.installments}`, `• Próximo vencimento: ${f.date(m.nextDue)} (${f.money(m.nextPayment)})`]),
      ...(m.settled ? [] : pix(c)), ...end].join('\n');
  },
};

const base = (c) => [...(c.creditor?.name ? [['Credor', c.creditor.name]] : []), ['Devedor', c.debtor.name], ...(c.debtor.cpf ? [['CPF do devedor', cpfMask(c.debtor.cpf)]] : [])];
const stateLabel = { late: 'Atrasada', today: 'Vence hoje', upcoming: 'A vencer', paid: 'Paga' };

/** Modelo do documento (papel): o desenho em tela, imagem ou PDF fica na camada de apresentação. */
export const documentRenderers = {
  collection: (m, c) => { const f = c.fmt; return { title: 'Aviso de cobrança', sub: `Emitido em ${f.longDate(c.today)}`, hero: { label: 'Total a pagar', value: f.money(m.total) },
    note: c.loan.description ? `Empréstimo: ${c.loan.description}` : '',
    rows: [...base(c), ...(m.fine + m.lateInterest > 0 ? [['Multa moratória', f.money(m.fine)], ['Juros de mora', f.money(m.lateInterest)]] : []), ...(c.creditor?.pix ? [['Chave Pix para pagamento', c.creditor.pix]] : [])],
    table: { head: ['Parcela', 'Vencimento', 'Valor', 'Situação'], body: m.items.map((i) => [i.short, (f.shortDate ?? f.date)(i.due), f.money(i.amount), stateLabel[i.state]]) } }; },
  receipt: (m, c) => { const f = c.fmt, { item } = m, p = item.payment, inst = item.type === 'installment';
    return { title: 'Recibo de pagamento', sub: `Emitido em ${f.longDate(c.today)}`, sign: true, hero: { label: 'Valor recebido', value: f.money(item.amount) },
      note: messageRenderers.receipt(m, c).split('\n')[2],
      rows: [...base(c), ['Data do recebimento', f.longDate(item.date)],
        ...(inst ? [['Vencimento da parcela', f.longDate(p.due)], ['Amortização do principal', f.money(p.principal)], ['Juros', f.money(p.interest)],
          ...(p.charges ? [['Multa moratória', f.money(p.charges.fine)], [`Juros de mora (${p.charges.days} dias de atraso)`, f.money(p.charges.interest)]] : []), ['Saldo devedor após o pagamento', f.money(p.balance)]]
          : item.event.savedInterest > 0.005 ? [['Juros economizados', f.money(item.event.savedInterest)]] : [])] }; },
  status: (m, c) => { const f = c.fmt;
    return { title: 'Situação do empréstimo', sub: `Posição em ${f.longDate(c.today)}`, note: c.loan.description,
      hero: m.settled ? { label: 'Situação', value: 'Quitado' } : { label: 'Valor a pagar', value: f.money(m.toPayNow) },
      rows: [...base(c), ...(m.withInterest ? [['Valor emprestado', f.money(m.lent)]] : []), [m.withInterest ? 'Valor total (com juros)' : 'Valor total', f.money(m.total)], ['Valor pago', f.money(m.paid)],
        ...(m.chargesDue > 0 ? [['Encargos por atraso (multa e juros de mora)', f.money(m.chargesDue)]] : []),
        c.loan.system === 'single' ? ['Pagamento único', m.settled ? 'Recebido' : `Vence em ${f.date(m.nextDue)}`] : ['Parcelas pagas', `${m.paidCount} de ${m.installments}`],
        ...(m.settled ? [] : [['Próximo vencimento', `${f.date(m.nextDue)} · ${f.money(m.nextPayment)}`]])],
      table: { head: ['Parcela', 'Vencimento', 'Valor', 'Situação'], body: m.table.map((r) => [r.label, (f.shortDate ?? f.date)(r.due), f.money(r.amount), stateLabel[r.state]]) } }; },
};
