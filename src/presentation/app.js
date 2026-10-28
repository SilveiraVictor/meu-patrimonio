import { createApp } from '../main.js';
import { Store } from './store.js';
import { initialState } from './navigation.js';
import { createShell } from './shell.js';
import { createController } from './controller.js';
import { views } from './views/index.js';
import { commonActions } from './actions/common.js';
import { comboActions } from './combo.js';
import { investmentActions } from './actions/investments.js';
import { settingsActions } from './actions/settings.js';
import { loanActions } from './actions/loans.js';
import { navigate, isDetail } from './navigation.js';
import './peopleKind.js';

/** Ponto de entrada do navegador: monta o contexto compartilhado pelas ações e inicia a primeira tela. */
export async function start() {
  const app = await createApp(), shell = createShell(), store = new Store(initialState), dark = matchMedia('(prefers-color-scheme: dark)');
  const ctx = { app, shell, store, form: null, pendingImport: null, systemDark: () => dark.matches, toast: (m, o) => shell.toast(m, o), render: async () => controller.render(), run: (n, ...a) => controller.actions[n]?.(...a) };
  const apply = () => shell.applyPreferences(app.preferences.get(), dark.matches);
  apply(); dark.addEventListener('change', apply);
  const controller = createController({ app, store, shell, views, actions: { ...commonActions(ctx), ...comboActions(ctx), ...investmentActions(ctx), ...loanActions(ctx), ...settingsActions(ctx),
    async 'app.install'() { const p = app.runtime.prompt; if (!p) return; p.prompt(); try { await p.userChoice; } catch { /* recusou */ } app.runtime.prompt = null; await controller.render(); } } });
  const on = (q) => matchMedia(q).matches;
  app.runtime = { prompt: null, ios: /iphone|ipad|ipod/i.test(navigator.userAgent), installed: () => on('(display-mode: standalone)') || on('(display-mode: fullscreen)') || navigator.standalone === true };
  const refreshHome = () => { const s = store.get(); if (s.tab === 'home' && !isDetail(s)) controller.render(); };
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); app.runtime.prompt = e; refreshHome(); });
  addEventListener('appinstalled', () => { app.runtime.prompt = null; refreshHome(); });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  await controller.render();
  // Atalhos do PWA: ?novo=emprestimo e ?novo=investimento
  const shortcut = new URLSearchParams(location.search).get('novo');
  if (shortcut) {
    history.replaceState(null, '', location.pathname);
    if (shortcut === 'emprestimo') { store.dispatch(navigate.go, 'loans'); await controller.render(); await controller.actions['loan.new'](); }
    if (shortcut === 'investimento') { store.dispatch(navigate.go, 'investments'); await controller.render(); await controller.actions['investment.new'](); }
  }
  return { app, store, shell, controller, ctx };
}
