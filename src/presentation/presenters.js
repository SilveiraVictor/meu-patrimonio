import { num } from './format.js';

/** Traduz resultados do domínio em [texto, tom] de selo. Nenhuma regra de negócio aqui. */
export const dueChip = (days) => days < 0 ? [`${-days}d em atraso`, 'bad'] : days === 0 ? ['Hoje', 'or'] : days === 1 ? ['Amanhã', 'or'] : [`em ${days} dias`, days <= 30 ? 'or' : 'blue'];
export const loanChip = (s) => ({ settled: ['Quitado', 'ok'], overdue: [`${s.days}d em atraso`, 'bad'], dueToday: ['Vence hoje', 'or'], onTime: ['Em dia', 'ok'] })[s.code];
export const investmentChip = (s) => ({ redeemed: ['Resgatado', 'ok'], matured: ['Venceu', 'or'], today: ['Hoje', 'or'], tomorrow: ['Amanhã', 'or'], upcoming: [`em ${s.days} dias`, s.attention ? 'or' : 'blue'] })[s.code];
export const personBadge = (b) => ({ overdue: ['Em atraso', 'bad'], onTime: ['Em dia', 'ok'], settled: ['Quitado', ''] })[b];

export const INDEXERS = { fixed: 'Prefixado', cdi: '% do CDI', ipca: 'IPCA +', selic: 'Selic +' };
export const REDEMPTION_RULES = { maturity: 'Resgate somente no vencimento', daily: 'Liquidez diária', penalty: 'Resgate antecipado com penalidade' };
export const SYSTEMS = { none: 'Sem juros', price: 'Tabela Price', sac: 'SAC', single: 'Pagamento único' };

export const rateLabel = (i) => ({ fixed: `${num(i.rate)}% a.a.`, cdi: `${num(i.rate)}% do CDI`, ipca: `IPCA + ${num(i.rate)}% a.a.`, selic: `Selic + ${num(i.rate)}% a.a.` })[i.indexer];
export const redemptionLabel = (i) => REDEMPTION_RULES[i.redemptionRule] + (i.graceDays > 0 ? ` · carência de ${i.graceDays} dias` : '');
export const systemLabel = (l) => SYSTEMS[l.system] + (l.system === 'single' && l.monthlyRate > 0 ? ` (${l.compounding === 'compound' ? 'juros compostos' : 'juros simples'})` : '') + (l.monthlyRate ? ` · ${num(l.monthlyRate * 100)}% a.m.` : '');
export const RATE_LABELS = { fixed: 'Taxa (% ao ano)', cdi: 'Percentual do CDI (%)', ipca: 'Taxa acima do IPCA (% ao ano)', selic: 'Spread sobre a Selic (% ao ano)' };
