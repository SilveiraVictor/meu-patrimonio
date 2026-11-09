/**
 * Escolhe onde guardar os dados. Se o localStorage estiver bloqueado ou indisponível (modo privado restrito,
 * cookies desativados, página incorporada), cai para a memória: o app abre e funciona, mas nada é mantido
 * ao fechar a página (`persistent: false`). `candidate` devolve o armazenamento; ele pode lançar erro.
 */
export function safeStorage(candidate = () => globalThis.localStorage) {
  try {
    const s = candidate(), probe = '__mp_probe__';
    s.setItem(probe, '1'); s.removeItem(probe);
    return { storage: s, persistent: true };
  } catch {
    const m = new Map();
    return { storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }, persistent: false };
  }
}
