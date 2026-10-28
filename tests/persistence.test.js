import test from 'node:test';
import assert from 'node:assert/strict';
import { fromLegacyV1 } from '../src/infrastructure/legacyV1.js';
import { backupCodec, BackupError } from '../src/infrastructure/backupCodec.js';
import { initStorage } from '../src/infrastructure/bootstrap.js';
import { KEYS } from '../src/infrastructure/storage.js';
import { demoData } from '../src/application/demoData.js';
import { PreferencesService, themeColor, textScale } from '../src/application/preferences.js';
import { createApp } from '../src/main.js';
import { scheduleOf, figuresOf } from '../src/domain/loan/loan.js';
import { projectToMaturity } from '../src/domain/investment/yield.js';
import { mergeIndicators } from '../src/domain/investment/indicators.js';

const d = (s) => new Date(s + 'T00:00:00'), today = d('2026-10-24'), clock = { today: () => today };
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

// Backup real da versão 1: datas em ISO, nomes em português, ids numéricos.
const legacy = () => ({ v: 1, ind: { cdi: 12, selic: 13, ipca: 4 }, me: 'Eu', pix: 'eu@pix',
  insts: [{ id: 'i1', nome: 'Banco Azul', cnpj: '', obs: '' }],
  people: [{ id: 'p1', nome: 'Carlos Menezes', apelido: 'Carlão', obs: '', cpf: '', pix: '', tel: '(77) 99999-0001', email: '' }],
  inv: [
    { id: 0.5, nome: 'CDB Azul', banco: 'Banco Azul', emissor: 'Banco Azul', bancoId: 'i1', emissorId: 'i1', tipo: 'CDB', idx: 'cdi', taxa: 110, v: 4000, ini: '2026-01-01T03:00:00.000Z', fim: '2026-05-01T03:00:00.000Z', resg: 'diaria', carencia: 30,
      res: [{ id: 'r1', d: '2026-05-01T03:00:00.000Z', tipo: 'parcial', princ: 2000, bruto: 2100, rend: 100, iof: 0, ir: 15, liq: 2085, dd: 120, real: true, estB: false, iofInf: false, irInf: true, obs: 'parte' }] },
    { id: 2, tipo: 'LCA', banco: 'Banco Novo', emissor: 'Banco Novo', idx: 'pre', taxa: 11, v: 1000, ini: null, fim: '2027-01-01T03:00:00.000Z', prazo: 200, prazoSrc: 'manual', resg: 'venc' }],
  loans: [
    { id: 0.7, who: 'Carlos Menezes', pessoaId: 'p1', total: 6000, i: 0.015, sys: 'price', bal: 4000, n: 7, next: '2026-11-10T03:00:00.000Z', desc: 'Som', multa: 2, mora: 1,
      paid: [{ due: '2026-08-10T03:00:00.000Z', am: 500, j: 90, pm: 590, bal: 5500, k: 1, paidOn: '2026-08-12T03:00:00.000Z', enc: { d: 2, multa: 11.8, mora: 0.4, total: 12.2 } }], log: [{ t: 'Antecipou 1 parcela', d: '2026-09-01T03:00:00.000Z', v: 500, eco: 20 }] },
    { id: 3, who: 'Rafael Lima', total: 800, i: 0.03, sys: 'unico', bal: 800, n: 1, next: '2026-11-05T03:00:00.000Z', ini: '2026-10-01T03:00:00.000Z', cap: 'composto', paid: [], log: [], demo: 1 }] });

