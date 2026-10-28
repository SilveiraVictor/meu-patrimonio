import { activeInvestments, upcomingEvents } from '../domain/investment/portfolio.js';
import { investmentStatus } from '../domain/investment/investment.js';
import { remainingPrincipal } from '../domain/investment/yield.js';
import { receivableThisMonth, openPrincipal } from '../domain/loan/portfolio.js';
import { personKind } from '../domain/registry/person.js';
import { displayName } from '../domain/registry/registry.js';
import { diffDays } from '../domain/shared/dates.js';
import { firstName } from '../domain/shared/text.js';

/** Dados da tela inicial. Só números e objetos de domínio; a formatação fica na apresentação. */
export class HomeService {
  constructor({ investments, loans, people, clock }) { Object.assign(this, { investments, loans, people, clock }); }

  async overview() {
    const today = this.clock.today(), [invs, loans, people] = await Promise.all([this.investments.list(), this.loans.list(), this.people.list()]);
    const personOf = (id) => people.find((p) => p.id === id), invOf = (id) => invs.find((i) => i.id === id);
    const first = activeInvestments(invs)[0];
    const upcoming = upcomingEvents(invs, loans, today, 6).map((e) => {
      const days = diffDays(today, e.date);
      if (e.kind === 'investment') { const i = invOf(e.id); return { ...e, days, title: i.name, initial: 'T', status: investmentStatus(i, today) }; }
      const p = personOf(loans.find((l) => l.id === e.id).personId);
      return { ...e, days, title: `${e.single ? 'Devolução de' : 'Parcela de'} ${firstName(p.name)}`, initial: p.name[0] };
    });
    return {
      hasDemo: [...invs, ...loans].some((x) => x.demo),
      highlight: first ? { id: first.id, name: first.name, maturity: first.maturity, amount: remainingPrincipal(first), days: diffDays(today, first.maturity), status: investmentStatus(first, today) } : null,
      overdueLoans: loans.filter((l) => l.remaining > 0 && l.nextDue < today).map((l) => ({ id: l.id, person: firstName(personOf(l.personId).name), displayName: displayName(personKind, personOf(l.personId), people) })),
      receivable: receivableThisMonth(loans, today), openPrincipal: openPrincipal(loans), upcoming,
    };
  }
}
