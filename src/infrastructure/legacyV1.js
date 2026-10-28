import { normalize } from '../domain/shared/text.js';
import { DEFAULT_INDICATORS } from '../domain/investment/indicators.js';

const IDX = { pre: 'fixed', cdi: 'cdi', ipca: 'ipca', selic: 'selic' }, RULE = { venc: 'maturity', diaria: 'daily', penal: 'penalty' };
const SYS = { none: 'none', price: 'price', sac: 'sac', unico: 'single' }, CAP = { simples: 'simple', composto: 'compound' };
const D = (v) => (v ? new Date(v) : null);
const demo = (o) => (o.demo ? { demo: true } : {});

/** Converte o JSON da versão 1 do app (nomes em português) para o modelo atual. Não altera o original. */
export function fromLegacyV1(raw) {
  if (!Array.isArray(raw?.inv) || !Array.isArray(raw?.loans)) throw new Error('Formato legado inválido');
  const institutions = (raw.insts ?? []).map((i) => ({ id: String(i.id), name: i.nome, cnpj: i.cnpj ?? '', note: i.obs ?? '', ...demo(i) }));
  const people = (raw.people ?? []).map((p) => ({ id: String(p.id), name: p.nome, nickname: p.apelido ?? '', note: p.obs ?? '', cpf: p.cpf ?? '', pix: p.pix ?? '', phone: p.tel ?? '', email: p.email ?? '', ...demo(p) }));
  /** Backups muito antigos guardavam só o nome; recria o cadastro como o app antigo fazia. */
  const ensure = (list, prefix, name, isDemo, extra) => {
    const hit = list.find((e) => normalize(e.name) === normalize(name));
    if (hit) return hit.id;
    const e = { id: `${prefix}-${list.length + 1}`, name: name.trim(), ...extra, ...(isDemo ? { demo: true } : {}) };
    list.push(e); return e.id;
  };

  const investments = raw.inv.map((x) => {
    const appliedOn = D(x.ini), maturity = D(x.fim);
    const term = x.prazo != null ? { termDays: x.prazo, termSource: x.prazoSrc === 'manual' || !appliedOn ? 'informed' : 'calculated' }
      : appliedOn && maturity ? { termDays: Math.round((maturity - appliedOn) / 864e5), termSource: 'calculated' } : { termDays: null, termSource: null };
    return {
      id: String(x.id), name: x.nome || `${x.tipo} ${x.banco}`,
      custodianId: x.bancoId ?? (x.banco ? ensure(institutions, 'inst', x.banco, x.demo, { cnpj: '', note: '' }) : null),
      issuerId: x.emissorId ?? (x.emissor ? ensure(institutions, 'inst', x.emissor, x.demo, { cnpj: '', note: '' }) : null),
      category: x.tipo, indexer: IDX[x.idx], rate: x.taxa, amount: x.v, appliedOn, maturity, ...term,
      graceDays: x.carencia || 0, redemptionRule: RULE[x.resg || 'venc'], penaltyNote: x.penal || '',
      redemptions: (x.res ?? []).map((r) => ({ id: String(r.id), date: D(r.d), mode: r.tipo === 'total' ? 'total' : 'partial', note: r.obs ?? '', principal: r.princ, gross: r.bruto,
        earnings: r.rend, iof: r.iof, ir: r.ir, net: r.liq, days: r.dd, real: !!r.real, grossEstimated: !!r.estB, iofInformed: !!r.iofInf, irInformed: !!r.irInf })),
      ...demo(x),
    };
  });

  const loans = raw.loans.map((l) => ({
    id: String(l.id), personId: l.pessoaId ?? ensure(people, 'pes', l.who, l.demo, { nickname: '', note: '', cpf: '', pix: '', phone: '', email: '' }),
    description: l.desc ?? '', principal: l.total, system: SYS[l.sys], monthlyRate: l.i ?? 0, balance: l.bal, remaining: l.n, nextDue: D(l.next),
    issuedOn: l.sys === 'unico' ? D(l.ini) : null, compounding: l.sys === 'unico' ? CAP[l.cap] ?? 'simple' : null, fine: l.multa ?? 0, lateRate: l.mora ?? 0,
    payments: (l.paid ?? []).map((p) => ({ number: p.k, due: D(p.due), principal: p.am, interest: p.j, payment: p.pm, balance: p.bal, paidOn: D(p.paidOn),
      charges: p.enc ? { days: p.enc.d, fine: p.enc.multa, interest: p.enc.mora, total: p.enc.total } : null })),
    events: (l.log ?? []).map((g) => ({ label: g.t, date: D(g.d), amount: g.v, savedInterest: g.eco ?? 0 })),
    plan: null, ...demo(l),
  }));

  return { investments, loans, people, institutions, indicators: { ...DEFAULT_INDICATORS, ...(raw.ind ?? {}) }, creditor: { name: raw.me ?? '', pix: raw.pix ?? '' } };
}
