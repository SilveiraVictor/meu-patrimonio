/** Diagnóstico do ambiente (só no navegador): modo de execução, cache do PWA e temas. */
export async function runtimeInfo({ win = window, prefs, info }) {
  const dark = win.matchMedia('(prefers-color-scheme: dark)').matches;
  let cache = '—'; try { cache = (await win.caches.keys()).find((k) => k.startsWith('mp-')) ?? '—'; } catch { /* sem Cache API */ }
  let embedded = false; try { embedded = win.self !== win.top; } catch { embedded = true; }
  const installed = win.matchMedia('(display-mode: standalone)').matches || win.matchMedia('(display-mode: fullscreen)').matches || win.navigator.standalone;
  const mode = embedded ? 'Dentro de outro app (ex.: claude.ai)' : installed ? 'App instalado (PWA)' : 'Navegador';
  return {
    rows: [['Versão', info.version], ['Compilação', info.build], ['Origem', 'PWA hospedado'], ['Executando como', mode], ['Cache do app (PWA)', cache], ['Tema do aparelho', dark ? 'Escuro' : 'Claro'], ['Tema do app', { auto: 'Automático', light: 'Claro', dark: 'Escuro' }[prefs.theme]]],
    mismatch: prefs.theme !== 'auto' && (prefs.theme === 'dark') !== dark,
    staleCache: cache !== '—' && cache !== info.cacheExpected ? { current: cache, expected: info.cacheExpected } : null,
    userAgent: win.navigator.userAgent,
  };
}
