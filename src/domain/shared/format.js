export const defaultFormat = {
  money: (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  date: (d) => d.toLocaleDateString('pt-BR'),
  longDate: (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
};
