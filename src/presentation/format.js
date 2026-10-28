export const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const num = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export const pct = (n) => `${num(n)}%`;
export const shortDate = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\./g, '');
export const fullDate = (d) => d.toLocaleDateString('pt-BR');
export const longDate = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
/** Formato entregue aos geradores de mensagem e documento. */
export const presentationFormat = { money: brl, date: fullDate, shortDate, longDate };
