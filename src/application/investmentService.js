import { projectToMaturity, remainingPrincipal } from '../domain/investment/yield.js';
import { estimatedPosition } from '../domain/investment/redemption.js';
import { institutionKind } from '../domain/registry/institution.js';
import { displayName } from '../domain/registry/registry.js';
import { resolveTerm } from '../domain/investment/term.js';
import { InvestmentError, buildInvestment, reviseInvestment, recordRedemption, editRedemption, deleteRedemption, redemptionWarnings, summarizeRedemptions, investmentStatus, progress } from '../domain/investment/investment.js';
import { portfolioTotals, upcomingEvents, activeInvestments, redeemedInvestments } from '../domain/investment/portfolio.js';

/** Casos de uso de investimentos. `indicators.get()` devolve { cdi, selic, ipca }. */
export class InvestmentService {
  constructor({ investments, loans, institutions, indicators, clock, newId = () => globalThis.crypto.randomUUID() }) { Object.assign(this, { investments, loans, institutions, indicators, clock, newId }); }

  async #load(id) { const i = await this.investments.get(id); if (!i) throw new Error('Título não encontrado'); return i; }
  /** Para a tela: mostra o conflito de prazo e pergunta qual usar. */
  term(input) { return resolveTerm({ appliedOn: input.appliedOn, maturity: input.maturity, informed: input.termDays, decision: input.termDecision }); }

  async create(input) { const inv = buildInvestment({ ...input, id: this.newId() }, this.term(input)); await this.investments.save(inv); return inv; }
  async revise(id, changes) {
    const cur = await this.#load(id), merged = { ...cur, ...changes };
    if (!('termDays' in changes)) merged.termDays = cur.termSource === 'informed' ? cur.termDays : undefined;
    const next = reviseInvestment(cur, changes, this.term(merged)); await this.investments.save(next); return next;
  }
  remove(id) { return this.investments.remove(id); }

  async project(id) { return projectToMaturity(await this.#load(id), await this.indicators.get()); }
  async warnings(id, date) { return redemptionWarnings(await this.#load(id), date); }
  async summary(id) { return summarizeRedemptions(await this.#load(id)); }
  get(id) { return this.investments.get(id); }
  async #names() { const all = await this.institutions.list(); return (id) => { const i = all.find((x) => x.id === id); return i ? displayName(institutionKind, i, all) : ''; }; }
  async view(id) {
    const inv = await this.#load(id), t = this.clock.today(), ind = await this.indicators.get(), name = await this.#names();
    return { investment: inv, status: investmentStatus(inv, t), progress: progress(inv, t), projection: projectToMaturity(inv, ind), summary: summarizeRedemptions(inv), indicators: ind, custodian: name(inv.custodianId), issuer: name(inv.issuerId) };
  }
  /** Tela de Investimentos: totais, ativos (com projeção e progresso) e resgatados. */
  async overview() {
    const invs = await this.investments.list(), t = this.clock.today(), ind = await this.indicators.get(), name = await this.#names();
    const item = (i) => ({ investment: i, status: investmentStatus(i, t), progress: progress(i, t), projection: projectToMaturity(i, ind), summary: summarizeRedemptions(i), custodian: name(i.custodianId), issuer: name(i.issuerId) });
    return { indicators: ind, totals: portfolioTotals(invs, ind), active: activeInvestments(invs).map(item), redeemed: redeemedInvestments(invs).map(item), count: invs.length, institutionCount: (await this.institutions.list()).length };
  }
  /** Mensagem de validação (ou null) para habilitar o botão Salvar do formulário. */
  async validate(input, id) {
    try { const term = this.term(input); if (id) reviseInvestment(await this.#load(id), input, term); else buildInvestment({ ...input, id: 'x' }, term); return null; }
    catch (e) { if (e instanceof InvestmentError) return e.message; throw e; }
  }
  /** Prévia do formulário: prazo resolvido e rendimento estimado, sem salvar nada. */
  async preview(input) {
    const term = this.term(input), ok = term.status === 'ok' && input.amount > 0 && Number.isFinite(input.rate) && input.maturity instanceof Date && input.indexer;
    const projection = ok ? projectToMaturity({ category: input.category, indexer: input.indexer, rate: input.rate, amount: input.amount, appliedOn: input.appliedOn, maturity: input.maturity, termDays: term.term, redemptions: [] }, await this.indicators.get()) : null;
    return { term, projection };
  }
  async previewRedemption(id, input, rid) {
    const inv = await this.#load(id), ind = await this.indicators.get(), base = rid ? { ...inv, redemptions: inv.redemptions.filter((r) => r.id !== rid) } : inv;
    let record = null, message = null;
    try { record = recordRedemption(base, input, ind, 'preview').record; } catch (e) { if (e instanceof InvestmentError) message = e.message; else throw e; }
    return { record, message, estimate: input.date ? estimatedPosition(base, input.date, ind) : null, remaining: remainingPrincipal(base), warnings: redemptionWarnings(inv, input.date), investment: base };
  }

  async #redeem(id, fn) { const inv = await this.#load(id), { investment, record } = fn(inv, await this.indicators.get()); await this.investments.save(investment); return record; }
  registerRedemption(id, input) { return this.#redeem(id, (inv, ind) => recordRedemption(inv, input, ind, `r${this.newId()}`)); }
  updateRedemption(id, rid, input) { return this.#redeem(id, (inv, ind) => editRedemption(inv, rid, input, ind)); }
  async deleteRedemption(id, rid) { await this.investments.save(deleteRedemption(await this.#load(id), rid)); }

  async totals() { return portfolioTotals(await this.investments.list(), await this.indicators.get()); }
  async upcoming(limit) { return upcomingEvents(await this.investments.list(), await this.loans.list(), this.clock.today(), limit); }
}
