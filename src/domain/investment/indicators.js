export const DEFAULT_INDICATORS = Object.freeze({ cdi: 13.9, selic: 14, ipca: 4.22 });
/** Atualiza só os indicadores informados; valores negativos ou não numéricos são recusados. */
export function mergeIndicators(current, patch) {
  const next = { ...current };
  for (const k of ['cdi', 'selic', 'ipca']) {
    if (patch[k] === undefined) continue;
    const v = Number(patch[k]);
    if (!(v >= 0)) throw new RangeError(`Indicador inválido: ${k}`);
    next[k] = v;
  }
  return next;
}
