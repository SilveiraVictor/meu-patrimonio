import { KEYS, createRepositories, DocumentStore, DEFAULT_SETTINGS } from './storage.js';
import { fromLegacyV1 } from './legacyV1.js';

/**
 * Primeira execução: migra o armazenamento da versão 1 (mantendo o original intacto) ou grava os
 * dados de exemplo. Retorna 'ready' | 'migrated' | 'seeded' | 'failed'. Em 'failed' nada é sobrescrito.
 */
export async function initStorage({ storage, seed }) {
  if (storage.getItem(KEYS.schema) === '2') return 'ready';
  let data, origin;
  const legacy = storage.getItem(KEYS.legacy);
  if (legacy) { try { data = fromLegacyV1(JSON.parse(legacy, (_k, v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) ? new Date(v) : v))); origin = 'migrated'; } catch { return 'failed'; } }
  else { data = seed(); origin = 'seeded'; }
  const repos = createRepositories(storage);
  await Promise.all(['investments', 'loans', 'people', 'institutions'].map((k) => repos[k].replaceAll(data[k])));
  new DocumentStore(storage, KEYS.settings, DEFAULT_SETTINGS).set({ indicators: data.indicators, creditor: data.creditor });
  storage.setItem(KEYS.schema, '2');
  return origin;
}
