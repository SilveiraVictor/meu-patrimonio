import { html } from '../html.js';
import { alert, button, card, chip, empty, heading, ico, act } from '../components.js';
import { brl, shortDate } from '../format.js';
import { dueChip, investmentChip } from '../presenters.js';

const plural = (n, one, many) => (n === 1 ? one : many);
/** 'prompt' (Chrome/Edge), 'ios' (instrução) ou null (já instalado ou sem suporte). */
export const installState = (rt) => (!rt || rt.installed() ? null : rt.prompt ? 'prompt' : rt.ios ? 'ios' : null);

function hero(h) {
  if (!h) return empty('Nenhum título cadastrado', 'Adicionar título', 'investment.new');
  const [, tone] = investmentChip(h.status), n = Math.abs(h.days);
  return card(html`<small>${h.days < 0 ? 'Título vencido sem resgate registrado' : 'Próximo vencimento de título'}</small>
    <div class="big">${n}<span style="font-size:calc(24px*var(--fs));font-weight:700"> ${plural(n, 'dia', 'dias')}${h.days < 0 ? ' atrás' : ''}</span></div>
    <div class="row" style="justify-content:space-between;margin-top:10px"><div><b>${h.name}</b><br><small>${shortDate(h.maturity)} · ${brl(h.amount)}</small></div>${tone === 'or' ? html`<span class="chip">Atenção</span>` : ''}</div>`, { cls: 'hero' });
}

function upcomingItem(e) {
  const [label, tone] = e.kind === 'investment' ? investmentChip(e.status) : dueChip(e.days);
  const detail = e.kind === 'investment' ? `${e.overdue ? 'Venceu, registre o resgate' : 'Vencimento do título'} · ${brl(e.amount)}` : `${e.single ? 'Pagamento único' : `${e.number}/${e.total}`} · ${brl(e.amount)}`;
  return card(html`<div class="row">${ico(e.initial, e.kind === 'loan' ? 'or' : '')}<div class="grow"><div class="t">${e.title}</div><div class="m">${detail}</div></div>
    <div style="text-align:right">${chip(label, tone)}<div class="m">${shortDate(e.date)}</div></div></div>`, { cls: 'row', action: e.kind === 'investment' ? 'openInvestment' : 'openLoan', arg: e.id });
}

/** Tela inicial: view pura (modelo → HTML), testável sem navegador. */
export const homeView = {
  async load(app) { return { ...(await app.home.overview()), install: installState(app.runtime) }; },
  render(m) {
    const late = m.overdueLoans;
    return html`<h1>Meu Patrimônio</h1><p class="sub">O que vence e o que você tem a receber.</p>
      ${m.install === 'prompt' ? alert(html`<span>Instale o app para abrir em tela cheia e usar sem internet.</span>${button('Instalar o app', { style: 'min-height:44px;font-size:calc(14px*var(--fs))', action: 'app.install' })}`, { tone: 'info', col: true }) : ''}
      ${m.install === 'ios' ? alert('Para instalar no iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.', { tone: 'info' }) : ''}
      ${m.hasDemo ? alert(html`<span>Você está vendo dados de exemplo.</span>${button('Apagar exemplos e começar', { style: 'min-height:44px;font-size:calc(14px*var(--fs))', action: 'clearDemo.confirm' })}`, { tone: 'info', col: true }) : ''}
      ${late.length ? alert(`${late.length} ${plural(late.length, 'parcela atrasada', 'parcelas atrasadas')}: ${late.map((l) => l.person).join(', ')}`) : ''}
      ${hero(m.highlight)}
      <div class="grid"><div class="card"><div class="lbl">A receber este mês</div><div class="num">${brl(m.receivable)}</div></div><div class="card"><div class="lbl">Emprestado em aberto</div><div class="num">${brl(m.openPrincipal)}</div></div></div>
      ${heading('Próximos vencimentos')}${m.upcoming.length ? '' : html`<p class="m">Nada por aqui ainda. Use o botão laranja para adicionar.</p>`}
      ${m.upcoming.map(upcomingItem)}`;
  },
};
