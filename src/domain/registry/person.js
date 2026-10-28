import { isValidCpf } from '../validators.js';
import { ValidationError } from './registry.js';
import { digits, niceName } from '../shared/text.js';

const trim = (v) => String(v ?? '').trim();
export const personKind = {
  clean: (i) => ({ id: i.id, name: niceName(trim(i.name)), nickname: trim(i.nickname), note: trim(i.note), cpf: trim(i.cpf), pix: trim(i.pix), phone: trim(i.phone), email: trim(i.email) }),
  validate(p, others) {
    if (!p.name) throw new ValidationError('Informe o nome da pessoa');
    if (p.cpf && !isValidCpf(p.cpf)) throw new ValidationError('CPF inválido. Confira ou deixe em branco');
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw new ValidationError('E-mail inválido. Confira ou deixe em branco');
    const dup = p.cpf && others.find((o) => digits(o.cpf) === digits(p.cpf));
    if (dup) throw new ValidationError(`Esse CPF já está em ${dup.name}`);
  },
  distinguishes: (p) => !!(p.nickname || p.note),
  distinguishMessage: 'Informe um apelido ou uma observação para diferenciar de quem tem o mesmo nome',
  tag: (p) => p.nickname ? `“${p.nickname}”` : p.phone ? `final ${digits(p.phone).slice(-4)}` : p.note,
  searchFields: (p) => [p.nickname, p.note],
};
