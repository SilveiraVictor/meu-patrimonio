import { normalize } from '../shared/text.js';

export class ValidationError extends Error {}
/** Já existe cadastro com o mesmo nome: a tela pergunta "É a mesma?". */
export class HomonymError extends Error { constructor(matches) { super('Já existe um cadastro com este nome'); this.matches = matches; } }

const sameName = (a, b) => normalize(a.name) === normalize(b.name);

/**
 * `kind` descreve um tipo de cadastro (pessoa, instituição): clean, validate, distinguishes,
 * distinguishMessage, tag, searchFields. Novos cadastros entram sem alterar este módulo (OCP).
 */
export function register(kind, input, existing, { selfId = null, confirmDistinct = false } = {}) {
  const entity = kind.clean(input), others = existing.filter((x) => x.id !== selfId);
  kind.validate(entity, others);
  const homonyms = others.filter((x) => sameName(x, entity));
  if (homonyms.length) {
    if (!confirmDistinct) throw new HomonymError(homonyms);
    if (!kind.distinguishes(entity)) throw new ValidationError(kind.distinguishMessage);
  }
  return entity;
}

/** Nome de exibição: só acrescenta a marca quando há homônimos. */
export function displayName(kind, entity, all) {
  const tag = kind.tag(entity);
  return tag && all.filter((x) => sameName(x, entity)).length > 1 ? `${entity.name} (${tag})` : entity.name;
}

export function search(kind, all, query, limit = 6) {
  const q = normalize(query);
  return all.filter((x) => !q || [x.name, ...kind.searchFields(x)].some((f) => normalize(f).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.nickname ?? '').localeCompare(b.nickname ?? '')).slice(0, limit);
}
