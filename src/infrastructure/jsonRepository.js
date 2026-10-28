const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const reviver = (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v);

/** Repository genérico sobre um Storage (localStorage, memória em testes etc.). */
export class JsonRepository {
  constructor(storage, key) { this.storage = storage; this.key = key; }
  #read() { try { return JSON.parse(this.storage.getItem(this.key) ?? '[]', reviver); } catch { return []; } }
  #write(items) { this.storage.setItem(this.key, JSON.stringify(items)); }
  async list() { return this.#read(); }
  async get(id) { return this.#read().find((x) => x.id === id) ?? null; }
  async save(entity) { const all = this.#read().filter((x) => x.id !== entity.id); this.#write([...all, entity]); }
  async replaceAll(items) { this.#write(items); }
  async clear() { this.#write([]); }
  async remove(id) { this.#write(this.#read().filter((x) => x.id !== id)); }
}
