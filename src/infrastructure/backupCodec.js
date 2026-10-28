import { fromLegacyV1 } from './legacyV1.js';

export class BackupError extends Error {}
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const reviver = (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v);
const validDate = (d) => d instanceof Date && !Number.isNaN(+d);
const COLLECTIONS = ['investments', 'loans', 'people', 'institutions'];

function validate(data) {
  if (!COLLECTIONS.every((k) => Array.isArray(data[k]))) throw new BackupError('Arquivo de backup inválido');
  const people = new Set(data.people.map((p) => p.id)), insts = new Set(data.institutions.map((i) => i.id)), problems = [];
  data.loans.forEach((l) => { if (!people.has(l.personId)) problems.push(`empréstimo ${l.id}: pessoa inexistente`); if (!validDate(l.nextDue) || !Number.isFinite(l.balance) || !Number.isFinite(l.remaining)) problems.push(`empréstimo ${l.id}: dados incompletos`); });
  data.investments.forEach((i) => { if (!insts.has(i.custodianId) || (i.issuerId && !insts.has(i.issuerId))) problems.push(`título ${i.id}: instituição inexistente`); if (!validDate(i.maturity) || !Number.isFinite(i.amount)) problems.push(`título ${i.id}: dados incompletos`); });
  if (problems.length) throw new BackupError(`Backup com inconsistências: ${problems.slice(0, 3).join('; ')}`);
}

/** Backup versão 2 (modelo atual). Também lê a versão 1 do app antigo. */
export const backupCodec = {
  encode: (data, now = new Date()) => JSON.stringify({ version: 2, exportedAt: now.toISOString(), ...Object.fromEntries([...COLLECTIONS, 'indicators', 'creditor'].map((k) => [k, data[k]])) }, null, 1),
  decode(text) {
    let raw; try { raw = JSON.parse(text, reviver); } catch { throw new BackupError('Arquivo de backup inválido'); }
    let version, data;
    if (raw?.version === 2) { version = 2; data = raw; }
    else if (Array.isArray(raw?.inv) && Array.isArray(raw?.loans)) { version = 1; try { data = fromLegacyV1(raw); } catch { throw new BackupError('Arquivo de backup inválido'); } }
    else throw new BackupError('Arquivo de backup inválido');
    validate(data);
    return { version, data: { ...Object.fromEntries(COLLECTIONS.map((k) => [k, data[k]])), indicators: data.indicators, creditor: data.creditor ?? { name: '', pix: '' } } };
  },
};
