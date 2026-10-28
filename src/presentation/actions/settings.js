import { html } from '../html.js';
import { button, field, sheetHeader } from '../components.js';
import { confirmSheet } from './common.js';
import { navigate } from '../navigation.js';
import { normalize } from '../../domain/shared/text.js';
import { APP_INFO } from '../appInfo.js';
import { runtimeInfo } from '../runtimeInfo.js';

export function settingsActions(ctx) {
  const { app, shell, store } = ctx;
  const setPref = (patch, message) => async () => { app.preferences.update(patch); shell.applyPreferences(app.preferences.get(), ctx.systemDark()); await ctx.render(); if (message) ctx.toast(message); };
  return {
    'pref.theme': (v) => setPref({ theme: v })(), 'pref.textSize': (v) => setPref({ textSize: v })(),
    'pref.highContrast': (v) => setPref({ highContrast: v === 'true' })(), 'pref.reducedMotion': (v) => setPref({ reducedMotion: v === 'true' })(),
    'pref.reset': () => setPref({ theme: 'auto', textSize: 'normal', highContrast: false, reducedMotion: false }, 'Aparência restaurada')(),

    async 'backup.export'() { const f = await app.backup.export(); shell.download(f.filename, f.content); ctx.toast('Arquivo pronto'); },
    'backup.pick': () => shell.click('#imp'),
    async 'backup.file'(_v, _a, el) {
      const file = el.files?.[0]; el.value = ''; if (!file) return;
      try {
        const text = await file.text(), info = app.backup.inspect(text); ctx.pendingImport = text;
        confirmSheet(ctx, { title: 'Importar backup?', message: `Isso substitui os dados atuais por ${info.investments} títulos e ${info.loans} empréstimos do arquivo.`, label: 'Importar', action: 'backup.import', danger: false });
      } catch (e) { ctx.toast(e.message); }
    },
    async 'backup.import'() {
      try { await app.backup.import(ctx.pendingImport); } catch (e) { ctx.toast(e.message); return; }
      ctx.pendingImport = null; shell.closeSheet(); store.dispatch(navigate.go, 'home'); await ctx.render(); ctx.toast('Backup importado');
    },

    'clearDemo.confirm': () => confirmSheet(ctx, { title: 'Apagar exemplos?', message: 'Os títulos e empréstimos de exemplo serão removidos. O que você cadastrou continua aqui.', label: 'Apagar exemplos', action: 'clearDemo' }),
    async clearDemo() { await app.backup.clearDemo(); shell.closeSheet(); await ctx.render(); ctx.toast('Exemplos apagados'); },

    'wipe.open': () => shell.openSheet(String(html`${sheetHeader('Apagar todos os dados?')}<p class="sub">Isso remove todos os títulos, empréstimos, pagamentos, pessoas e instituições deste aparelho, além dos seus ajustes de credor (nome e Pix) e indicadores. Não dá para desfazer. As preferências de aparência e acessibilidade são mantidas.</p>
      ${button('Exportar backup antes', { variant: 'sec', action: 'backup.export' })}${field({ name: 'confirm', label: 'Para confirmar, digite APAGAR', input: 'wipe.input', autocomplete: 'off', autocapitalize: 'characters' })}
      ${button('Apagar tudo', { variant: 'dg', id: 'w-b', action: 'wipe.confirm', disabled: true })}<div style="height:10px"></div>${button('Cancelar', { variant: 'sec', action: 'closeSheet' })}`), { small: true }),
    'wipe.input': (v) => shell.patch('#w-b', { disabled: normalize(v) !== 'apagar' }),
    async 'wipe.confirm'() { await app.backup.wipe(shell.formData().confirm); shell.closeSheet(); store.dispatch(navigate.go, 'settings'); await ctx.render(); ctx.toast('Todos os dados foram apagados'); },

    async 'about.copy'() {
      const r = await runtimeInfo({ prefs: app.preferences.get(), info: APP_INFO }), text = `Meu Patrimônio\n${r.rows.map(([a, b]) => `${a}: ${b}`).join('\n')}\nNavegador: ${r.userAgent}`;
      try { await navigator.clipboard.writeText(text); ctx.toast('Informações copiadas'); } catch { ctx.toast('Não foi possível copiar'); }
    },
    async 'about.update'() {
      ctx.toast('Atualizando…');
      try { await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister())); await Promise.all((await caches.keys()).map((k) => caches.delete(k))); } catch { /* segue para recarregar */ }
      location.reload();
    },
  };
}
