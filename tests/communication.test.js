import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoan } from '../src/domain/loan/factory.js';
import { payNext } from '../src/domain/loan/loan.js';
import { anticipate } from '../src/domain/loan/prepayment.js';
import { MessageService } from '../src/application/messageService.js';
import { whatsappUrl, mailtoUrl } from '../src/domain/communication/channels.js';
import { JsonRepository } from '../src/infrastructure/jsonRepository.js';

const d = (s) => new Date(s + 'T00:00:00'), today = d('2026-03-15');
const fmt = { money: (v) => 'R$' + v.toFixed(2), date: (x) => x.toISOString().slice(0, 10), longDate: (x) => x.toISOString().slice(0, 10) };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const loan = (o = {}) => createLoan({ id: 'l1', personId: 'p1', principal: 1200, system: 'none', installments: 4, firstDue: d('2026-03-01'), description: 'Caixa de som', fine: 2, lateRate: 1, ...o });

async function setup(loans, creditor = { name: 'Eu', pix: 'eu@pix.com' }) {
  const lr = new JsonRepository(mem(), 'l'), pr = new JsonRepository(mem(), 'p');
  for (const l of loans) await lr.save(l);
  await pr.save({ id: 'p1', name: 'Carlos Menezes', cpf: '529.982.247-25', phone: '(77) 99999-0001', email: 'c@x.com' });
  return new MessageService({ loans: lr, people: pr, creditor: { get: async () => creditor }, clock: { today: () => today }, fmt });
}

test('cobrança por empréstimo: parcela atrasada com encargos, total e Pix', async () => {
  const { text } = await (await setup([loan()])).compose({ scope: 'loan', id: 'l1', kind: 'collection' });
  assert.match(text, /^Olá, Carlos! Tudo bem\?/);
  assert.match(text, /• Parcela 1\/4: R\$300\.00, vencimento 2026-03-01 \(atrasada há 14 dias; multa moratória R\$6\.00 \+ juros de mora R\$1\.40 = \*R\$307\.40\*\)/);
  assert.match(text, /\*Total a pagar: R\$307\.40\*/); assert.match(text, /Pix: eu@pix\.com/); assert.match(text, /Caixa de som/);
});
test('cobrança sem atraso lista só a próxima e não mostra total', async () => {
  const { text } = await (await setup([loan({ firstDue: d('2026-03-20') })])).compose({ scope: 'loan', id: 'l1', kind: 'collection' });
  assert.match(text, /vence em 5 dias/); assert.doesNotMatch(text, /Total a pagar/);
});
test('quitado: sem cobrança; sem pagamento: sem recibo', async () => {
  let l = loan({ installments: 1 }); l = payNext(l, today);
  const svc = await setup([l]);
  assert.equal((await svc.compose({ scope: 'loan', id: 'l1', kind: 'collection' })).empty, 'Este empréstimo já está quitado. Não há cobrança pendente.');
  const none = await (await setup([loan()])).compose({ scope: 'loan', id: 'l1', kind: 'receipt' });
  assert.equal(none.empty, 'Nenhum pagamento registrado ainda.');
});
test('recibo de parcela paga em atraso e de antecipação', async () => {
  const paid = payNext(loan(), today), svc = await setup([paid]);
  const { text } = await svc.compose({ scope: 'loan', id: 'l1', kind: 'receipt' });
  assert.match(text, /Recebi de Carlos Menezes a quantia de R\$307\.40, referente a parcela 1 de 4/);
  assert.match(text, /Multa moratória: R\$6\.00/); assert.match(text, /Saldo devedor após o pagamento: R\$900\.00/);
  const ant = await (await setup([anticipate(loan({ firstDue: d('2026-04-01') }), 1, today)])).compose({ scope: 'loan', id: 'l1', kind: 'receipt' });
  assert.match(ant.text, /referente a antecipou 1 parcela|referente a antecipou/);
});
test('situação por empréstimo e por pessoa', async () => {
  const a = loan(), b = loan({ id: 'l2', description: '', system: 'single', issuedOn: d('2026-03-01'), firstDue: d('2026-03-25'), principal: 500, installments: 1 });
  const svc = await setup([a, b]);
  const one = (await svc.compose({ scope: 'loan', id: 'l1', kind: 'status' })).text;
  assert.match(one, /• Valor emprestado: R\$1200\.00/); assert.match(one, /• Parcelas pagas: 0 de 4/); assert.doesNotMatch(one, /com juros/);
  const all = (await svc.compose({ scope: 'person', id: 'p1', kind: 'status' })).text;
  assert.match(all, /\*Situação dos empréstimos\*/); assert.match(all, /• Pagamento único de 2026-03-25: falta R\$500\.00/); assert.match(all, /Em atraso: R\$/);
  const col = (await svc.compose({ scope: 'person', id: 'p1', kind: 'collection' })).text;
  assert.match(col, /\*Caixa de som\*/); assert.match(col, /\*Total a pagar:/);
  await assert.rejects(svc.compose({ scope: 'person', id: 'p1', kind: 'receipt' }), /só por empréstimo/);
});
test('documento: cobrança, recibo e situação', async () => {
  const svc = await setup([payNext(loan(), today)]);
  const cob = (await svc.compose({ scope: 'loan', id: 'l1', kind: 'collection', format: 'document' })).document;
  assert.equal(cob.title, 'Aviso de cobrança'); assert.ok(cob.rows.some(([a, b]) => a === 'CPF do devedor' && b === '***.982.247-**'));
  assert.deepEqual(cob.table.body[0], ['2', '2026-04-01', 'R$300.00', 'A vencer']);
  const rec = (await svc.compose({ scope: 'loan', id: 'l1', kind: 'receipt', format: 'document' })).document;
  assert.ok(rec.sign); assert.match(rec.note, /^Recebi de Carlos/);
  const st = (await svc.compose({ scope: 'loan', id: 'l1', kind: 'status', format: 'document' })).document;
  assert.equal(st.hero.label, 'Valor a pagar'); assert.equal(st.table.body[0][3], 'Paga'); assert.equal(st.table.body.length, 4);
});
test('canais: WhatsApp com prefixo 55 e e-mail sem asteriscos', () => {
  assert.equal(whatsappUrl('(77) 99999-0001', 'oi'), 'https://wa.me/5577999990001?text=oi');
  assert.equal(whatsappUrl('', 'oi'), 'https://wa.me/?text=oi');
  const u = mailtoUrl('a@b.com', 'collection', '*Total*\nok');
  assert.match(u, /^mailto:a@b\.com\?subject=Lembrete%20de%20pagamento&body=Total%0D%0Aok$/);
});
