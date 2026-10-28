import { html, raw } from './html.js';
import { TABS } from './navigation.js';

const ICONS = { home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>', inv: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', loans: '<path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', cfg: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>' };
export const icon = (n) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`);

/** Eventos por delegação: data-action/data-arg/data-arg2, tratados pelo controlador. Sem funções globais. */
export const act = (a = {}) => raw((a.action ? ` data-action="${html`${a.action}`}"` : '') + (a.arg != null ? ` data-arg="${html`${a.arg}`}"` : '') + (a.arg2 != null ? ` data-arg2="${html`${a.arg2}`}"` : ''));

export const chip = (label, tone = '') => html`<span class="chip ${tone}">${label}</span>`;
export const ico = (text, tone = '') => html`<div class="ico ${tone}">${text}</div>`;
export const card = (body, { cls = '', ...a } = {}) => a.action ? html`<button class="card tap ${cls}"${act(a)}>${body}</button>` : html`<div class="card ${cls}">${body}</div>`;
export const alert = (body, { tone = '', col = false } = {}) => html`<div class="alert ${tone} ${col ? 'col' : ''}">${col ? body : html`<span>${body}</span>`}</div>`;
export const button = (label, { variant = '', disabled = false, style = '', id, ...a } = {}) => html`<button class="btn ${variant}"${id ? raw(` id="${id}"`) : ''}${act(a)}${disabled ? raw(' disabled') : ''}${style ? raw(` style="${html`${style}`}"`) : ''}>${label}</button>`;
export const kv = (pairs) => html`<div class="card kv">${pairs.map(([a, b]) => html`<div><span>${a}</span><b>${b}</b></div>`)}</div>`;
export const preview = (pairs) => html`<div class="pv">${pairs.map(([a, b]) => html`<div><span>${a}</span><b>${b}</b></div>`)}</div>`;
export const bar = (percent, { attention = false, label = '' } = {}) => html`<div class="bar ${attention ? 'or' : ''}" role="img" aria-label="${label || `${Math.round(percent)}% do prazo decorrido`}"><i style="width:${percent}%"></i></div>`;
export const seg = (options, active, action) => html`<div class="seg">${options.map(([v, t]) => html`<button type="button" aria-pressed="${String(v === active)}"${act({ action, arg: v })}>${t}</button>`)}</div>`;
export const heading = (text) => html`<h2>${text}</h2>`;
export const empty = (title, label, action) => card(html`<div class="t">${title}</div><div class="m" style="margin:4px 0 14px">Toque para começar.</div>${button(label, { variant: 'sec', action })}`, { cls: '' });
export const backButton = (label) => html`<button class="back"${act({ action: 'back' })}>${icon('back')}${label}</button>`;

export const navBar = (state) => html`${TABS.map(([tab, label, ic]) => html`<button${state.tab === tab && !state.loanId && !state.investmentId && !state.personId ? raw(' aria-current="page"') : ''}${act({ action: 'go', arg: tab })}><span class="ni">${icon(ic)}</span>${label}</button>`)}`;
export const sheetHeader = (title, { back } = {}) => html`<div class="sheetH">${back ? html`<button class="x"${act({ action: back })} aria-label="Voltar">‹</button>` : ''}<h2>${title}</h2><button class="x"${act({ action: 'closeSheet' })} aria-label="Fechar">✕</button></div>`;

const attrs = (o = {}) => raw(Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => ` ${k}="${html`${v}`}"`).join(''));
/** Campos de formulário: id f-<name>, rótulo l-<name> e dica h-<name> podem ser atualizados com shell.patch. */
export const field = ({ name, label, value = '', type = 'text', hint = '', input = 'form.input', arg, ...rest }) =>
  html`<div class="f"><label for="f-${name}" id="l-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${value ?? ''}" data-input="${input}"${arg != null ? raw(` data-arg="${arg}"`) : ''}${attrs(rest)}><small id="h-${name}">${hint}</small></div>`;
export const select = ({ name, label, options, value, input = 'form.input', hint = '' }) =>
  html`<div class="f"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" data-input="${input}">${options.map(([v, t]) => html`<option value="${v}"${v === value ? raw(' selected') : ''}>${t}</option>`)}</select>${hint ? html`<small>${hint}</small>` : ''}</div>`;
export const switchRow = ({ id, label, checked, desc, ...a }) =>
  html`<div class="sw"><span id="${id}">${label}</span><button type="button" role="switch" aria-checked="${String(checked)}" aria-labelledby="${id}"${act(a)}><i></i></button></div><p class="m" style="margin:-6px 0 14px">${desc}</p>`;
export const footer = (body) => html`<div class="foot">${body}</div>`;
