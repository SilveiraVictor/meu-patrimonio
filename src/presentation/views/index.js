import { html } from '../html.js';
import { homeView } from './home.js';
import { investmentsView, investmentDetailView } from './investments.js';
import { settingsView } from './settings.js';
import { loansView, loanDetailView, personDetailView } from './loans.js';

/** Registro de telas por rota. Cada tela: { load(app, state) → modelo, render(modelo, state) → HTML }. */
const placeholder = { load: async () => null, render: () => html`<h1>Em construção</h1><p class="sub">Esta tela ainda está no app anterior.</p>` };
export const views = { home: homeView, investments: investmentsView, 'investment-detail': investmentDetailView, settings: settingsView, loans: loansView, 'loan-detail': loanDetailView, 'person-detail': personDetailView, fallback: placeholder };
