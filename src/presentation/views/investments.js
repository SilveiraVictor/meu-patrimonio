import { html, raw } from '../html.js';
import { alert, backButton, bar, button, card, chip, empty, heading, ico, kv, act } from '../components.js';
import { brl, fullDate, num, pct, shortDate } from '../format.js';
import { INDEXERS, REDEMPTION_RULES, investmentChip, rateLabel, redemptionLabel } from '../presenters.js';
import { remainingPrincipal } from '../../domain/investment/yield.js';
import { graceEnds } from '../../domain/investment/investment.js';
import { returnOf } from '../../domain/investment/redemption.js';

const irLabel = (p) => (p.taxRate ? `IR ${num(p.taxRate * 100)}%` : 'Isento de IR');
const typeChip = (i) => (i.indexer === 'fixed' ? chip('Valor real', 'ok') : chip('Estimativa'));
const where = (x) => html`${x.issuer ? html`Emissor: ${x.issuer}<br>` : ''}Custódia: ${x.custodian}`;

function listItem(x) {
  const i = x.investment, p = x.projection, [label, tone] = investmentChip(x.status), pv = 'margin:12px 0 0';
  return card(html`<div class="row">${ico(i.category[0])}<div class="grow"><div class="t">${i.name}</div><div class="m">${i.category} · ${rateLabel(i)}</div><div class="m">${where(x)}</div><div class="m">${redemptionLabel(i)}</div>${i.redemptions.length ? html`<div class="m">Resgate parcial já registrado</div>` : ''}</div>${chip(label, tone)}</div>
    <div class="row" style="justify-content:space-between;margin-top:14px"><div><div class="lbl">${i.redemptions.length ? 'Ainda aplicado' : 'Aplicado'}</div><div class="t">${brl(remainingPrincipal(i))}</div></div><div style="text-align:right"><div class="lbl">Vence em ${shortDate(i.maturity)}</div><div class="t">${p ? `${p.days} dias de prazo` : 'Prazo não informado'}</div></div></div>
    ${p ? html`<div class="pv" style="${pv}"><div><span>Líquido no vencimento</span><b>${brl(p.finalNet)}</b></div><div><span>${irLabel(p)}</span>${typeChip(i)}</div></div>` : html`<div class="pv" style="${pv}"><div><span>Rendimento</span>${chip('Informe o prazo', 'or')}</div></div>`}
    ${x.progress != null ? bar(x.progress, { attention: tone === 'or' }) : ''}`, { action: 'openInvestment', arg: i.id });
}

const redeemedItem = (x) => { const i = x.investment, s = x.summary; return card(html`<div class="row">${ico(i.category[0])}<div class="grow"><div class="t">${i.name}</div><div class="m">Resgatado em ${fullDate(s.lastDate)} · ${i.category}</div></div>${chip('Resgatado', 'ok')}</div>
  <div class="row" style="justify-content:space-between;margin-top:12px"><div><div class="lbl">Líquido recebido</div><div class="t">${brl(s.net)}</div></div><div style="text-align:right"><div class="lbl">Rentabilidade ${s.real ? 'real' : 'estimada'}</div><div class="t">${pct(s.percent)}</div></div></div>`, { action: 'openInvestment', arg: i.id }); };

export const investmentsView = {
  load: (app) => app.investments.overview(),
  render(m) {
    const t = m.totals, ind = m.indicators;
    return html`<h1>Investimentos</h1><p class="sub">Aplicado: <b>${brl(t.applied)}</b> · Líquido no vencimento: <b>${brl(t.netAtMaturity)}</b>${t.missingTerm ? html` ${chip(`${t.missingTerm} sem prazo`, 'or')}` : ''}</p>
      ${card(html`<div class="row" style="justify-content:space-between"><b>Indicadores de referência</b><button class="chip" style="border:0;min-height:44px;padding:0 16px"${act({ action: 'indicators.edit' })}>Editar</button></div>
        <div class="three"><div><div class="lbl">CDI</div><div class="t">${pct(ind.cdi)}</div></div><div><div class="lbl">Selic</div><div class="t">${pct(ind.selic)}</div></div><div><div class="lbl">IPCA 12m</div><div class="t">${pct(ind.ipca)}</div></div></div>
        <div class="m" style="margin-top:10px">As estimativas supõem que o indicador se mantém até o vencimento.</div>`)}
      ${m.active.map(listItem)}${m.count ? '' : empty('Nenhum título cadastrado', 'Adicionar título', 'investment.new')}
      ${m.redeemed.length ? html`${heading('Resgatados')}${m.redeemed.map(redeemedItem)}` : ''}
      ${heading('Instituições financeiras')}${card(html`<div class="row">${ico(m.institutionCount)}<div class="grow"><div class="t">Gerenciar instituições</div><div class="m">Bancos e corretoras usados como custodiante e emissor.</div></div></div>`, { action: 'institutions.open' })}`;
  },
};

const resCard = (i, r) => card(html`<div class="row" style="justify-content:space-between"><div><div class="t">${r.date >= i.maturity ? 'Vencimento' : r.mode === 'total' ? 'Resgate total' : 'Resgate parcial'}</div><div class="m">${fullDate(r.date)}${r.note ? ` · ${r.note}` : ''}</div></div>${chip(r.real ? 'Valor real' : 'Estimativa', r.real ? 'ok' : '')}</div>
  <div class="pv" style="margin:12px 0 0"><div><span>Valor bruto</span><b>${brl(r.gross)}</b></div><div><span>Impostos e descontos</span><b>−${brl(r.gross - r.net)}</b></div><div><span>Líquido recebido</span><b>${brl(r.net)}</b></div><div><span>Rendimento líquido</span><b>${brl(r.net - r.principal)} (${pct(returnOf(r).percent)})</b></div></div>`, { action: 'redemption.edit', arg: i.id, arg2: r.id });

