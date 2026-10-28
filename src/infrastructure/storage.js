import { JsonRepository } from './jsonRepository.js';
import { mergeIndicators, DEFAULT_INDICATORS } from '../domain/investment/indicators.js';

export const KEYS = { investments: 'mp:investments', loans: 'mp:loans', people: 'mp:people', institutions: 'mp:institutions', settings: 'mp:settings', schema: 'mp:schema', legacy: 'mp:v1', preferences: 'mp:ui' };
export const DEFAULT_SETTINGS = { indicators: { ...DEFAULT_INDICATORS }, creditor: { name: '', pix: '' } };

export const createRepositories = (storage) => ({
  investments: new JsonRepository(storage, KEYS.investments), loans: new JsonRepository(storage, KEYS.loans),
  people: new JsonRepository(storage, KEYS.people), institutions: new JsonRepository(storage, KEYS.institutions),
});

/** Um único documento JSON (indicadores e dados do credor). */
export class DocumentStore {
  constructor(storage, key, defaults) { Object.assign(this, { storage, key, defaults }); }
  get() { try { return { ...structuredClone(this.defaults), ...JSON.parse(this.storage.getItem(this.key) ?? '{}') }; } catch { return structuredClone(this.defaults); } }
  set(patch) { this.storage.setItem(this.key, JSON.stringify({ ...this.get(), ...patch })); }
}

/** Portas de configuração usadas pelos serviços (indicators.get(), creditor.get()). */
export function settingsPorts(store) {
  return {
    indicators: { get: async () => store.get().indicators, set: async (patch) => store.set({ indicators: mergeIndicators(store.get().indicators, patch) }) },
    creditor: { get: async () => store.get().creditor, set: async (patch) => store.set({ creditor: { ...store.get().creditor, ...patch } }) },
  };
}
