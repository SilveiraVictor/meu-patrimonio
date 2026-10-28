import { html } from '../html.js';
import { button, field, footer, select, sheetHeader } from '../components.js';
import { comboField } from '../combo.js';
import { glossary } from '../glossary.js';
import { INDEXERS, RATE_LABELS } from '../presenters.js';
import { CATEGORIES } from '../../domain/investment/investment.js';
import { isoDate } from '../../domain/shared/dates.js';

const I = 'investment.input';
const f = (o) => field({ input: I, ...o });
const NUM = { inputmode: 'decimal', min: 0, step: 'any' };

export function investmentFormView({ inv = {}, custodian = '', issuer = '', editing = false }) {
  const rule = inv.redemptionRule ?? 'maturity';
  return html`${sheetHeader(editing ? 'Editar título' : 'Novo título')}
    ${f({ name: 'name', label: 'Nome do título', value: inv.name, maxlength: 60, placeholder: 'Ex.: LCA Banco ABC 11%', hint: 'Como você vai reconhecer este investimento.' })}
    ${comboField({ name: 'custodian', kind: 'institution', label: 'Instituição custodiante', placeholder: 'Ex.: Banco XPTO', hint: 'Onde o título está guardado (sua conta ou corretora).', value: custodian, selectedId: inv.custodianId })}
    ${comboField({ name: 'issuer', kind: 'institution', label: 'Instituição emissora', placeholder: 'Ex.: Banco ABC', hint: 'Quem emitiu o título e paga o rendimento.', value: issuer, selectedId: inv.issuerId })}
    ${select({ name: 'category', label: 'Categoria', options: CATEGORIES.map((c) => [c, c]), value: inv.category ?? 'CDB', input: I })}
    ${select({ name: 'indexer', label: 'Indexador', options: Object.entries(INDEXERS), value: inv.indexer ?? 'fixed', input: I })}${glossary('indexer')}
    ${f({ name: 'rate', label: RATE_LABELS[inv.indexer ?? 'fixed'], type: 'number', value: inv.rate, ...NUM })}
    ${f({ name: 'amount', label: 'Valor aplicado (R$)', type: 'number', value: inv.amount, ...NUM })}
    ${f({ name: 'appliedOn', label: 'Data da aplicação (opcional)', type: 'date', value: inv.appliedOn ? isoDate(inv.appliedOn) : '', hint: 'Se não souber, informe o prazo em dias.' })}
    ${f({ name: 'maturity', label: 'Data de vencimento', type: 'date', value: inv.maturity ? isoDate(inv.maturity) : '', hint: 'Você será lembrado antes de vencer.' })}
    ${field({ name: 'termDays', label: 'Prazo (dias)', type: 'number', value: inv.termDays ?? '', input: 'investment.term', inputmode: 'numeric', min: 1, step: 1 })}<div id="pz-al"></div>
    ${f({ name: 'graceDays', label: 'Carência (dias)', type: 'number', value: inv.graceDays || '', inputmode: 'numeric', min: 0, step: 1, hint: 'Dias após a aplicação em que não dá para resgatar. Deixe em branco se não houver.' })}${glossary('grace')}
    ${select({ name: 'redemptionRule', label: 'Resgate', options: [['maturity', 'Somente no vencimento'], ['daily', 'Liquidez diária (a qualquer momento)'], ['penalty', 'Antecipado, com penalidade']], value: rule, input: I })}${glossary('liquidity')}
    <div id="pn-w"${rule === 'penalty' ? '' : html` hidden`}>${f({ name: 'penaltyNote', label: 'Penalidade (opcional)', value: inv.penaltyNote, maxlength: 60, placeholder: 'Ex.: 10% sobre o rendimento', hint: 'Como a instituição informa a penalidade.' })}</div>
    <div class="pv" id="ipv"></div>
    ${footer(button(editing ? 'Salvar alterações' : 'Salvar título', { id: 'i-s', action: 'investment.save', disabled: true }))}`;
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const date = (v) => (v ? new Date(`${v}T00:00`) : null);
/** Campos da folha → entrada dos casos de uso. */
export function readInvestment(d, session) {
  return {
    name: d.name, custodianId: d.custodianId, issuerId: d.issuerId, category: d.category, indexer: d.indexer, rate: num(d.rate), amount: num(d.amount),
    appliedOn: date(d.appliedOn), maturity: date(d.maturity) ?? undefined, termDays: d.termDays === '' ? undefined : Number(d.termDays),
    termDecision: session.decision, graceDays: num(d.graceDays) || 0, redemptionRule: d.redemptionRule, penaltyNote: d.penaltyNote,
  };
}
