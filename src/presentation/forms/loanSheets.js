import { html, raw } from '../html.js';
import { alert, button, card, field, footer, heading, select, seg, sheetHeader, act } from '../components.js';
import { glossary } from '../glossary.js';
import { kindDef } from '../combo.js';
import { brl, shortDate } from '../format.js';

const SMALL = 'min-height:44px;font-size:calc(14px*var(--fs))';
const row = (a, b, style = '') => html`<div><span>${a}</span><b${style ? raw(` style="${style}"`) : ''}>${b}</b></div>`;

// ----- antecipar / amortizar
export function prepayRows(pv, A) {
  if (!pv) return html`Informe um valor para ver o efeito.`;
  return html`${row('Você paga agora', brl(pv.amount))}${A.tab === 'ant' && pv.nominal != null ? row('Soma das parcelas (sem desconto)', brl(pv.nominal)) : ''}
    ${pv.remaining ? html`${row(A.tab === 'ant' ? 'Parcela (mantida)' : 'Nova parcela', brl(pv.payment))}${row('Parcelas restantes', pv.remaining)}` : row('Resultado', 'Quitado')}
    ${pv.savedInterest > 0.005 ? row('Juros economizados', brl(pv.savedInterest), 'color:var(--ok)') : ''}`;
}
export function prepayView({ loan, A, preview }) {
  const opt = (v, t, d) => html`<button class="opt" aria-pressed="${String(A.mode === v)}"${act({ action: 'prepay.mode', arg: v })}><div class="t">${t}</div><div class="m">${d}</div></button>`;
  return html`${sheetHeader('Antecipar ou amortizar')}${seg([['ant', 'Antecipar parcelas'], ['val', 'Amortizar valor']], A.tab, 'prepay.tab')}<div style="height:16px"></div>${glossary(A.tab === 'ant' ? 'anticipate' : 'amortize')}
    ${A.tab === 'ant' ? html`<p class="sub" style="margin-bottom:6px">Quite as últimas parcelas agora, descontando os juros delas.</p>
      <div class="step"><button aria-label="Menos"${act({ action: 'prepay.step', arg: -1 })}>−</button><b>${A.n}</b><button aria-label="Mais"${act({ action: 'prepay.step', arg: 1 })}>+</button></div>
      <p class="m" style="text-align:center;margin-top:-6px">parcela${A.n > 1 ? 's' : ''} de ${loan.remaining} restantes</p>`
      : html`${field({ name: 'amount', label: 'Valor a abater (R$)', type: 'number', value: A.val, input: 'prepay.input', inputmode: 'decimal', min: 0, max: loan.balance.toFixed(2), step: 'any', hint: `Saldo devedor: ${brl(loan.balance)}` })}
      ${opt('term', 'Reduzir o prazo', 'Mantém a parcela e termina antes.')}${opt('installment', 'Reduzir a parcela', 'Mantém o prazo e diminui o valor.')}`}
    <div class="pv" id="apv">${prepayRows(preview, A)}</div>${footer(button(A.tab === 'ant' ? 'Confirmar antecipação' : 'Confirmar amortização', { id: 'a-s', action: 'prepay.confirm', disabled: !preview }))}`;
}

// ----- simulador
const sf = (name, label, value, o = {}) => field({ name, label, value, type: 'number', input: 'sim.input', inputmode: 'decimal', min: 0, step: 'any', ...o });
export function simulatorView(SM) {
  return html`${sheetHeader('Simulador de empréstimo')}<p class="sub">Compare as formas de cobrar antes de combinar com a pessoa. Nada aqui é salvo.</p>
    ${sf('sv', 'Valor a emprestar (R$)', SM.v)}${sf('st', 'Taxa de juros (% ao mês)', SM.t)}${glossary('rate')}${sf('sm', 'Se parcelado: número de parcelas mensais', SM.m)}${sf('sd', 'Se pagamento único: dias até a devolução', SM.d)}<div id="sr"></div>
    ${heading('E se a pessoa atrasar?')}${sf('sp', 'Valor da parcela em atraso (R$)', '', { input: 'sim.lateP' })}${sf('sa', 'Dias de atraso', SM.a)}${sf('smu', 'Multa moratória (%)', SM.mu)}${sf('smo', 'Juros de mora (% ao mês)', SM.mo)}<div class="pv" id="sla"></div>${glossary('late')}`;
}
export function simulatorResults(options) {
  if (!options.length) return html`<p class="m">Informe valor, parcelas e dias para comparar.</p>`;
  return options.map((o, k) => { const r = o.rows, sac = o.system === 'sac';
    return card(html`<div class="t">${o.title}</div><div class="m">${o.description}</div><div class="pv" style="margin:10px 0">${r.length > 1 ? (sac ? html`${row('1ª parcela', brl(r[0].payment))}${row('Última parcela', brl(r.at(-1).payment))}` : row(`${r.length}x de`, brl(r[0].payment))) : row('Valor a receber', brl(r[0].payment))}${row('Total de juros', brl(o.interest))}${row('Total a receber', brl(o.total))}</div>${button('Usar esta configuração', { variant: 'sec', style: SMALL, action: 'sim.use', arg: k })}`);
  });
}
export const lateResult = (late) => (late ? html`${row('Multa moratória', brl(late.fine))}${row('Juros de mora', brl(late.interest))}${row('Total a pagar', brl(late.total))}` : html`Informe o valor da parcela para simular o atraso.`);

