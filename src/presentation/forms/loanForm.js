import { html, raw } from '../html.js';
import { alert, button, field, footer, sheetHeader, act } from '../components.js';
import { comboField } from '../combo.js';
import { glossary } from '../glossary.js';
import { isoDate, diffDays } from '../../domain/shared/dates.js';
import { brl } from '../format.js';

const f = (o) => field({ input: 'loan.input', ...o });
const iso = (d) => (d instanceof Date ? isoDate(d) : d ?? '');
export const segmentButtons = (options, active, action) => options.map(([v, t]) => html`<button type="button" aria-pressed="${String(v === active)}"${act({ action, arg: v })}>${t}</button>`);
const segment = (id, options, active, action) => html`<div class="seg" id="${id}" style="margin-bottom:12px">${segmentButtons(options, active, action)}</div>`;
const sw = (id, label, checked, arg) => html`<div class="sw"><span id="l-${id}">${label}</span><button type="button" role="switch" id="sw-${id}" aria-checked="${String(checked)}" aria-labelledby="l-${id}"${act({ action: 'loan.toggle', arg })}><i></i></button></div>`;
export const MODES = [['installment', 'Parcelado'], ['single', 'Pagamento único']], SYSTEMS_OPT = [['price', 'Tabela Price'], ['sac', 'SAC']], CAPS = [['simple', 'Juros simples'], ['compound', 'Juros compostos']];
const hid = (c) => (c ? raw(' hidden') : '');

export function loanFormView({ v, L, paymentsCount = 0 }) {
  const single = L.mode === 'single', editing = !!L.id, M = { inputmode: 'decimal', min: 0, step: 'any' };
  return html`${sheetHeader(editing ? 'Editar empréstimo' : 'Novo empréstimo')}
    ${editing && paymentsCount ? alert(`Já há ${paymentsCount} pagamento${paymentsCount === 1 ? '' : 's'} registrado${paymentsCount === 1 ? '' : 's'}. Mudar valor, prazo, juros, sistema ou datas recalcula o que falta pagar. Os pagamentos registrados continuam no histórico.`) : ''}
    ${comboField({ name: 'person', kind: 'person', label: 'Quem recebeu', placeholder: 'Selecione ou digite o nome ou apelido', hint: 'Pesquise pelo nome ou apelido.', value: v.person, selectedId: v.personId })}
    ${f({ name: 'description', label: 'Descrição (opcional)', value: v.description, maxlength: 140, placeholder: 'Ex.: Caixa de som comprada no meu cartão', hint: 'Anote o motivo ou o que foi comprado.' })}
    ${f({ name: 'principal', label: 'Valor emprestado (R$)', type: 'number', value: v.principal, ...M })}
    <div class="f"><label>Forma de pagamento</label>${segment('seg-mode', MODES, L.mode, 'loan.mode')}</div>${glossary('single')}
    <div id="b-parc"${hid(single)}>${f({ name: 'installments', label: 'Número de parcelas', type: 'number', value: v.installments, inputmode: 'numeric', min: 1, max: 120 })}</div>
    <div id="b-uni"${hid(!single)}>${f({ name: 'issuedOn', label: 'Data do empréstimo', type: 'date', value: iso(v.issuedOn), hint: 'Dia em que o dinheiro foi entregue. Os juros contam a partir dele.' })}</div>
    ${f({ name: 'firstDue', label: single ? 'Data de vencimento (devolução)' : 'Primeiro vencimento', type: 'date', value: iso(v.firstDue) })}
    ${sw('interest', 'Cobrar juros', L.interest, 'interest')}
    <div id="jx"${hid(!L.interest)}><div id="j-parc"${hid(single)}>${segment('seg-system', SYSTEMS_OPT, L.system, 'loan.system')}<div id="gl-sys">${glossary(L.system)}</div></div>
      <div id="j-uni"${hid(!single)}>${segment('seg-cap', CAPS, L.compounding, 'loan.cap')}<div id="gl-cap">${glossary(L.compounding)}</div></div>
      ${f({ name: 'rate', label: 'Taxa de juros (% ao mês)', type: 'number', value: v.rate, ...M })}${glossary('rate')}</div>
    ${sw('lateFees', 'Cobrar multa e juros de mora se atrasar', L.lateFees, 'lateFees')}
    <div id="mx"${hid(!L.lateFees)}>${f({ name: 'fine', label: 'Multa moratória (%)', type: 'number', value: v.fine, hint: 'Cobrada uma vez sobre a parcela em atraso.', ...M })}${f({ name: 'lateRate', label: 'Juros de mora (% ao mês)', type: 'number', value: v.lateRate, hint: 'Cobrados por dia de atraso, proporcionalmente.', ...M })}${glossary('late')}</div>
    <div class="pv" id="pv"></div>${editing ? '' : button('Comparar opções antes de decidir', { variant: 'sec', style: 'margin-bottom:10px', action: 'loan.compare' })}
    ${footer(button(editing ? 'Salvar alterações' : 'Salvar empréstimo', { id: 'f-s', action: 'loan.save', disabled: true }))}`;
}

const num = (v) => (v === '' || v == null ? NaN : Number(v)), date = (v) => (v ? new Date(`${v}T00:00`) : null);
/** Campos da folha + estado do formulário → entrada dos casos de uso. */
export function readLoan(d, L) {
  const single = L.mode === 'single';
  return { personId: d.personId || '', description: (d.description ?? '').trim(), principal: num(d.principal), system: single ? 'single' : L.interest ? L.system : 'none',
    installments: single ? 1 : Math.round(num(d.installments)), monthlyRate: L.interest ? (num(d.rate) || 0) / 100 : 0, firstDue: date(d.firstDue) ?? undefined,
    issuedOn: single ? date(d.issuedOn) : null, compounding: single ? L.compounding : null, fine: L.lateFees ? num(d.fine) || 0 : 0, lateRate: L.lateFees ? num(d.lateRate) || 0 : 0 };
}

export function loanPreview(p, input, L) {
  if (!p.ok) return input.principal > 0 && input.firstDue && (L.mode !== 'single' || input.issuedOn) ? html`${p.message}` : html`Preencha o valor e as datas para ver a simulação.`;
  const R = (a, b) => html`<div><span>${a}</span><b>${b}</b></div>`;
  const lead = L.mode === 'single' ? html`${R('Prazo', `${diffDays(input.issuedOn, input.firstDue)} dias`)}${R('Valor a receber no vencimento', brl(p.first.payment))}`
    : L.interest && L.system === 'sac' ? html`${R('Primeira parcela', brl(p.first.payment))}${R('Última parcela', brl(p.last.payment))}` : R('Valor da parcela', brl(p.first.payment));
  return html`${lead}${R('Total de juros', brl(p.interest))}${R('Total a receber', brl(input.principal + p.interest))}${p.lateExample > 0 ? R('Se atrasar 15 dias', `+ ${brl(p.lateExample)}`) : ''}`;
}
