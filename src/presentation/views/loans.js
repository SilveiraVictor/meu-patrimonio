import { html } from '../html.js';
import { alert, backButton, bar, button, card, chip, empty, heading, ico, kv, act } from '../components.js';
import { brl, shortDate } from '../format.js';
import { dueChip, loanChip, personBadge, systemLabel } from '../presenters.js';
import { glossary } from '../glossary.js';
import { diffDays } from '../../domain/shared/dates.js';

const s = (n, one, many) => (n === 1 ? one : many);
const initial = (p, name) => (p?.name ?? name ?? '?')[0];

export function loanCard(it, personId) {
  const l = it.loan, [label, tone] = loanChip(it.status), paid = l.payments.length, pct = it.total ? (paid / it.total) * 100 : 0;
  return card(html`<div class="row">${ico(initial(it.person, it.name), 'or')}<div class="grow"><div class="t">${it.name}</div><div class="m">${systemLabel(l)}</div></div>${chip(label, tone)}</div>
    ${l.description ? html`<div class="m" style="margin-top:10px">${l.description}</div>` : ''}${bar(pct, { label: `${Math.round(pct)}% pago` })}
    <div class="row" style="justify-content:space-between;margin-top:8px"><span class="m">${l.system === 'single' ? (l.remaining ? `Devolução em ${shortDate(l.nextDue)}` : 'Devolvido') : `${paid} de ${it.total} parcelas pagas`}</span><span class="t">${l.remaining ? brl(it.due) : '—'}</span></div>`,
    personId ? { action: 'openLoanFrom', arg: l.id, arg2: personId } : { action: 'openLoan', arg: l.id });
}
const personCard = (g) => { const [label, tone] = personBadge(g.badge); return card(html`<div class="row">${ico(initial(g.person, g.name), 'or')}<div class="grow"><div class="t">${g.name}</div><div class="m">${g.loans.length} ${s(g.loans.length, 'empréstimo', 'empréstimos')}${g.person?.nickname ? ` · “${g.person.nickname}”` : ''}</div></div>${chip(label, tone)}</div>
  <div class="row" style="justify-content:space-between;margin-top:12px"><div><div class="lbl">Em aberto</div><div class="t">${brl(g.open)}</div></div><div style="text-align:right"><div class="lbl">${g.overdue > 0 ? 'Em atraso' : 'Próximo vencimento'}</div><div class="t">${g.overdue > 0 ? brl(g.overdue) : g.nextDue ? shortDate(g.nextDue) : '—'}</div></div></div>`, { action: 'openPerson', arg: g.personId }); };
const contact = (p) => (!p || !(p.phone || p.email || p.pix) ? '' : html`<div class="card kv"><div class="lbl" style="margin-bottom:4px">Contato${p.nickname ? ` · “${p.nickname}”` : ''}</div>${p.phone ? html`<div><span>Telefone</span><b>${p.phone}</b></div>` : ''}${p.email ? html`<div><span>E-mail</span><b>${p.email}</b></div>` : ''}${p.pix ? html`<div><span>Chave Pix</span><b>${p.pix}</b></div>` : ''}</div>`);

export const loansView = {
  load: (app) => app.loans.overview(),
  render(m, state) {
    const person = state.loansView === 'person';
    return html`<h1>Empréstimos</h1><p class="sub">Em aberto: <b>${brl(m.openPrincipal)}</b> com ${m.peopleWithOpen} ${s(m.peopleWithOpen, 'pessoa', 'pessoas')}</p>
      ${card(html`<div class="row">${ico('%')}<div class="grow"><div class="t">Simular empréstimo</div><div class="m">Compare parcelado, pagamento único e atraso antes de combinar.</div></div></div>`, { action: 'sim.open' })}
      ${card(html`<div class="row">${ico(m.peopleCount)}<div class="grow"><div class="t">Gerenciar pessoas</div><div class="m">Cadastro de quem recebe empréstimos: nome, apelido, contato e Pix.</div></div></div>`, { action: 'people.open' })}
      <div style="margin:4px 0 14px">${html`<div class="seg">${[['list', 'Lista'], ['person', 'Por pessoa']].map(([v, t]) => html`<button aria-pressed="${String(person ? v === 'person' : v === 'list')}"${act({ action: 'setLoansView', arg: v })}>${t}</button>`)}</div>`}</div>
      ${person ? m.groups.map(personCard) : m.items.map((i) => loanCard(i))}${m.count ? '' : empty('Nenhum empréstimo cadastrado', 'Adicionar empréstimo', 'loan.new')}`;
  },
};

