const TEXT = { normal: { scale: 1, code: 'n' }, large: { scale: 1.15, code: 'l' }, xlarge: { scale: 1.3, code: 'x' } };
const THEMES = ['auto', 'light', 'dark'];
export const DEFAULT_PREFERENCES = Object.freeze({ theme: 'auto', textSize: 'normal', highContrast: false, reducedMotion: false });

export const textScale = (p) => TEXT[p.textSize].scale;
/** Cor da barra de status do PWA: acompanha o tema escolhido (ou o do aparelho em "auto"). */
export const themeColor = (p, systemDark) => (p.theme === 'dark' || (p.theme === 'auto' && systemDark) ? '#0A1020' : '#F4F6FB');

/** Preferências de aparência: ficam em chave própria e sobrevivem a "Apagar todos os dados". */
export class PreferencesService {
  constructor(storage, key = 'mp:ui') { this.storage = storage; this.key = key; }
  get() {
    let raw = {}; try { raw = JSON.parse(this.storage.getItem(this.key) ?? '{}'); } catch { /* usa padrões */ }
    const size = Object.entries(TEXT).find(([, v]) => v.code === raw.fs)?.[0];
    return { theme: THEMES.includes(raw.theme) ? raw.theme : 'auto', textSize: size ?? 'normal', highContrast: !!raw.hc, reducedMotion: !!raw.rm };
  }
  update(patch) {
    const next = { ...this.get(), ...patch };
    if (!THEMES.includes(next.theme)) throw new RangeError('Tema inválido');
    if (!(next.textSize in TEXT)) throw new RangeError('Tamanho de texto inválido');
    this.storage.setItem(this.key, JSON.stringify({ theme: next.theme, fs: TEXT[next.textSize].code, hc: !!next.highContrast, rm: !!next.reducedMotion }));
    return next;
  }
  reset() { return this.update(DEFAULT_PREFERENCES); }
}
