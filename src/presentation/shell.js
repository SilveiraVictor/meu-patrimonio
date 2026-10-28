import { navBar, icon } from './components.js';
import { themeColor, textScale } from '../application/preferences.js';

/** Única camada que toca o DOM: renderiza, mostra avisos e folhas, aplica preferências. */
export function createShell({ win = window, doc = document } = {}) {
  const $ = (s) => doc.querySelector(s);
  const el = { app: $('#app'), nav: $('#nav'), fab: $('#fab'), toast: $('#toast'), sheet: $('#sh'), backdrop: $('#bd') };
  let handler = () => {}, lastKey = null, open = false, backing = false, locked = false, lockY = 0, timer;

  doc.addEventListener('click', (e) => { const t = e.target.closest?.('[data-action]'); if (t) handler(t.dataset.action, t.dataset.arg, t.dataset.arg2, t); });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') shell.closeSheet(); });
  el.backdrop.addEventListener('click', () => { if (el.backdrop.className === 'small') shell.closeSheet(); });
  for (const [ev, attr, delay] of [['input', 'input', 0], ['change', 'change', 0], ['focusin', 'focus', 0], ['focusout', 'blur', 250]]) {
    doc.addEventListener(ev, (e) => { const t = e.target.closest?.(`[data-${attr}]`); if (t) setTimeout(() => handler(t.dataset[attr], t.value, t.dataset.arg, t), delay); });
  }
  win.addEventListener('popstate', () => { if (backing) { backing = false; if (open) try { win.history.pushState({ sh: 1 }, ''); } catch { /* sem histórico */ } return; } if (open) { open = false; hide(); } });

  const lock = () => { if (locked) return; locked = true; lockY = win.scrollY || 0; doc.body.style.cssText = `position:fixed;top:-${lockY}px;left:0;right:0;overflow:hidden`; doc.documentElement.classList.add('so'); };
  const unlock = () => { if (!locked) return; locked = false; doc.body.style.cssText = ''; doc.documentElement.classList.remove('so'); win.scrollTo(0, lockY); };
  const hide = () => { el.backdrop.style.display = 'none'; el.sheet.style.display = 'none'; unlock(); };

  const shell = {
    onAction: (fn) => { handler = fn; },
    /** Valores dos campos da folha aberta (por name); combos trazem também `<name>Id`. */
    formData() {
      const o = {};
      el.sheet.querySelectorAll('[name]').forEach((n) => { o[n.name] = n.value; if (n.dataset.selected !== undefined) o[`${n.name}Id`] = n.dataset.selected || null; });
      return o;
    },
    read(sel) { const n = doc.querySelector(sel); return n ? { value: n.value, data: { ...n.dataset } } : null; },
    /** Atualiza só o que mudou (sem recriar o campo em edição, o que faria perder o foco). */
    patch(sel, p = {}) {
      const n = doc.querySelector(sel); if (!n) return;
      if ('html' in p) n.innerHTML = p.html; if ('text' in p) n.textContent = p.text; if ('value' in p) n.value = p.value;
      if ('disabled' in p) n.disabled = p.disabled; if ('hidden' in p) n.hidden = p.hidden; if (p.data) Object.assign(n.dataset, p.data);
      if (p.attrs) for (const [k, v] of Object.entries(p.attrs)) n.setAttribute(k, v);
      if (p.style) Object.assign(n.style, p.style);
    },
    click: (sel) => doc.querySelector(sel)?.click(),
    download(filename, content, type = 'application/json') {
      const u = win.URL.createObjectURL(new win.Blob([content], { type })), a = doc.createElement('a');
      a.href = u; a.download = filename; doc.body.append(a); a.click(); a.remove(); setTimeout(() => win.URL.revokeObjectURL(u), 4000);
    },
    render(markup, key) { el.app.innerHTML = markup; if (key !== lastKey) { win.scrollTo(0, 0); lastKey = key; } },
    setNav: (state) => { el.nav.innerHTML = String(navBar(state)); },
    setFab({ visible, label }) { el.fab.hidden = !visible; el.fab.innerHTML = String(icon('plus')) + label.replace(/[<>&]/g, ''); },
    toast(message, { undo = false } = {}) {
      el.toast.textContent = ''; const s = doc.createElement('span'); s.textContent = message; el.toast.append(s);
      if (undo) { const b = doc.createElement('button'); b.textContent = 'Desfazer'; b.dataset.action = 'undo'; el.toast.append(b); }
      el.toast.style.display = 'flex'; clearTimeout(timer); timer = setTimeout(() => { el.toast.style.display = 'none'; }, 5000);
    },
    openSheet(markup, { small = false } = {}) {
      el.toast.style.display = 'none'; el.sheet.className = small ? 'small' : 'full'; el.backdrop.className = small ? 'small' : 'full';
      el.sheet.innerHTML = small ? `<div class="grab"></div>${markup}` : `<div class="shc">${markup}</div>`; el.sheet.scrollTop = 0;
      lock(); el.backdrop.style.display = 'block'; el.sheet.style.display = 'block';
      if (!open) { open = true; try { if (!win.history.state?.sh) win.history.pushState({ sh: 1 }, ''); } catch { /* sem histórico */ } }
    },
    closeSheet() {
      if (!open) return; hide(); open = false;
      setTimeout(() => { if (!open && win.history.state?.sh) { backing = true; try { win.history.back(); } catch { backing = false; } } }, 0);
    },
    /** Aplica tema, tamanho do texto, contraste, movimento e a cor da barra de status. */
    applyPreferences(p, systemDark) {
      const h = doc.documentElement;
      if (p.theme === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', p.theme);
      h.classList.toggle('fs-l', textScale(p) === 1.15); h.classList.toggle('fs-xl', textScale(p) === 1.3);
      h.classList.toggle('hc', p.highContrast); h.classList.toggle('rm', p.reducedMotion);
      let m = doc.querySelector('meta[name="theme-color"]'); if (!m) { m = doc.createElement('meta'); m.name = 'theme-color'; doc.head.append(m); }
      m.content = themeColor(p, systemDark);
    },
  };
  return shell;
}
