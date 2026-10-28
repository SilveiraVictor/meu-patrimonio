import { html } from '../html.js';
import { button, sheetHeader } from '../components.js';
import { MASKS } from '../combo.js';

export const confirmSheet = (ctx, { title, message, label, action, arg, danger = true }) =>
  ctx.shell.openSheet(String(html`${sheetHeader(title)}<p class="sub">${message}</p>${button(label, { variant: danger ? 'dg' : '', action, arg })}<div style="height:10px"></div>${button('Cancelar', { variant: 'sec', action: 'closeSheet' })}`), { small: true });

/** Ações compartilhadas: fechar folha, máscaras de campo e o botão flutuante. */
export function commonActions(ctx) {
  return {
    closeSheet: () => { ctx.form = null; ctx.shell.closeSheet(); },
    mask: (v, kind, el) => ctx.shell.patch(`#${el.id}`, { value: MASKS[kind](v) }),
    fab() {
      const tab = ctx.store.get().tab;
      if (tab === 'investments') return ctx.run('investment.new');
      if (tab === 'loans') return ctx.run('loan.new');
      ctx.shell.openSheet(String(html`${sheetHeader('O que você quer adicionar?')}${button('Novo título', { variant: 'sec', action: 'investment.new' })}<div style="height:10px"></div>${button('Novo empréstimo', { variant: 'sec', action: 'loan.new' })}`), { small: true });
    },
  };
}
