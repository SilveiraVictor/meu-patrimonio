import test from 'node:test';
import assert from 'node:assert/strict';
import { register, displayName, search, HomonymError, ValidationError } from '../src/domain/registry/registry.js';
import { personKind } from '../src/domain/registry/person.js';
import { institutionKind } from '../src/domain/registry/institution.js';
import { niceName } from '../src/domain/shared/text.js';
import { cpfMask, cnpjMask, cpfFormat, phoneFormat } from '../src/domain/shared/masks.js';
import { personService, institutionService } from '../src/application/registryService.js';
import { JsonRepository } from '../src/infrastructure/jsonRepository.js';

const CPF = '529.982.247-25', CNPJ = '11.222.333/0001-81';
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('nomes e máscaras', () => {
  assert.equal(niceName('maria da silva e souza'), 'Maria da Silva e Souza'); assert.equal(niceName('McDonald'), 'McDonald');
  assert.equal(cpfMask(CPF), '***.982.247-**'); assert.equal(cnpjMask(CNPJ), '**.222.333/****-**');
  assert.equal(cpfFormat('52998224725'), CPF); assert.equal(phoneFormat('77999990001'), '(77) 99999-0001');
});
test('pessoa: validações de nome, CPF, e-mail e CPF único', () => {
  const ana = register(personKind, { name: 'ana lima', cpf: CPF }, []);
  assert.equal(ana.name, 'Ana Lima');
  assert.throws(() => register(personKind, { name: ' ' }, []), ValidationError);
  assert.throws(() => register(personKind, { name: 'X', cpf: '111.111.111-11' }, []), /CPF inválido/);
  assert.throws(() => register(personKind, { name: 'X', email: 'a@b' }, []), /E-mail/);
  assert.throws(() => register(personKind, { name: 'Bia', cpf: CPF }, [{ ...ana, id: '1' }]), /já está em Ana Lima/);
});
test('homônimos: pergunta, exige diferenciador e monta o nome de exibição', () => {
  const a = { ...register(personKind, { name: 'João Pereira' }, []), id: '1' };
  try { register(personKind, { name: 'joao pereira' }, [a]); assert.fail(); } catch (e) { assert.ok(e instanceof HomonymError); assert.equal(e.matches[0].id, '1'); }
  assert.throws(() => register(personKind, { name: 'João Pereira' }, [a], { confirmDistinct: true }), /apelido ou uma observação/);
  const b = { ...register(personKind, { name: 'João Pereira', nickname: 'Jão' }, [a], { confirmDistinct: true }), id: '2' };
  assert.equal(displayName(personKind, b, [a, b]), 'João Pereira (“Jão”)');
  assert.equal(displayName(personKind, { ...b, nickname: '', phone: '(77) 99999-0001' }, [a, b]), 'João Pereira (final 0001)');
  assert.equal(displayName(personKind, a, [a]), 'João Pereira');
  assert.deepEqual(search(personKind, [a, b], 'jão').map((x) => x.id), ['2']);
  assert.equal(search(personKind, [a, b], 'joao').length, 2);
});
test('instituição: CNPJ válido e único; diferenciador por CNPJ ou observação', () => {
  const x = { ...register(institutionKind, { name: 'Banco Azul', cnpj: CNPJ }, []), id: '1' };
  assert.throws(() => register(institutionKind, { name: 'Outro', cnpj: '11.222.333/0001-82' }, []), /CNPJ inválido/);
  assert.throws(() => register(institutionKind, { name: 'Outro', cnpj: CNPJ }, [x]), /já está em Banco Azul/);
  assert.throws(() => register(institutionKind, { name: 'banco azul' }, [x]), (e) => e instanceof HomonymError);
  const y = { ...register(institutionKind, { name: 'Banco Azul', note: 'agência X' }, [x], { confirmDistinct: true }), id: '2' };
  assert.equal(displayName(institutionKind, y, [x, y]), 'Banco Azul (agência X)');
  assert.equal(displayName(institutionKind, x, [x, y]), 'Banco Azul (CNPJ **.222.333/****-**)');
});
test('serviços: criar, renomear, buscar e bloquear exclusão em uso', async () => {
  let n = 0, uses = 0;
  const svc = personService({ repo: new JsonRepository(mem(), 'p'), usageCount: async () => uses, newId: () => 'p' + ++n });
  const p = await svc.create({ name: 'carlos menezes', nickname: 'Carlão' });
  assert.equal(p.id, 'p1'); assert.equal((await svc.update('p1', { name: 'Carlos M. Menezes' })).name, 'Carlos M. Menezes');
  assert.equal((await svc.search('menezes')).length, 1); assert.equal(await svc.nameOf('p1'), 'Carlos M. Menezes');
  await assert.rejects(svc.create({ name: 'Carlos M. Menezes' }), (e) => e instanceof HomonymError);
  uses = 2; await assert.rejects(svc.remove('p1'), /Em uso por 2 empréstimos/);
  uses = 0; await svc.remove('p1');
  const inst = institutionService({ repo: new JsonRepository(mem(), 'i'), usageCount: async () => 1 });
  const i = await inst.create({ name: 'Banco Beta' }); await assert.rejects(inst.remove(i.id), /Em uso por 1 título\./);
});
