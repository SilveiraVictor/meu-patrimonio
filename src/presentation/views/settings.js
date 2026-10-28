import { html } from '../html.js';
import { alert, button, card, heading, kv, seg, switchRow } from '../components.js';
import { APP_INFO } from '../appInfo.js';
import { runtimeInfo } from '../runtimeInfo.js';

export const settingsView = {
  async load(app) { const prefs = app.preferences.get(); return { prefs, counts: await app.backup.counts(), hasDemo: await app.backup.hasDemo(), runtime: await runtimeInfo({ prefs, info: APP_INFO }) }; },
  render({ prefs, counts, hasDemo, runtime }) {
    const sp = 'margin:6px 0 16px', gap = html`<div style="height:10px"></div>`;
    return html`<h1>Ajustes</h1><p class="sub">Aparência, acessibilidade, backup e dados guardados neste aparelho.</p>
      ${heading('Aparência e acessibilidade')}${card(html`<div class="lbl" style="margin-bottom:6px">Tema</div>${seg([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']], prefs.theme, 'pref.theme')}<p class="m" style="${sp}">Automático segue o tema do aparelho.</p>
        <div class="lbl" style="margin-bottom:6px">Tamanho do texto</div>${seg([['normal', 'Padrão'], ['large', 'Grande'], ['xlarge', 'Muito grande']], prefs.textSize, 'pref.textSize')}<p class="m" style="${sp}">Exemplo: parcela de R$ 1.234,56 vence em 10/12. A barra inferior mantém o tamanho para caber na tela.</p>
        ${switchRow({ id: 'a-hc', label: 'Alto contraste', checked: prefs.highContrast, desc: 'Textos e bordas mais fortes, sem fundos coloridos.', action: 'pref.highContrast', arg: String(!prefs.highContrast) })}
        ${switchRow({ id: 'a-rm', label: 'Reduzir movimento', checked: prefs.reducedMotion, desc: 'Remove animações e transições.', action: 'pref.reducedMotion', arg: String(!prefs.reducedMotion) })}
        <p class="m" style="margin:0 0 12px">Os status do app usam texto e símbolo, não apenas cor.</p>${button('Restaurar padrões', { variant: 'sec', action: 'pref.reset' })}`)}
      ${heading('Backup')}${card(html`<p class="m" style="margin:0 0 12px">Seus dados ficam salvos só neste navegador e neste aparelho. Limpar os dados do navegador apaga tudo, por isso exporte um backup de vez em quando. O arquivo também serve para levar os dados a outro aparelho.</p>
        ${button('Exportar backup', { variant: 'sec', action: 'backup.export' })}${gap}${button('Importar backup', { variant: 'sec', action: 'backup.pick' })}<input type="file" id="imp" accept="application/json,.json" hidden data-change="backup.file"><p class="m" style="margin:12px 0 0">Importar substitui os dados atuais pelos do arquivo.</p>`)}
      ${heading('Seus dados')}${kv([['Títulos de investimento', counts.investments], ['Empréstimos', counts.loans], ['Pessoas', counts.people], ['Instituições financeiras', counts.institutions]])}
      ${hasDemo ? card(html`<div class="t">Dados de exemplo</div><p class="m" style="margin:4px 0 12px">O app veio com exemplos para você testar. Apagar remove só os exemplos e mantém o que você cadastrou.</p>${button('Apagar dados de exemplo', { variant: 'sec', action: 'clearDemo.confirm' })}`) : ''}
      ${heading('Apagar dados')}${card(html`<p class="m" style="margin:0 0 12px">Remove todos os títulos, empréstimos, pagamentos, pessoas, instituições e ajustes deste aparelho. Não dá para desfazer; exporte um backup antes.</p>${button('Apagar todos os dados', { variant: 'sec', style: 'color:var(--bad)', action: 'wipe.open' })}`)}
      ${heading('Sobre o app')}${card(html`${kv(runtime.rows)}${runtime.mismatch ? html`<p class="m" style="margin:12px 0 0">O tema do app está diferente do tema do aparelho. As barras do Android seguem o aparelho; use Automático para elas combinarem com o app.</p>` : ''}
        ${runtime.staleCache ? alert(html`<span>O app está usando arquivos antigos (cache ${runtime.staleCache.current}, esperado ${runtime.staleCache.expected}). Toque em Atualizar o app agora.</span>`, { col: true }) : ''}
        <div style="height:12px"></div>${button('Atualizar o app agora', { variant: 'sec', action: 'about.update' })}${gap}${button('Copiar informações do app', { variant: 'sec', action: 'about.copy' })}`)}`;
  },
};