test('migração v1: renomeia campos, converte enums e recria cadastros que só tinham nome', () => {
  const m = fromLegacyV1(legacy());
  const [a, b] = m.investments; assert.equal(a.id, '0.5'); assert.equal(a.indexer, 'cdi'); assert.equal(a.redemptionRule, 'daily'); assert.equal(a.graceDays, 30);
  assert.equal(a.termDays, 120); assert.equal(a.termSource, 'calculated'); assert.equal(b.termSource, 'informed'); assert.equal(b.indexer, 'fixed');
  const r = a.redemptions[0]; assert.deepEqual([r.mode, r.net, r.irInformed, r.note, r.date instanceof Date], ['partial', 2085, true, 'parte', true]);
  assert.equal(b.custodianId, 'inst-2'); assert.ok(m.institutions.some((i) => i.id === 'inst-2' && i.name === 'Banco Novo'));
  const [l, u] = m.loans; assert.equal(l.system, 'price'); assert.equal(l.payments[0].charges.days, 2); assert.equal(l.payments[0].number, 1);
  assert.deepEqual([l.events[0].label, l.events[0].savedInterest], ['Antecipou 1 parcela', 20]);
  assert.equal(u.system, 'single'); assert.equal(u.compounding, 'compound'); assert.equal(u.demo, true); assert.equal(u.personId, 'pes-2');
  assert.deepEqual(m.people[1], { id: 'pes-2', name: 'Rafael Lima', nickname: '', note: '', cpf: '', pix: '', phone: '', email: '', demo: true });
  assert.deepEqual(m.indicators, { cdi: 12, selic: 13, ipca: 4 }); assert.deepEqual(m.creditor, { name: 'Eu', pix: 'eu@pix' });
  assert.equal(scheduleOf(l).length, 7); assert.ok(figuresOf(l, today).paid > 590); assert.ok(projectToMaturity(a, m.indicators));
  assert.throws(() => fromLegacyV1({}), /legado/);
});
test('codec: v2 preserva datas; lê v1; recusa lixo e referências quebradas', () => {
  const data = fromLegacyV1(legacy()), txt = backupCodec.encode(data, today), back = backupCodec.decode(txt);
  assert.equal(back.version, 2); assert.ok(back.data.loans[0].nextDue instanceof Date); assert.equal(+back.data.loans[0].nextDue, +data.loans[0].nextDue);
  assert.equal(backupCodec.decode(JSON.stringify(legacy())).version, 1);
  assert.throws(() => backupCodec.decode('não é json'), BackupError); assert.throws(() => backupCodec.decode('{"a":1}'), BackupError);
  const broken = JSON.parse(txt); broken.loans[0].personId = 'fantasma';
  assert.throws(() => backupCodec.decode(JSON.stringify(broken)), /pessoa inexistente/);
});
test('bootstrap: semeia exemplos uma vez, migra v1 sem tocar no original, não sobrescreve legado ilegível', async () => {
  const s = mem(); assert.equal(await initStorage({ storage: s, seed: () => demoData(today) }), 'seeded'); assert.equal(s.m.get(KEYS.schema), '2');
  assert.equal(await initStorage({ storage: s, seed: () => assert.fail() }), 'ready');
  const raw = JSON.stringify(legacy()), s2 = mem({ [KEYS.legacy]: raw });
  assert.equal(await initStorage({ storage: s2, seed: () => assert.fail() }), 'migrated'); assert.equal(s2.m.get(KEYS.legacy), raw);
  assert.equal(JSON.parse(s2.m.get(KEYS.loans)).length, 2);
  const s3 = mem({ [KEYS.legacy]: '{quebrado' }); assert.equal(await initStorage({ storage: s3, seed: () => assert.fail() }), 'failed'); assert.equal(s3.m.get(KEYS.schema), undefined);
});
test('dados de exemplo: 7 títulos, 4 empréstimos, um título já resgatado', () => {
  const x = demoData(today);
  assert.deepEqual([x.investments.length, x.loans.length, x.people.length, x.institutions.length], [7, 4, 4, 8]);
  assert.ok(x.investments.every((i) => i.demo) && x.loans.every((l) => l.demo));
  assert.equal(x.investments[5].redemptions.length, 1); assert.equal(x.investments[4].termDays, null); assert.equal(x.investments[3].termSource, 'informed');
  assert.deepEqual(x.loans.map((l) => l.payments.length), [3, 2, 0, 0]);
});
test('preferências: formato antigo, validação, tema da barra e escala', () => {
  const s = mem({ 'mp:ui': JSON.stringify({ theme: 'dark', fs: 'x', hc: true, rm: false }) }), p = new PreferencesService(s);
  assert.deepEqual(p.get(), { theme: 'dark', textSize: 'xlarge', highContrast: true, reducedMotion: false });
  p.update({ textSize: 'large' }); assert.equal(JSON.parse(s.m.get('mp:ui')).fs, 'l'); assert.equal(textScale(p.get()), 1.15);
  assert.throws(() => p.update({ theme: 'roxo' }), RangeError); assert.equal(p.reset().theme, 'auto');
  assert.equal(themeColor({ theme: 'auto' }, true), '#0A1020'); assert.equal(themeColor({ theme: 'light' }, true), '#F4F6FB'); assert.equal(themeColor({ theme: 'dark' }, false), '#0A1020');
  assert.equal(new PreferencesService(mem({ 'mp:ui': '{lixo' })).get().theme, 'auto');
  assert.throws(() => mergeIndicators({ cdi: 1 }, { cdi: -1 }), RangeError); assert.equal(mergeIndicators({ cdi: 1, selic: 2 }, { selic: '15' }).selic, 15);
});
test('app completo: exemplos, serviços integrados, exportar/importar, apagar exemplos e tudo', async () => {
  const storage = mem(); let n = 0; const app = await createApp({ storage, clock, newId: () => 'n' + ++n });
  assert.equal(app.boot, 'seeded'); assert.equal((await app.investments.totals()).count, 6); assert.equal((await app.loans.byPerson()).length, 4);
  assert.equal((await app.investments.upcoming(6)).length, 6); assert.equal((await app.backup.hasDemo()), true);
  assert.match((await app.messages.compose({ scope: 'loan', id: 'demo-loan-3', kind: 'collection' })).text, /Reforma da cozinha/);
  await assert.rejects(app.people.remove('demo-pes-1'), /Em uso por 1 empréstimo/);
  await app.settings.creditor.set({ name: 'Eu' }); await app.settings.indicators.set({ cdi: 10 });
  const mine = await app.people.create({ name: 'Ana Lima' }); await app.loans.create({ personId: mine.id, principal: 100, system: 'none', installments: 2, firstDue: d('2026-11-01') });
  const file = await app.backup.export(); assert.equal(file.filename, 'backup-meu-patrimonio-2026-10-24.json');
  const info = app.backup.inspect(file.content); assert.deepEqual([info.version, info.loans, info.investments], [2, 5, 7]);
  await app.backup.clearDemo(); assert.equal(await app.backup.hasDemo(), false);
  assert.deepEqual([(await app.loans.byPerson()).length, (await app.people.search('')).length, (await app.institutions.search('')).length], [1, 1, 0]);
  await app.backup.import(file.content); assert.equal((await app.investments.totals()).count, 6); assert.equal((await app.settings.creditor.get()).name, 'Eu');
  app.preferences.update({ theme: 'dark' });
  await assert.rejects(app.backup.wipe('qualquer'), /APAGAR/); await app.backup.wipe('apagar');
  assert.equal((await app.investments.totals()).count, 0); assert.equal((await app.settings.indicators.get()).cdi, 13.9); assert.equal(app.preferences.get().theme, 'dark');
  assert.equal((await createApp({ storage, clock })).boot, 'ready'); assert.equal((await app.loans.byPerson()).length, 0);
});
