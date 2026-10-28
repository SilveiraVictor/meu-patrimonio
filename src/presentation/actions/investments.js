import { html } from '../html.js';
import { alert, button, field, footer, heading, sheetHeader, act } from '../components.js';
import { confirmSheet } from './common.js';
import { investmentFormView, readInvestment } from '../forms/investmentForm.js';
import { modeSeg, readRedemption, redemptionFormView, redemptionPreview, warningText } from '../forms/redemptionForm.js';
import { RATE_LABELS } from '../presenters.js';
import { brl, num } from '../format.js';
import { navigate } from '../navigation.js';
import { remainingPrincipal } from '../../domain/investment/yield.js';

const SMALL = 'min-height:44px;font-size:calc(14px*var(--fs))';
const row = (a, b) => html`<div><span>${a}</span><b>${b}</b></div>`;

export function investmentActions(ctx) {
  const { app, shell, store } = ctx;
  let F = null, R = null;
  const goTo = async (tab) => { const before = store.get(); store.dispatch(navigate.go, tab); if (store.get() === before) await ctx.render(); };
  const close = () => { ctx.form = null; shell.closeSheet(); };
  const readNow = () => readInvestment(shell.formData(), F);

  function previewHtml(input, term, projection) {
    if (input.appliedOn && input.maturity && input.maturity <= input.appliedOn) return 'O vencimento precisa ser depois da aplicação.';
    if (!(input.maturity && input.amount > 0 && Number.isFinite(input.rate))) return 'Preencha taxa, valor e vencimento para ver a simulação.';
    if (!projection) return html`${row('Prazo', 'não informado')}${row('Rendimento', 'não calculado')}`;
    return html`${row('Prazo', `${projection.days} dias`)}${row('Imposto', projection.taxRate ? `IR ${num(projection.taxRate * 100)}%` : 'Isento de IR')}${row('Líquido no vencimento', brl(projection.finalNet))}${row('Tipo de valor', input.indexer === 'fixed' ? 'Valor real' : 'Estimativa')}`;
  }

  async function refresh() {
    if (!F) return;
    let input = readNow(), { term, projection } = await app.investments.preview(input);
    if (!F.termTouched && term.calculated != null && String(term.calculated) !== String(input.termDays ?? '')) {
      shell.patch('#f-termDays', { value: String(term.calculated) }); input = readNow(); ({ term, projection } = await app.investments.preview(input));
    }
    const error = await app.investments.validate(input, F.id);
    shell.patch('#l-rate', { text: RATE_LABELS[input.indexer] }); shell.patch('#pn-w', { hidden: input.redemptionRule !== 'penalty' });
    shell.patch('#h-termDays', { text: term.calculated != null ? `Calculado pelas datas: ${term.calculated} dias.` : 'Sem a data de aplicação? Informe o prazo em dias.' });
    shell.patch('#pz-al', { html: String(term.status === 'conflict'
      ? alert(html`<span>O prazo informado (${term.informed} dias) é diferente do calculado pelas datas (${term.calculated} dias, do vencimento menos a aplicação). Qual faz mais sentido agora?</span><div style="display:flex;gap:8px">${button(`Usar ${term.calculated} dias`, { action: 'investment.pickTerm', arg: 'use-calculated', style: SMALL })}${button(`Manter ${term.informed} dias`, { variant: 'sec', action: 'investment.pickTerm', arg: 'keep-informed', style: SMALL })}</div>`, { col: true })
      : term.status === 'missing' ? html`<div class="m" style="color:var(--or-ink);font-weight:700;margin-top:6px">Sem o prazo não será possível calcular o rendimento.</div>` : '') });
    shell.patch('#i-s', { disabled: !!error }); shell.patch('#ipv', { html: String(previewHtml(input, term, projection)) });
  }

  async function openForm(id) {
    const inv = id ? await app.investments.get(id) : null;
    const [custodian, issuer] = inv ? await Promise.all([app.institutions.nameOf(inv.custodianId), app.institutions.nameOf(inv.issuerId)]) : ['', ''];
    F = { id: id ?? null, termTouched: inv?.termSource === 'informed', decision: null }; ctx.form = { refresh };
    shell.openSheet(String(investmentFormView({ inv: inv ?? {}, custodian, issuer, editing: !!inv })));
    const t = app.investments.term(readNow()); if (t.status === 'conflict') F.decision = { key: t.key, choice: 'keep-informed' };
    await refresh();
  }

  // ----- resgates
  const hint = (p, mode) => mode === 'total' ? (p.estimate != null ? `Estimativa do app para essa data: ${brl(p.estimate)}. Informe o valor do extrato para mais precisão.` : 'Informe o valor bruto do extrato ou o valor líquido recebido.')
    : `Valor antes dos impostos, como aparece no extrato. Posição inteira estimada pelo app: ${p.estimate != null ? brl(p.estimate) : 'indisponível'}.`;
  async function refreshRedemption() {
    if (!R) return;
    const p = await app.investments.previewRedemption(R.id, readRedemption(shell.formData(), R.mode), R.rid);
    shell.patch('#l-gross', { text: R.mode === 'partial' ? 'Valor bruto a resgatar (R$)' : 'Valor bruto resgatado (R$, opcional)' }); shell.patch('#h-gross', { text: hint(p, R.mode) });
    shell.patch('#r-w', { html: p.warnings.map((w) => String(alert(warningText(w), { tone: 'info' }))).join('') });
    shell.patch('#rpv', { html: String(redemptionPreview(p, p.investment)) }); shell.patch('#r-s', { disabled: !p.record });
  }
  async function openRedemption(id, rid) {
    const inv = await app.investments.get(id), rec = rid ? inv.redemptions.find((r) => r.id === rid) : null, today = app.clock.today();
    const base = rid ? { ...inv, redemptions: inv.redemptions.filter((r) => r.id !== rid) } : inv;
    R = { id, rid: rid ?? null, mode: rec?.mode ?? 'total' }; ctx.form = { refresh: refreshRedemption };
    shell.openSheet(String(redemptionFormView({ inv, rec, remaining: remainingPrincipal(base), date: rec?.date ?? (inv.maturity <= today ? inv.maturity : today), mode: R.mode })));
    await refreshRedemption();
  }

  // ----- instituições
  async function institutionList() {
    const rows = await app.institutions.searchWithUsage('', 100000);
    shell.openSheet(String(html`${sheetHeader('Instituições financeiras')}${rows.length ? rows.map(({ entity: e, uses }) => html`<div class="card row"><div class="grow"><div class="t">${e.name}</div><div class="m">${[e.cnpj && `CNPJ ${e.cnpj}`, e.note, `${uses} título${uses === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div></div><button class="chip" style="border:0;min-height:44px;padding:0 14px"${act({ action: 'institutions.form', arg: e.id })}>Editar</button></div>`) : html`<p class="m">Nenhuma instituição cadastrada ainda.</p>`}${footer(button('Nova instituição', { action: 'institutions.form' }))}`));
  }

  return {
    'investment.new': () => openForm(null), 'investment.edit': (id) => openForm(id),
    'investment.input': () => refresh(),
    'investment.term': (v) => { F.termTouched = v !== ''; F.decision = null; return refresh(); },
    'investment.pickTerm'(choice) {
      const t = app.investments.term(readNow());
      if (choice === 'use-calculated') { shell.patch('#f-termDays', { value: String(t.calculated) }); F.termTouched = false; F.decision = null; } else { F.termTouched = true; F.decision = { key: t.key, choice }; }
      return refresh();
    },
    async 'investment.save'() {
      const input = readNow(), id = F.id;
      try { if (id) await app.investments.revise(id, input); else await app.investments.create(input); } catch (e) { ctx.toast(e.message); return; }
      F = null; close(); if (id) await ctx.render(); else await goTo('investments'); ctx.toast(id ? 'Título atualizado' : 'Título salvo');
    },
    'investment.askDelete': async (id) => confirmSheet(ctx, { title: 'Excluir título?', message: `${(await app.investments.get(id)).name} será removido. Isso não pode ser desfeito.`, label: 'Excluir', action: 'investment.delete', arg: id }),
    async 'investment.delete'(id) { await app.investments.remove(id); close(); await goTo('investments'); ctx.toast('Excluído'); },

    'redemption.new': (id) => openRedemption(id, null), 'redemption.edit': (id, rid) => openRedemption(id, rid),
    'redemption.input': () => refreshRedemption(),
    'redemption.mode'(mode) { R.mode = mode; shell.patch('#r-seg', { html: String(modeSeg(mode)) }); return refreshRedemption(); },
    async 'redemption.save'() {
      const input = readRedemption(shell.formData(), R.mode), { id, rid } = R;
      try { if (rid) await app.investments.updateRedemption(id, rid, input); else await app.investments.registerRedemption(id, input); } catch (e) { ctx.toast(e.message); return; }
      R = null; close(); await ctx.render(); ctx.toast(rid ? 'Resgate atualizado' : 'Resgate registrado');
    },
    'redemption.askDelete': () => confirmSheet(ctx, { title: 'Excluir este resgate?', message: 'O valor volta a contar como aplicado e a rentabilidade realizada é recalculada.', label: 'Excluir', action: 'redemption.delete' }),
    async 'redemption.delete'() { await app.investments.deleteRedemption(R.id, R.rid); R = null; close(); await ctx.render(); ctx.toast('Resgate excluído'); },

    async 'indicators.edit'() {
      const ind = await app.settings.indicators.get();
      shell.openSheet(String(html`${sheetHeader('Indicadores de referência')}${[['cdi', 'CDI (% ao ano)'], ['selic', 'Selic (% ao ano)'], ['ipca', 'IPCA acumulado em 12 meses (%)']].map(([k, l]) => field({ name: k, label: l, type: 'number', value: ind[k], inputmode: 'decimal', step: 'any', min: 0 }))}${footer(button('Salvar indicadores', { action: 'indicators.save' }))}`));
    },
    async 'indicators.save'() {
      const d = shell.formData(), v = (x) => (x === '' ? undefined : x);
      try { await app.settings.indicators.set({ cdi: v(d.cdi), selic: v(d.selic), ipca: v(d.ipca) }); } catch (e) { ctx.toast(e.message); return; }
      close(); await ctx.render(); ctx.toast('Indicadores atualizados');
    },

    'institutions.open': institutionList,
    async 'institutions.form'(id) {
      const e = id ? await app.institutions.get(id) : { name: '', cnpj: '', note: '' };
      shell.openSheet(String(html`${sheetHeader(id ? 'Editar instituição' : 'Nova instituição', { back: 'institutions.open' })}
        ${field({ name: 'name', label: 'Nome', value: e.name })}${field({ name: 'cnpj', label: 'CNPJ (opcional)', value: e.cnpj, placeholder: '00.000.000/0000-00', inputmode: 'numeric', input: 'mask', arg: 'cnpj' })}
        ${field({ name: 'note', label: 'Observação (opcional)', value: e.note, maxlength: 60, placeholder: 'Ex.: matriz, agencia X', hint: 'Ajuda a diferenciar instituições com o mesmo nome.' })}
        ${id ? button('Excluir instituição', { variant: 'sec', style: 'color:var(--bad);margin-top:6px', action: 'institutions.delete', arg: id }) : ''}${footer(button('Salvar', { action: 'institutions.save', arg: id ?? '' }))}`));
    },
    async 'institutions.save'(id) {
      const d = shell.formData(), input = { name: d.name, cnpj: d.cnpj, note: d.note };
      try { if (id) await app.institutions.update(id, input, { confirmDistinct: true }); else await app.institutions.create(input, { confirmDistinct: true }); } catch (e) { ctx.toast(e.message); return; }
      await ctx.render(); await institutionList(); ctx.toast('Instituição salva');
    },
    async 'institutions.delete'(id) { try { await app.institutions.remove(id); } catch (e) { ctx.toast(e.message); return; } await ctx.render(); await institutionList(); ctx.toast('Instituição excluída'); },
  };
}
