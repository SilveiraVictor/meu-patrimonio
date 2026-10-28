import { isoDate } from '../domain/shared/dates.js';
import { normalize } from '../domain/shared/text.js';
import { DEFAULT_INDICATORS } from '../domain/investment/indicators.js';

const COLLECTIONS = ['investments', 'loans', 'people', 'institutions'];

/** Exportar, importar, apagar exemplos e apagar tudo. `codec` e `settings` são portas. */
export class BackupService {
  constructor({ investments, loans, people, institutions, settings, codec, clock }) { Object.assign(this, { repos: { investments, loans, people, institutions }, settings, codec, clock }); }

  async export() {
    const data = {}; for (const k of COLLECTIONS) data[k] = await this.repos[k].list();
    data.indicators = await this.settings.indicators.get(); data.creditor = await this.settings.creditor.get();
    return { filename: `backup-meu-patrimonio-${isoDate(this.clock.today())}.json`, content: this.codec.encode(data, new Date()) };
  }
  /** Valida o arquivo e conta o conteúdo, sem aplicar nada (para pedir confirmação). */
  inspect(text) { const { version, data } = this.codec.decode(text); return { version, investments: data.investments.length, loans: data.loans.length, people: data.people.length, institutions: data.institutions.length }; }
  async import(text) {
    const { data } = this.codec.decode(text);
    for (const k of COLLECTIONS) await this.repos[k].replaceAll(data[k]);
    await this.settings.indicators.set(data.indicators); await this.settings.creditor.set(data.creditor);
  }

  async counts() { const c = {}; for (const k of COLLECTIONS) c[k] = (await this.repos[k].list()).length; return c; }
  async hasDemo() { for (const k of ['investments', 'loans']) if ((await this.repos[k].list()).some((x) => x.demo)) return true; return false; }
  /** Remove só os exemplos; pessoas e instituições de exemplo ficam se ainda estiverem em uso. */
  async clearDemo() {
    const inv = (await this.repos.investments.list()).filter((x) => !x.demo), loans = (await this.repos.loans.list()).filter((x) => !x.demo);
    const insts = (await this.repos.institutions.list()).filter((i) => !i.demo || inv.some((x) => x.custodianId === i.id || x.issuerId === i.id));
    const people = (await this.repos.people.list()).filter((p) => !p.demo || loans.some((l) => l.personId === p.id));
    await this.repos.investments.replaceAll(inv); await this.repos.loans.replaceAll(loans); await this.repos.institutions.replaceAll(insts); await this.repos.people.replaceAll(people);
  }
  /** Exige a palavra APAGAR. Mantém as preferências de aparência e não recria os exemplos. */
  async wipe(confirmation) {
    if (normalize(confirmation) !== 'apagar') throw new Error('Digite APAGAR para confirmar');
    for (const k of COLLECTIONS) await this.repos[k].clear();
    await this.settings.indicators.set({ ...DEFAULT_INDICATORS }); await this.settings.creditor.set({ name: '', pix: '' });
  }
}
