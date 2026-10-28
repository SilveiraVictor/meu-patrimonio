import { html } from '../html.js';
import { button, field, footer, seg, sheetHeader } from '../components.js';
import { glossary } from '../glossary.js';
import { isoDate } from '../../domain/shared/dates.js';
import { brl, fullDate, num, pct } from '../format.js';
import { returnOf } from '../../domain/investment/redemption.js';
import { irRate, iofApplies, EXEMPT } from '../../domain/investment/tax.js';

const R = 'redemption.input', f = (o) => field({ input: R, ...o }), MONEY = { inputmode: 'decimal', min: 0, step: 'any' };
export const modeSeg = (mode) => seg([['total', 'Resgate total'], ['partial', 'Resgate parcial']], mode, 'redemption.mode');

export function redemptionFormView({ inv, rec, remaining, date, mode }) {
  return html`${sheetHeader(rec ? 'Editar resgate' : 'Registrar resgate ou vencimento')}
    <p class="m" style="margin:-6px 0 12px">${inv.name} · ainda aplicado: ${brl(remaining)}</p>
    <div class="f"><label>Tipo de resgate</label><div id="r-seg">${modeSeg(mode)}</div></div>
    ${f({ name: 'date', label: 'Data do resgate ou vencimento', type: 'date', value: isoDate(date), hint: 'No vencimento, use o dia em que o dinheiro foi creditado.' })}
    ${f({ name: 'gross', label: 'Valor bruto', type: 'number', value: rec && !rec.grossEstimated ? rec.gross : '', ...MONEY })}
    ${f({ name: 'net', label: 'Valor líquido recebido (R$, opcional)', type: 'number', value: rec?.real ? rec.net : '', hint: 'O valor que caiu na conta, já sem impostos. Com ele o app mostra a rentabilidade real.', ...MONEY })}
    <details class="why"><summary>Impostos retidos (opcional)</summary>
      ${f({ name: 'ir', label: 'IR retido (R$)', type: 'number', value: rec?.irInformed ? rec.ir : '', ...MONEY })}
      ${f({ name: 'iof', label: 'IOF retido (R$)', type: 'number', value: rec?.iofInformed ? rec.iof : '', hint: 'Se você não informar, o app estima os dois.', ...MONEY })}</details>${glossary('taxes')}
    ${f({ name: 'note', label: 'Observação (opcional)', value: rec?.note, maxlength: 60 })}
    <div id="r-w"></div><div class="pv" id="rpv"></div>
    ${rec ? button('Excluir este resgate', { variant: 'sec', style: 'color:var(--bad)', action: 'redemption.askDelete' }) : ''}
    ${footer(button(rec ? 'Salvar alterações' : 'Registrar', { id: 'r-s', action: 'redemption.save', disabled: true }))}`;
}

const n = (v) => (v === '' ? null : Number(v));
export const readRedemption = (d, mode) => ({ date: d.date ? new Date(`${d.date}T00:00`) : null, mode, gross: n(d.gross), net: n(d.net), ir: n(d.ir), iof: n(d.iof), note: d.note?.trim() ?? '' });

const WARNINGS = {
  'maturity-only': (w) => `Este título só permite resgate no vencimento (${fullDate(w.date)}). Confirme a data no extrato.`,
  grace: (w) => `A data está dentro da carência (até ${fullDate(w.until)}). Confirme no extrato.`,
  penalty: () => 'Resgate antecipado pode ter penalidade. Informe o valor líquido do extrato para ver o resultado real.',
};
export const warningText = (w) => WARNINGS[w.code](w);

export function redemptionPreview(p, inv) {
  if (!p.record) return html`${p.message}`;
  const c = p.record, ret = returnOf(c), irNote = c.irInformed ? '(informado)' : EXEMPT.has(inv.category) ? '(isento)' : c.days != null ? `(${num(irRate(inv.category, c.days) * 100)}%, estimado)` : '';
  const row = (a, b) => html`<div><span>${a}</span><b>${b}</b></div>`;
  return html`${row(`Valor bruto${c.grossEstimated ? ' (estimado)' : ''}`, brl(c.gross))}
    ${c.real && !c.irInformed && !c.iofInformed ? row('Impostos e descontos', `−${brl(c.gross - c.net)}`) : html`${row(`IOF ${c.iofInformed ? '(informado)' : iofApplies(inv.category) && c.days != null ? '(estimado)' : '(não se aplica)'}`, `−${brl(c.iof)}`)}${row(`IR ${irNote}`, `−${brl(c.ir)}`)}`}
    ${row(`Líquido ${c.real ? 'recebido' : 'estimado'}`, brl(c.net))}${row('Rendimento líquido', `${brl(c.net - c.principal)} (${pct(ret.percent)})`)}
    ${ret.perYear != null ? row('Equivale a', `${pct(ret.perYear)} ao ano`) : ''}${row('Tipo de valor', c.real ? 'Valor real' : 'Estimativa')}`;
}