export const loanDetailView = {
  load: (app, state) => app.loans.detail(state.loanId),
  render(m, state) {
    const l = m.loan, [label, tone] = loanChip(m.status), nx = m.next, en = m.charges ?? { total: 0 }, days = diffDays(m.today, l.nextDue), single = l.system === 'single';
    const back = state.loanFromPerson;
    return html`${backButton(back ? m.name : 'Empréstimos')}
      <div class="row" style="margin-bottom:14px">${ico(initial(m.person, m.name), 'or')}<div class="grow"><h1 style="font-size:calc(22px*var(--fs));margin:0">${m.person ? html`<button class="nm"${act({ action: 'openPerson', arg: m.person.id })}>${m.name}</button>` : m.name}</h1><div class="m">${systemLabel(l)} · emprestado ${brl(l.principal)}</div></div>${chip(label, tone)}</div>
      ${l.description ? html`<div class="card"><div class="lbl">Descrição</div><div style="margin-top:4px">${l.description}</div></div>` : ''}${contact(m.person)}
      ${card(html`<small>Saldo devedor</small><div class="big" style="font-size:calc(40px*var(--fs))">${brl(l.balance)}</div><small>${single ? (l.remaining ? `Pagamento único em ${shortDate(l.nextDue)}` : 'Pago') : `${l.payments.length} de ${m.total} parcelas pagas`}</small>`, { cls: 'hero' })}
      ${nx ? html`<div class="card"><div class="lbl">${single ? 'Pagamento único' : `Próxima parcela (${l.payments.length + 1}/${m.total})`}</div>
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;margin:4px 0 14px"><div class="num" style="margin:0">${brl(nx.payment + en.total)}</div>${chip(`${dueChip(days)[0]} · ${shortDate(l.nextDue)}`, days < 0 ? 'bad' : 'or')}</div>
        ${en.total > 0 ? html`<div class="pv" style="margin:0 0 12px"><div><span>Parcela</span><b>${brl(nx.payment)}</b></div><div><span>Multa moratória</span><b>${brl(en.fine)}</b></div><div><span>Juros de mora (${en.days} dias)</span><b>${brl(en.interest)}</b></div><div><span>Total hoje</span><b>${brl(nx.payment + en.total)}</b></div></div>${glossary('late')}` : ''}
        ${button('Registrar pagamento', { action: 'loan.pay', arg: l.id })}${single ? '' : html`<div style="height:10px"></div>${button('Antecipar ou amortizar', { variant: 'sec', action: 'prepay.open', arg: l.id })}`}</div>` : alert('✓ Empréstimo quitado', { tone: 'ok' })}
      ${button('Cobrança, recibo e situação', { variant: 'sec', style: 'margin-bottom:8px', action: 'send.open', arg: 'loan', arg2: l.id })}${button('Editar empréstimo', { variant: 'sec', action: 'loan.edit', arg: l.id })}
      ${heading('Cronograma')}<div class="card sc" style="padding:4px 8px"><table><tr><th>Parc.</th><th>Vencimento</th><th>Valor</th><th>Juros</th><th>Saldo</th></tr>
        ${l.payments.map((p) => html`<tr class="done"><td>✓ ${p.number}</td><td>${shortDate(p.due)}</td><td>${brl(p.payment)}</td><td>${brl(p.interest)}</td><td>${brl(p.balance)}</td></tr>`)}
        ${m.rows.map((r, k) => html`<tr class="${k ? '' : 'nx'}"><td>${l.payments.length + k + 1}</td><td>${shortDate(r.due)}</td><td>${brl(r.payment)}</td><td>${brl(r.interest)}</td><td>${brl(r.balance)}</td></tr>`)}</table></div>
      ${l.events.length ? html`${heading('Histórico')}${l.events.map((g) => html`<div class="card row"><div class="grow"><div class="t">${g.label}</div><div class="m">${shortDate(g.date)} · pago ${brl(g.amount)}</div></div>${g.savedInterest > 0 ? chip(`−${brl(g.savedInterest)} juros`, 'ok') : ''}</div>`)}` : ''}
      ${button('Excluir empréstimo', { variant: 'sec', style: 'margin-top:18px;color:var(--bad)', action: 'loan.askDelete', arg: l.id })}`;
  },
};

export const personDetailView = {
  load: (app, state) => app.loans.personDetail(state.personId),
  render(m) {
    const p = m.person, st = m.summary, first = p.name.split(' ')[0];
    return html`${backButton('Empréstimos')}
      <div class="row" style="margin-bottom:14px">${ico(p.name[0], 'or')}<div class="grow"><h1 style="font-size:calc(22px*var(--fs));margin:0">${m.name}</h1><div class="m">${[p.nickname && `“${p.nickname}”`, p.note].filter(Boolean).join(' · ') || 'Sem apelido ou observação'}</div></div></div>
      ${contact(p)}<div class="grid"><div class="card"><div class="lbl">Total emprestado</div><div class="num">${brl(st.lent)}</div></div><div class="card"><div class="lbl">Já recebido</div><div class="num">${brl(st.received)}</div></div>
        <div class="card"><div class="lbl">Em aberto</div><div class="num">${brl(st.open)}</div></div><div class="card"><div class="lbl">Em atraso</div><div class="num"${st.overdue > 0 ? html` style="color:var(--bad)"` : ''}>${brl(st.overdue)}</div></div></div>
      ${button('Enviar cobrança ou situação', { action: 'send.open', arg: 'person', arg2: p.id })}<div style="height:8px"></div>${button(`Novo empréstimo para ${first}`, { variant: 'sec', action: 'loan.newFor', arg: p.id })}
      ${heading('Empréstimos')}${m.items.map((i) => loanCard(i, p.id))}${button('Editar cadastro', { variant: 'sec', style: 'margin-top:6px', action: 'people.form', arg: p.id })}`;
  },
};
