import { isValidCnpj } from '../validators.js';
import { ValidationError } from './registry.js';
import { digits } from '../shared/text.js';
import { cnpjMask } from '../shared/masks.js';

const trim = (v) => String(v ?? '').trim();
export const institutionKind = {
  clean: (i) => ({ id: i.id, name: trim(i.name), cnpj: trim(i.cnpj), note: trim(i.note) }),
  validate(x, others) {
    if (!x.name) throw new ValidationError('Informe o nome da instituição');
    if (x.cnpj && !isValidCnpj(x.cnpj)) throw new ValidationError('CNPJ inválido. Confira ou deixe em branco');
    const dup = x.cnpj && others.find((o) => digits(o.cnpj) === digits(x.cnpj));
    if (dup) throw new ValidationError(`Esse CNPJ já está em ${dup.name}`);
  },
  distinguishes: (x) => !!(x.cnpj || x.note),
  distinguishMessage: 'Informe o CNPJ ou uma observação para diferenciar de outra instituição com o mesmo nome',
  tag: (x) => x.note || (x.cnpj ? `CNPJ ${cnpjMask(x.cnpj)}` : ''),
  searchFields: (x) => [],
};