// ----- pessoas
export function peopleListView(rows) {
  return html`${sheetHeader('Pessoas')}${rows.length ? rows.map(({ entity: p, uses }) => html`<div class="card row"><div class="grow"><div class="t">${p.name}${p.nickname ? html` <span class="m">“${p.nickname}”</span>` : ''}</div><div class="m">${[p.note, [p.phone, p.email].filter(Boolean).join(' · ') || 'Sem contato', `${uses} empréstimo${uses === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div></div>
    ${uses ? html`<button class="chip" style="border:0;min-height:44px;padding:0 14px;margin-right:6px"${act({ action: 'people.view', arg: p.id })}>Ver</button>` : ''}<button class="chip" style="border:0;min-height:44px;padding:0 14px"${act({ action: 'people.form', arg: p.id })}>Editar</button></div>`) : html`<p class="m">Nenhuma pessoa cadastrada ainda.</p>`}${footer(button('Nova pessoa', { action: 'people.form' }))}`;
}
export const personFields = () => kindDef('person').fields;
export function personFormView(p, id) {
  return html`${sheetHeader(id ? 'Editar pessoa' : 'Nova pessoa', { back: 'people.open' })}${personFields().map(([k, label, o]) => field({ name: k, label, value: p[k] ?? '', ...o }))}<p class="m">Os dados ficam só neste aparelho.</p>
    ${id ? button('Excluir pessoa', { variant: 'sec', style: 'color:var(--bad);margin-top:6px', action: 'people.delete', arg: id }) : ''}${footer(button('Salvar', { action: 'people.save', arg: id ?? '' }))}`;
}

// ----- cobrança, recibo e situação
const HINTS = { collection: 'Lembrete de um pagamento a vencer ou em atraso.', receipt: 'Comprovante de um pagamento que você recebeu.', status: 'Resumo do que foi pago e do que falta.' };
export function sendView({ M, fmt, creditor, receipts }) {
  const tabs = M.scope === 'loan' ? [['collection', 'Cobrança'], ['receipt', 'Recibo'], ['status', 'Situação']] : [['collection', 'Cobrança'], ['status', 'Situação']];
  return html`${sheetHeader('Cobrança, recibo e situação')}<div class="noprint">${seg(tabs, M.tab, 'send.tab')}<p class="m" style="margin:6px 0 12px">${HINTS[M.tab]}</p>
    <div class="card row" id="send-contact"></div>
    ${M.tab === 'receipt' && receipts.length ? select({ name: 'receipt', label: 'Pagamento', options: receipts.map((r) => [String(r.index), `${r.label} · ${brl(r.amount)} · ${shortDate(r.date)}`]), value: String(M.sel), input: 'send.receipt' }) : ''}
    ${M.scope === 'loan' ? html`<div style="margin-bottom:12px">${seg([['message', 'Mensagem'], ['document', 'Documento']], fmt, 'send.fmt')}</div>` : ''}
    <details class="why"><summary>Seus dados no texto e no documento (opcional)</summary>${field({ name: 'creditorName', label: 'Seu nome', value: creditor.name, input: 'send.creditor' })}${field({ name: 'creditorPix', label: 'Sua chave Pix', value: creditor.pix, input: 'send.creditor', hint: 'Aparece na cobrança e na situação para facilitar o pagamento.' })}</details>
    ${fmt === 'message' ? html`<div class="f"><label for="f-text">Mensagem</label><textarea id="f-text" name="text" rows="9" data-input="send.edit"></textarea><small>Você pode editar o texto antes de enviar.</small></div>` : ''}</div>
    ${fmt === 'document' ? html`<div id="dp"></div>` : ''}
    <div class="noprint foot">${fmt === 'message'
      ? html`<div style="display:flex;gap:8px"><a class="btn" id="mg-wa" target="_blank" rel="noopener" style="flex:1.4">WhatsApp</a><a class="btn sec" id="mg-em" style="flex:1">E-mail</a></div><div style="display:flex;gap:8px;margin-top:8px">${button('Copiar texto', { variant: 'sec', style: 'min-height:46px', action: 'send.copy' })}${button('Compartilhar', { variant: 'sec', style: 'min-height:46px', action: 'send.share' })}</div>`
      : html`${button('Compartilhar imagem', { id: 'd-img', action: 'doc.out', arg: 'img' })}<div style="display:flex;gap:8px;margin-top:8px">${button('Salvar PDF', { id: 'd-pdf', variant: 'sec', style: 'min-height:46px', action: 'doc.out', arg: 'pdf' })}${button('Imprimir', { id: 'd-prt', variant: 'sec', style: 'min-height:46px', action: 'doc.out', arg: 'print' })}</div>`}</div>`;
}
/** Prévia do papel (sempre clara: é o que vira imagem, PDF ou impressão). */
export const documentHtml = (d) => html`<div class="paper"><div class="ph"><b>${d.title}</b><span>${d.sub}</span></div>${d.hero ? html`<div class="hb"><span>${d.hero.label}</span><b>${d.hero.value}</b></div>` : ''}${d.note ? html`<p class="pn">${d.note}</p>` : ''}
  <div class="pk">${d.rows.map(([a, b]) => html`<div><span>${a}</span><b>${b}</b></div>`)}</div>${d.table ? html`<div class="sc"><table><tr>${d.table.head.map((h) => html`<th>${h}</th>`)}</tr>${d.table.body.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</table></div>` : ''}${d.sign ? html`<div class="sg">Assinatura do credor</div>` : ''}<div class="pf">Gerado pelo app Meu Patrimônio</div></div>`;