export const investmentDetailView = {
  load: (app, state) => app.investments.view(state.investmentId),
  render(m) {
    const i = m.investment, p = m.projection, s = m.summary, out = m.status.code === 'redeemed', [label, tone] = investmentChip(m.status), fixed = i.indexer === 'fixed', ind = m.indicators;
    const big = 'font-size:calc(40px*var(--fs))';
    const hero = out && s ? card(html`<small>Rentabilidade ${s.real ? 'real' : 'estimada'} no período</small><div class="big" style="${big}">${pct(s.percent)}</div><div class="row" style="justify-content:space-between"><small>Recebido ${brl(s.net)} · lucro ${brl(s.profit)}</small>${chip(s.real ? 'Valor real' : 'Estimativa')}</div>${s.perYear != null ? html`<small>Equivale a ${pct(s.perYear)} ao ano</small>` : ''}`, { cls: 'hero' })
      : p ? card(html`<small>Valor líquido no vencimento</small><div class="big" style="${big}">${brl(p.finalNet)}</div><div class="row" style="justify-content:space-between"><small>Rendimento líquido: ${brl(p.net)}</small>${chip(fixed ? 'Valor real' : 'Estimativa')}</div>`, { cls: 'hero' })
      : html`${card(html`<small>Valor aplicado</small><div class="big" style="${big}">${brl(i.amount)}</div><small>Rendimento não calculado</small>`, { cls: 'hero' })}${alert('Sem o prazo em dias não é possível calcular o rendimento. Toque em Editar título e informe o prazo.')}`;
    const resBlock = html`${!out && m.status.code === 'matured' ? alert(html`<span>Este título venceu em ${shortDate(i.maturity)}. Registre o resgate para ver a rentabilidade real.</span>${button('Registrar resgate', { action: 'redemption.new', arg: i.id })}`, { col: true })
      : !out ? html`<div style="margin-bottom:12px">${button('Registrar resgate ou vencimento', { action: 'redemption.new', arg: i.id })}</div>` : ''}
      ${s ? html`${heading('Resgates registrados')}${kv([['Total recebido (líquido)', brl(s.net)], ['Rendimento líquido', brl(s.profit)], ['Rentabilidade no período', pct(s.percent)], ...(s.perYear != null ? [['Equivale a', `${pct(s.perYear)} ao ano`]] : [])])}${[...i.redemptions].sort((a, b) => b.date - a.date).map((r) => resCard(i, r))}` : ''}`;
    const grace = graceEnds(i);
    const data = [...(i.issuerId ? [['Instituição emissora', m.issuer]] : []), ['Instituição custodiante', m.custodian], ['Categoria', i.category], ['Indexador', INDEXERS[i.indexer]], ['Taxa', rateLabel(i)], ['Valor aplicado', brl(i.amount)],
      ...(i.redemptions.length && !out ? [['Ainda aplicado', brl(remainingPrincipal(i))]] : []), ['Data da aplicação', i.appliedOn ? shortDate(i.appliedOn) : 'Não informada'], ['Vencimento', shortDate(i.maturity)], ['Prazo', i.termDays ? `${i.termDays} dias` : 'Não informado'],
      ...(i.graceDays > 0 ? [['Carência', `${i.graceDays} dias${grace ? ` (até ${shortDate(grace)})` : ''}`]] : []), ['Resgate', REDEMPTION_RULES[i.redemptionRule]], ...(i.redemptionRule === 'penalty' && i.penaltyNote ? [['Penalidade', i.penaltyNote]] : [])];
    const est = !out && p ? html`${heading(fixed ? 'Valor no vencimento' : 'Estimativa de rendimento')}${kv([['Taxa anual considerada', `${num(p.rate * 100)}% a.a.`], ['Rendimento bruto', brl(p.gross)], [p.taxRate ? `Imposto de renda (${num(p.taxRate * 100)}%)` : 'Imposto de renda', `−${brl(p.tax)}`], ['Rendimento líquido', brl(p.net)], ['Valor bruto no vencimento', brl(p.finalGross)], ...(fixed ? [['Em valores de hoje (descontando IPCA)', brl(p.finalNet / (1 + ind.ipca / 100) ** (p.days / 365))]] : [])])}
      <p class="m">${fixed ? 'Prefixado: o valor foi definido na contratação e não depende de indicadores.' : `Pós-fixado: estimativa com o ${{ cdi: 'CDI', ipca: 'IPCA', selic: 'Selic' }[i.indexer]} de referência mantido até o vencimento. O valor final pode variar.`} ${p.taxRate ? 'IR regressivo: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima disso.' : 'LCI, LCA, CRI e CRA são isentos de IR para pessoa física.'} IOF e taxas de custódia não estão incluídos.</p>` : '';
    return html`${backButton('Investimentos')}
      <div class="row" style="margin-bottom:14px">${ico(i.category[0])}<div class="grow"><h1 style="font-size:calc(22px*var(--fs));margin:0">${i.name}</h1><div class="m">${i.category} · ${rateLabel(i)}</div></div>${chip(label, tone)}</div>
      ${hero}${resBlock}${heading('Dados da aplicação')}${kv(data)}${est}
      ${button('Editar título', { variant: 'sec', style: 'margin-top:8px', action: 'investment.edit', arg: i.id })}<div style="height:8px"></div>${button('Excluir título', { variant: 'sec', style: 'color:var(--bad)', action: 'investment.askDelete', arg: i.id })}`;
  },
};
