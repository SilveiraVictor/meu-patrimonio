import { createLoan } from '../domain/loan/factory.js';
import { payNext, statusOf, figuresOf } from '../domain/loan/loan.js';
import { anticipate, amortize, previewAnticipation, previewAmortization } from '../domain/loan/prepayment.js';
import { reviseLoan, revisionImpact } from '../domain/loan/revision.js';
import { groupByPerson, receivableThisMonth, openPrincipal, nextInstallmentValue, personSummary } from '../domain/loan/portfolio.js';
import { scheduleOf, totalInstallments } from '../domain/loan/loan.js';
import { lateCharges } from '../domain/loan/lateFees.js';
import { simulateOptions, simulateLate } from '../domain/loan/simulation.js';
import { personKind } from '../domain/registry/person.js';
import { displayName } from '../domain/registry/registry.js';
import { receiptItems } from '../domain/communication/models.js';
import { dueAt, payInstallment } from '../domain/loan/payment.js';

/** Casos de uso de empréstimo. Depende só de portas, nunca de DOM ou localStorage. */
export class LoanService {
  /** @param {{loans: import('./ports.js').Repository, clock: import('./ports.js').Clock, newId?: () => string}} deps */
  constructor({ loans, people, clock, newId = () => globalThis.crypto.randomUUID() }) { this.loans = loans; this.people = people; this.clock = clock; this.newId = newId; this.snapshot = null; }

  async #load(id) { const l = await this.loans.get(id); if (!l) throw new Error('Empréstimo não encontrado'); return l; }
  async #update(id, fn) { this.snapshot = await this.loans.list(); const next = fn(await this.#load(id), this.clock.today()); await this.loans.save(next); return next; }

  async create(input) { const loan = createLoan({ ...input, id: this.newId() }); await this.loans.save(loan); return loan; }
  /** Valor devido pela próxima parcela se for paga em `paidOn` (multa e mora até essa data). */
  async paymentDue(id, paidOn) { return dueAt(await this.#load(id), paidOn); }
  #checkPayment(paidOn, amount) {
    if (!(paidOn instanceof Date) || Number.isNaN(+paidOn)) throw new Error('Informe a data do pagamento');
    if (paidOn > this.clock.today()) throw new Error('A data do pagamento não pode ser futura');
    if (!(amount > 0)) throw new Error('Informe o valor pago');
  }
  /** Prévia do pagamento com data e valor: não salva nada. input = { paidOn, amount, surplus }. */
  async previewPayment(id, input) {
    try {
      const loan = await this.#load(id); this.#checkPayment(input.paidOn, input.amount);
      const due = dueAt(loan, input.paidOn), r = payInstallment(loan, input);
      return { ok: true, due, summary: r.summary, loan: r.loan };
    } catch (e) { return { ok: false, message: e.message }; }
  }
  /** Sem `input`, paga a parcela inteira hoje. Devolve { loan, summary } e alimenta o desfazer. */
  async registerPayment(id, input) {
    const loan = await this.#load(id), today = this.clock.today(), paidOn = input?.paidOn ?? today;
    const amount = input?.amount ?? dueAt(loan, paidOn).total; this.#checkPayment(paidOn, amount);
    const r = payInstallment(loan, { paidOn, amount, surplus: input?.surplus });
    this.snapshot = await this.loans.list(); await this.loans.save(r.loan); return r;
  }
  anticipate(id, count) { return this.#update(id, (l, t) => anticipate(l, count, t)); }
  amortize(id, amount, mode) { return this.#update(id, (l, t) => amortize(l, amount, mode, t)); }
  revise(id, changes) { return this.#update(id, (l) => reviseLoan(l, changes)); }
  remove(id) { return this.loans.remove(id); }
  /** Desfaz a última alteração (pagamento, antecipação, amortização ou edição). */
  async undo() { if (!this.snapshot) return false; await this.loans.replaceAll(this.snapshot); this.snapshot = null; return true; }

  /** Prévia do formulário: valida sem salvar. `existingId` = edição. */
  async preview(input, existingId) {
    try {
      const loan = existingId ? reviseLoan(await this.#load(existingId), input) : createLoan({ ...input, id: 'preview' }), rows = scheduleOf(loan), first = rows[0];
      const impact = existingId ? revisionImpact(await this.#load(existingId), input) : { changed: true, discardsEvents: false };
      return { ok: true, loan, rows, first, last: rows.at(-1), interest: rows.reduce((a, r) => a + r.interest, 0), lateExample: first && (loan.fine || loan.lateRate) ? lateCharges(loan, { due: new Date(this.clock.today().getTime() - 15 * 864e5), payment: first.payment }, this.clock.today()).total : 0, ...impact };
    } catch (e) { if (e instanceof RangeError || e instanceof Error) return { ok: false, message: e.message }; throw e; }
  }
  simulate(input) { return simulateOptions(input, this.clock.today()); }
  simulateLate(input) { return simulateLate(input); }

  async #people() { const all = await this.people.list(); return { get: (id) => all.find((p) => p.id === id), name: (id) => { const p = all.find((x) => x.id === id); return p ? displayName(personKind, p, all) : ''; } }; }
  #item(l, ppl, t) { return { loan: l, person: ppl.get(l.personId), name: ppl.name(l.personId), status: statusOf(l, t), due: l.remaining ? nextInstallmentValue(l, t) : 0, total: totalInstallments(l) }; }

  /** Lista de empréstimos e visão por pessoa. */
  async overview() {
    const all = await this.loans.list(), t = this.clock.today(), ppl = await this.#people();
    return { count: all.length, openPrincipal: openPrincipal(all), peopleWithOpen: new Set(all.filter((l) => l.remaining > 0).map((l) => l.personId)).size, peopleCount: (await this.people.list()).length,
      items: all.map((l) => this.#item(l, ppl, t)), groups: groupByPerson(all, t).map((g) => ({ ...g, person: ppl.get(g.personId), name: ppl.name(g.personId) })) };
  }
  async detail(id) {
    const loan = await this.#load(id), t = this.clock.today(), ppl = await this.#people(), rows = scheduleOf(loan), next = rows[0];
    return { ...this.#item(loan, ppl, t), rows, next, charges: next ? lateCharges(loan, next, t) : null, figures: figuresOf(loan, t), today: t };
  }
  async personDetail(personId) {
    const all = (await this.loans.list()).filter((l) => l.personId === personId), t = this.clock.today(), ppl = await this.#people();
    return { person: ppl.get(personId), name: ppl.name(personId), summary: personSummary(all, t), items: all.map((l) => this.#item(l, ppl, t)) };
  }
  async receiptOptions(id) { return receiptItems(await this.#load(id)).map((it, index) => ({ index, label: it.type === 'installment' ? `Parcela ${it.payment.number}` : it.type === 'partial' ? `Pagamento parcial da parcela ${it.partial.number}` : it.event.label, amount: it.amount, date: it.date })); }

  async previewAnticipation(id, count) { return previewAnticipation(await this.#load(id), count, this.clock.today()); }
  async previewAmortization(id, amount, mode) { return previewAmortization(await this.#load(id), amount, mode); }
  async previewRevision(id, changes) { return revisionImpact(await this.#load(id), changes); }

  async byPerson() { return groupByPerson(await this.loans.list(), this.clock.today()); }
  async home() {
    const all = await this.loans.list(), t = this.clock.today();
    return { receivable: receivableThisMonth(all, t), openPrincipal: openPrincipal(all), overdue: all.filter((l) => l.remaining > 0 && l.nextDue < t) };
  }
}
