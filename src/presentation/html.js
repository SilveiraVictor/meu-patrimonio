const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);

/** Trecho de HTML já seguro. Tudo o que não é Raw é escapado ao entrar em um template. */
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));
const part = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : v == null || v === false ? '' : escape(v));

/** html`<b>${nomeDoUsuario}</b>`: escapa por padrão, o que evita XSS sem lembrar de chamar esc(). */
export const html = (strings, ...vals) => raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ''), ''));
