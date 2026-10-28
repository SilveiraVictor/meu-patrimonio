import { register, displayName, search } from '../domain/registry/registry.js';
import { personKind } from '../domain/registry/person.js';
import { institutionKind } from '../domain/registry/institution.js';

/** Casos de uso comuns a pessoas e instituições. `usageCount(id)` vem da infraestrutura. */
export class RegistryService {
  constructor({ repo, kind, usageCount, newId = () => globalThis.crypto.randomUUID(), subject }) { Object.assign(this, { repo, kind, usageCount, newId, subject }); }
  async create(input, opts) { const e = register(this.kind, input, await this.repo.list(), opts); const saved = { ...e, id: this.newId() }; await this.repo.save(saved); return saved; }
  async update(id, input, opts) { const e = register(this.kind, { ...input, id }, await this.repo.list(), { ...opts, selfId: id }); await this.repo.save(e); return e; }
  async remove(id) { const n = await this.usageCount(id); if (n) throw new Error(`Em uso por ${n} ${this.subject}${n > 1 ? 's' : ''}. Troque antes de excluir`); return this.repo.remove(id); }
  async search(query, limit) { return search(this.kind, await this.repo.list(), query, limit); }
  async searchWithUsage(query, limit) { return Promise.all((await this.search(query, limit)).map(async (entity) => ({ entity, uses: await this.usageCount(entity.id) }))); }
  async get(id) { return this.repo.get(id); }
  async nameOf(id) { const all = await this.repo.list(), e = all.find((x) => x.id === id); return e ? displayName(this.kind, e, all) : ''; }
}
export const personService = (deps) => new RegistryService({ ...deps, kind: personKind, subject: 'empréstimo' });
export const institutionService = (deps) => new RegistryService({ ...deps, kind: institutionKind, subject: 'título' });
