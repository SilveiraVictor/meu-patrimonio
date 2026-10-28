import { html } from './html.js';
import { alert, button, field } from './components.js';
import { cnpjMask } from '../domain/shared/masks.js';
import { cnpjFormat, cpfFormat, phoneFormat, cpfMask } from '../domain/shared/masks.js';
import { digits } from '../domain/shared/text.js';
import { HomonymError } from '../domain/registry/registry.js';

/** Tipos de cadastro que podem ser escolhidos em um campo de busca. Novos tipos entram por registerKind (OCP). */
const KINDS = {
  institution: {
    service: (app) => app.institutions, newLabel: 'outra instituição', register: 'Cadastrar instituição', done: 'Instituição cadastrada',
    fields: [['name', 'Nome da instituição', {}], ['cnpj', 'CNPJ (opcional)', { placeholder: '00.000.000/0000-00', inputmode: 'numeric', input: 'mask', arg: 'cnpj' }],
      ['note', 'Observação (opcional)', { placeholder: 'Ex.: matriz, agencia X', hint: 'Ajuda a diferenciar instituições com o mesmo nome.', maxlength: 60 }]],
    lines: (e, uses) => [[e.cnpj && `CNPJ ${cnpjMask(e.cnpj)}`, e.note], [`${uses} título${uses === 1 ? '' : 's'}`]],
    label: (e) => [e.name, e.cnpj && `CNPJ ${cnpjMask(e.cnpj)}`, e.note].filter(Boolean).join(' · '),
  },
};
export const registerKind = (id, def) => { KINDS[id] = def; };
export { cpfMask, digits };
export const MASKS = { cnpj: cnpjFormat, cpf: cpfFormat, phone: phoneFormat };
export const kindDef = (id) => KINDS[id];

export const comboField = ({ name, kind, label, placeholder = 'Selecione ou digite', hint = '', value = '', selectedId = null }) =>
  html`<div class="f"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="opts-${name}" placeholder="${placeholder}" value="${value}" data-kind="${kind}" data-selected="${selectedId ?? ''}" data-input="combo.input" data-focus="combo.focus" data-blur="combo.hide"><div class="opts" id="opts-${name}" role="listbox" hidden></div><div id="al-${name}"></div><small>${hint}</small></div>`;

const option = (kind, name, { entity: e, uses }) => html`<button type="button" role="option" data-action="combo.pick" data-arg="${e.id}" data-arg2="${name}">${e.name}${e.nickname ? html` <span class="ap">“${e.nickname}”</span>` : ''}${kind.lines(e, uses).map((l) => l.filter(Boolean).join(' · ')).filter(Boolean).map((t) => html`<small>${t}</small>`)}</button>`;

/** Ações do campo de busca com cadastro rápido. `ctx.form?.refresh()` avisa o formulário aberto. */
export function comboActions(ctx) {
  const { app, shell } = ctx, seq = {};
  const kindOf = (name) => KINDS[shell.read(`#f-${name}`).data.kind];

  async function show(el, keep) {
    const name = el.name, kind = KINDS[el.dataset.kind], q = el.value.trim(), mine = (seq[name] = (seq[name] ?? 0) + 1);
    if (!keep) shell.patch(`#f-${name}`, { data: { selected: '' } });
    const results = await kind.service(app).searchWithUsage(q), selected = keep ? el.dataset.selected : '';
    if (mine !== seq[name]) return;
    const single = selected && results.length === 1 && results[0].entity.id === selected;
    shell.patch(`#opts-${name}`, { html: String(html`${results.map((r) => option(kind, name, r))}${q && !selected && results.length ? html`<button type="button" class="new" data-action="combo.new" data-arg="${name}">＋ É ${kind.newLabel}? Cadastrar “${q}”</button>` : ''}`), hidden: !results.length || !!single });
    shell.patch(`#al-${name}`, { html: selected || !q ? '' : String(results.length ? html`<div class="m" style="margin-top:6px">Toque em uma opção da lista para selecionar.</div>` : alert(html`<span>“${q}” ainda não está cadastrado(a).</span>${button(kind.register, { action: 'combo.new', arg: name, style: 'min-height:44px;font-size:calc(14px*var(--fs))' })}`, { col: true })) });
    ctx.form?.refresh();
  }

  async function pick(id, name) {
    const kind = kindOf(name), display = await kind.service(app).nameOf(id);
    shell.patch(`#f-${name}`, { value: display, data: { selected: id } }); shell.patch(`#opts-${name}`, { html: '', hidden: true }); shell.patch(`#al-${name}`, { html: '' });
    ctx.form?.refresh();
  }

  return {
    'combo.input': (_v, _a, el) => show(el, false),
    'combo.focus': (_v, _a, el) => show(el, true),
    'combo.hide': (_v, name) => shell.patch(`#opts-${name ?? ''}`, { hidden: true }),
    'combo.pick': pick,
    'combo.new'(name) {
      const kind = kindOf(name), typed = shell.read(`#f-${name}`).value.trim();
      shell.patch(`#al-${name}`, { html: String(html`<div class="card" style="margin:8px 0 0">${kind.fields.map(([k, label, o]) => field({ name: `q_${k}`, label, value: k === 'name' ? typed : '', ...o }))}<div id="qa-${name}"></div>${button('Salvar e usar', { action: 'combo.save', arg: name })}</div>`) });
      shell.patch(`#opts-${name}`, { hidden: true });
    },
    async 'combo.save'(name, distinct) {
      const kind = kindOf(name), data = shell.formData(), input = Object.fromEntries(kind.fields.map(([k]) => [k, data[`q_${k}`] ?? '']));
      try { const e = await kind.service(app).create(input, { confirmDistinct: distinct === 'distinct' }); await pick(e.id, name); ctx.toast(kind.done); }
      catch (err) {
        if (!(err instanceof HomonymError)) { ctx.toast(err.message); return; }
        shell.patch(`#qa-${name}`, { html: String(alert(html`<span>Já existe ${err.matches.length > 1 ? 'mais de um cadastro chamado' : 'um cadastro chamado'} “${err.matches[0].name}”. É o mesmo?</span>${err.matches.map((m) => button(`Usar ${kind.label(m)}`, { variant: 'sec', action: 'combo.pick', arg: m.id, arg2: name, style: 'min-height:44px;font-size:calc(14px*var(--fs))' }))}${button('É outro cadastro', { action: 'combo.save', arg: name, arg2: 'distinct', style: 'min-height:44px;font-size:calc(14px*var(--fs))' })}`, { col: true })) });
      }
    },
  };
}
