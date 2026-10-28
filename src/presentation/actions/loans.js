import { html } from '../html.js';
import { ico } from '../components.js';
import { confirmSheet } from './common.js';
import { kindDef } from '../combo.js';
import { loanFormView, readLoan, loanPreview, segmentButtons, MODES, SYSTEMS_OPT, CAPS } from '../forms/loanForm.js';
import { prepayView, prepayRows, simulatorView, simulatorResults, lateResult, peopleListView, personFormView, personFields, sendView, documentHtml } from '../forms/loanSheets.js';
import { exportDocument } from '../documentExport.js';
import { glossary } from '../glossary.js';
import { navigate } from '../navigation.js';
import { addMonths, isoDate } from '../../domain/shared/dates.js';
import { totalInstallments } from '../../domain/loan/loan.js';
import { firstDueOf } from '../../domain/loan/revision.js';
import { whatsappUrl, mailtoUrl } from '../../domain/communication/channels.js';
import { digits } from '../../domain/shared/text.js';

export function loanActions(ctx) {
  const { app, shell, store } = ctx;
  let LS = null, A = null, M = null, SIM = { options: [] };
  const SM = { v: 1000, t: 2, m: 3, d: 30, mu: 2, mo: 1, a: 15, pTouched: false, draft: null };
  const close = () => { ctx.form = null; shell.closeSheet(); };
  const goTo = async (tab) => { const before = store.get(); store.dispatch(navigate.go, tab); if (store.get() === before) await ctx.render(); };
  const afterChange = async () => { await ctx.render(); };

  // ===== formulário de empréstimo
  const readNow = () => readLoan(shell.formData(), LS);
  async function refreshLoan() {
    if (!LS) return;
    const input = readNow(), single = LS.mode === 'single';
    for (const [sel, hidden] of [['#b-parc', single], ['#b-uni', !single], ['#jx', !LS.interest], ['#j-parc', single], ['#j-uni', !single], ['#mx', !LS.lateFees]]) shell.patch(sel, { hidden });
    shell.patch('#sw-interest', { attrs: { 'aria-checked': String(LS.interest) } }); shell.patch('#sw-lateFees', { attrs: { 'aria-checked': String(LS.lateFees) } });
    shell.patch('#l-firstDue', { text: single ? 'Data de vencimento (devolução)' : 'Primeiro vencimento' });
    const p = await app.loans.preview({ ...input, personId: input.personId || 'preview' }, LS.id);
    shell.patch('#pv', { html: String(loanPreview(p, input, LS)) }); shell.patch('#f-s', { disabled: !(p.ok && input.personId) });
  }
  async function openLoanForm({ id = null, personId = null, preset = null, draft = null } = {}) {
    const t = app.clock.today(); let v, L;
    if (id) {
      const d = await app.loans.detail(id), l = d.loan, single = l.system === 'single';
      v = { person: d.name, personId: l.personId, description: l.description, principal: l.principal, installments: totalInstallments(l), issuedOn: l.issuedOn ?? t, firstDue: firstDueOf(l), rate: l.monthlyRate ? +(l.monthlyRate * 100).toFixed(4) : 1.5, fine: l.fine || 2, lateRate: l.lateRate || 1 };
      L = { id, mode: single ? 'single' : 'installment', interest: l.monthlyRate > 0, system: single || l.system === 'none' ? 'price' : l.system, compounding: l.compounding ?? 'simple', lateFees: !!(l.fine || l.lateRate), payments: l.payments.length };
    } else {
      v = { person: personId ? await app.people.nameOf(personId) : '', personId, description: '', principal: '', installments: '', issuedOn: t, firstDue: addMonths(t, 1), rate: 1.5, fine: 2, lateRate: 1 };
      L = { id: null, mode: 'installment', interest: false, system: 'price', compounding: 'simple', lateFees: false, payments: 0 };
      if (preset) {
        Object.assign(L, { mode: preset.mode, interest: preset.interest, system: preset.system ?? L.system, compounding: preset.compounding ?? L.compounding }); v.principal = preset.value; v.rate = preset.ratePct;
        if (preset.mode === 'installment') { v.installments = preset.installments; v.firstDue = preset.firstDue; } else { v.issuedOn = preset.issuedOn; v.firstDue = preset.dueDate; }
      }
      if (draft) { Object.assign(v, { person: draft.person ?? v.person, personId: draft.personId ?? v.personId, description: draft.description ?? '' }); L.lateFees = !!draft.lateFees; if (draft.lateFees) { v.fine = draft.fine; v.lateRate = draft.lateRate; } }
    }
    LS = L; ctx.form = { refresh: refreshLoan };
    shell.openSheet(String(loanFormView({ v, L, paymentsCount: L.payments }))); await refreshLoan();
  }
  async function applyRevision(input) {
    try { await app.loans.revise(LS.id, input); } catch (e) { ctx.toast(e.message); return; }
    LS = null; close(); await afterChange(); ctx.toast('Empréstimo atualizado', { undo: true });
  }

  // ===== antecipar e amortizar
  async function prepayPreview() {
    try { if (A.tab === 'ant') return await app.loans.previewAnticipation(A.id, A.n); const v = Number(A.val); return v > 0 ? await app.loans.previewAmortization(A.id, Math.min(v, A.loan.balance), A.mode) : null; } catch { return null; }
  }
  async function drawPrepay() { A.loan = (await app.loans.detail(A.id)).loan; shell.openSheet(String(prepayView({ loan: A.loan, A, preview: await prepayPreview() }))); }

  // ===== simulador
  const readSim = () => { const d = shell.formData(), g = (k) => Number(d[k]) || 0; return { value: g('sv'), ratePct: g('st'), installments: Math.round(g('sm')), days: Math.round(g('sd')), lateDays: g('sa'), finePct: g('smu'), latePct: g('smo'), installment: Number(d.sp) || 0 }; };
  function simUpdate() {
    const s = readSim(); Object.assign(SM, { v: s.value, t: s.ratePct, m: s.installments, d: s.days, a: s.lateDays, mu: s.finePct, mo: s.latePct });
    const ok = s.value > 0 && s.installments >= 1 && s.days >= 1; SIM.options = ok ? app.loans.simulate(s) : [];
    if (ok && !SM.pTouched) { s.installment = SIM.options[1].rows[0].payment; shell.patch('#f-sp', { value: s.installment.toFixed(2) }); }
    shell.patch('#sr', { html: String(html`${simulatorResults(SIM.options)}`) });
    shell.patch('#sla', { html: String(lateResult(s.installment > 0 ? app.loans.simulateLate({ installment: s.installment, finePct: s.finePct, latePct: s.latePct, days: s.lateDays }) : null)) });
  }
  function drawSimulator() { shell.openSheet(String(simulatorView(SM))); simUpdate(); }

  // ===== pessoas
  async function peopleList() { shell.openSheet(String(peopleListView(await app.people.searchWithUsage('', 100000)))); }

  // ===== cobrança, recibo e situação
  const fmtOf = () => (M.scope === 'loan' ? M.fmt[M.tab] : 'message');
  function updateLinks() {
    const text = shell.formData().text ?? '', ok = !!text.trim() && !M.last?.empty, c = M.last?.contact ?? {};
    shell.patch('#mg-wa', { attrs: { href: ok ? whatsappUrl(c.phone, text) : '#' }, style: { opacity: ok ? '1' : '.5', pointerEvents: ok ? 'auto' : 'none' } });
    shell.patch('#mg-em', { attrs: { href: ok ? mailtoUrl(c.email, M.tab, text) : '#' }, style: { opacity: ok ? '1' : '.5', pointerEvents: ok ? 'auto' : 'none' } });
  }
  async function refreshSend() {
    const fmt = fmtOf(), r = await app.messages.compose({ scope: M.scope, id: M.id, kind: M.tab, format: fmt === 'document' ? 'document' : 'message', receiptIndex: M.sel }); M.last = r;
    shell.patch('#send-contact', { html: String(html`${ico(r.contact.name[0], 'or')}<div class="grow"><div class="t">${r.contact.name}</div><div class="m">${r.contact.phone || 'sem telefone'} · ${r.contact.email || 'sem e-mail'}</div></div>`) });
    if (fmt === 'message') { shell.patch('#f-text', { value: r.text ?? r.empty }); updateLinks(); }
    else { shell.patch('#dp', { html: r.document ? String(documentHtml(r.document)) : String(html`<p class="m">${r.empty}</p>`) }); for (const id of ['#d-img', '#d-pdf', '#d-prt']) shell.patch(id, { disabled: !r.document }); }
  }
  async function drawSend() {
    const [creditor, receipts] = await Promise.all([app.settings.creditor.get(), M.scope === 'loan' ? app.loans.receiptOptions(M.id) : []]);
    shell.openSheet(String(sendView({ M, fmt: fmtOf(), creditor, receipts }))); await refreshSend();
  }
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); ctx.toast('Mensagem copiada'); } catch { ctx.toast('Não foi possível copiar'); } };

  return {
    // formulário
    'loan.new': () => openLoanForm(), 'loan.newFor': (pid) => openLoanForm({ personId: pid }), 'loan.edit': (id) => openLoanForm({ id }), 'loan.input': () => refreshLoan(),
    'loan.toggle'(what) { LS[what] = !LS[what]; return refreshLoan(); },
    'loan.mode'(v) { LS.mode = v; shell.patch('#seg-mode', { html: String(segmentButtons(MODES, v, 'loan.mode')) }); return refreshLoan(); },
    'loan.system'(v) { LS.system = v; shell.patch('#seg-system', { html: String(segmentButtons(SYSTEMS_OPT, v, 'loan.system')) }); shell.patch('#gl-sys', { html: String(glossary(v)) }); return refreshLoan(); },
    'loan.cap'(v) { LS.compounding = v; shell.patch('#seg-cap', { html: String(segmentButtons(CAPS, v, 'loan.cap')) }); shell.patch('#gl-cap', { html: String(glossary(v)) }); return refreshLoan(); },
    async 'loan.save'() {
      const input = readNow();
      if (LS.id) {
        const impact = await app.loans.previewRevision(LS.id, input).catch((e) => ({ error: e }));
        if (impact.error) { ctx.toast(impact.error.message); return; }
        if (impact.discardsEvents) { confirmSheet(ctx, { title: 'Recalcular o cronograma?', message: 'Este empréstimo tem antecipações ou amortizações registradas. Ao mudar as condições, esses registros serão apagados e o que falta pagar será recalculado. Os pagamentos já recebidos continuam no histórico.', label: 'Recalcular', action: 'loan.applyRevision' }); LS.pending = input; return; }
        return applyRevision(input);
      }
      try { await app.loans.create(input); } catch (e) { ctx.toast(e.message); return; }
      LS = null; close(); if (store.get().personId) await ctx.render(); else await goTo('loans'); ctx.toast('Empréstimo salvo');
    },
    'loan.applyRevision': () => applyRevision(LS.pending),
    async 'loan.pay'(id) { await app.loans.registerPayment(id); await afterChange(); ctx.toast('Pagamento registrado', { undo: true }); },
    async undo() { if (await app.loans.undo()) { shell.closeSheet(); await ctx.render(); ctx.toast('Alteração desfeita'); } },
    async 'loan.askDelete'(id) { const d = await app.loans.detail(id); confirmSheet(ctx, { title: 'Excluir empréstimo?', message: `O empréstimo de ${d.name} e o histórico dele serão removidos. Isso não pode ser desfeito.`, label: 'Excluir', action: 'loan.delete', arg: id }); },
    async 'loan.delete'(id) { await app.loans.remove(id); close(); const s = store.get(); if (s.loanFromPerson) store.dispatch(navigate.openPerson, s.loanFromPerson); else await goTo('loans'); ctx.toast('Excluído'); },

    // antecipar / amortizar
    'prepay.open'(id) { A = { id, tab: 'ant', n: 1, mode: 'term', val: '' }; return drawPrepay(); },
    'prepay.tab'(tab) { A.tab = tab; return drawPrepay(); },
    'prepay.step'(delta) { A.n = Math.min(A.loan.remaining, Math.max(1, A.n + Number(delta))); return drawPrepay(); },
    'prepay.mode'(mode) { A.mode = mode; return drawPrepay(); },
    async 'prepay.input'(v) { A.val = v; const pv = await prepayPreview(); shell.patch('#apv', { html: String(prepayRows(pv, A)) }); shell.patch('#a-s', { disabled: !pv }); },
    async 'prepay.confirm'() {
      let loan; try { loan = A.tab === 'ant' ? await app.loans.anticipate(A.id, A.n) : await app.loans.amortize(A.id, Math.min(Number(A.val), A.loan.balance), A.mode); } catch (e) { ctx.toast(e.message); return; }
      A = null; close(); await afterChange(); ctx.toast(loan.remaining ? 'Atualizado. Cronograma recalculado' : 'Empréstimo quitado', { undo: true });
    },

    // simulador
    'sim.open'() { SM.draft = null; SM.pTouched = false; drawSimulator(); },
    'loan.compare'() {
      const d = shell.formData(), input = readNow(); SM.draft = { person: d.person, personId: d.personId, description: d.description, lateFees: LS.lateFees, fine: Number(d.fine) || 2, lateRate: Number(d.lateRate) || 1 }; SM.pTouched = false;
      if (input.principal > 0) SM.v = input.principal; if (LS.interest && input.monthlyRate > 0) SM.t = +(input.monthlyRate * 100).toFixed(4); if (LS.mode === 'installment' && input.installments > 0) SM.m = input.installments;
      if (LS.mode === 'single' && input.issuedOn && input.firstDue) { const k = Math.round((input.firstDue - input.issuedOn) / 864e5); if (k > 0) SM.d = k; }
      if (LS.lateFees) { SM.mu = SM.draft.fine; SM.mo = SM.draft.lateRate; } drawSimulator();
    },
    'sim.input': () => simUpdate(), 'sim.lateP'(v) { SM.pTouched = v !== ''; simUpdate(); },
    'sim.use'(i) {
      const o = SIM.options[Number(i)]; if (!o) return;
      const draft = { ...(SM.draft ?? {}), lateFees: !!SM.draft?.lateFees || SM.mu > 0 || SM.mo > 0, fine: SM.mu, lateRate: SM.mo };
      return openLoanForm({ preset: { ...o.preset, ratePct: SM.t }, draft, personId: SM.draft?.personId ?? null });
    },

    // pessoas
    'people.open': peopleList,
    async 'people.form'(id) { shell.openSheet(String(personFormView(id ? await app.people.get(id) : {}, id))); },
    async 'people.save'(id) {
      const d = shell.formData(), input = Object.fromEntries(personFields().map(([k]) => [k, d[k] ?? '']));
      try { if (id) await app.people.update(id, input, { confirmDistinct: true }); else await app.people.create(input, { confirmDistinct: true }); } catch (e) { ctx.toast(e.message); return; }
      await ctx.render(); await peopleList(); ctx.toast('Pessoa salva');
    },
    async 'people.delete'(id) { try { await app.people.remove(id); } catch (e) { ctx.toast(e.message); return; } await ctx.render(); await peopleList(); ctx.toast('Pessoa excluída'); },
    'people.view'(id) { close(); store.dispatch(navigate.openPerson, id); },

    // cobrança, recibo e situação
    async 'send.open'(scope, id) {
      M = { scope, id, tab: 'collection', sel: 0, fmt: { collection: 'message', receipt: 'document', status: 'message' } };
      if (scope === 'loan') M.sel = Math.max(0, (await app.loans.receiptOptions(id)).length - 1); await drawSend();
    },
    'send.tab'(tab) { M.tab = tab; return drawSend(); }, 'send.fmt'(f) { M.fmt[M.tab] = f; return drawSend(); },
    'send.receipt'(v) { M.sel = Number(v); return refreshSend(); },
    async 'send.creditor'() { const d = shell.formData(); await app.settings.creditor.set({ name: d.creditorName, pix: d.creditorPix }); await refreshSend(); },
    'send.edit': () => updateLinks(), 'send.copy': () => copy(shell.formData().text ?? ''),
    async 'send.share'() { const text = shell.formData().text ?? ''; if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e?.name === 'AbortError') return; } } await copy(text); },
    async 'doc.out'(kind) {
      const doc = M.last?.document; if (!doc) return;
      const first = M.last.contact.name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), prefix = { receipt: 'recibo-', collection: 'cobranca-', status: 'situacao-' }[M.tab];
      try { await exportDocument({ kind, doc, filename: `${prefix}${first}-${isoDate(app.clock.today())}`, shell }); } catch { ctx.toast('Não foi possível gerar o arquivo'); }
    },
  };
}
