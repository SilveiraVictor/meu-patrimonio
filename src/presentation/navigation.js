/** Estado de navegação e transições puras (sem DOM). */
export const initialState = Object.freeze({ tab: 'home', loanId: null, investmentId: null, personId: null, loanFromPerson: null, loansView: 'list' });
const clear = { loanId: null, investmentId: null, personId: null, loanFromPerson: null };

export const navigate = {
  go: (s, tab) => ({ ...s, ...clear, tab }),
  openInvestment: (s, id) => ({ ...s, ...clear, tab: 'investments', investmentId: id }),
  openLoan: (s, id) => ({ ...s, tab: 'loans', loanId: id, investmentId: null }),
  openLoanFrom: (s, id, personId) => ({ ...navigate.openLoan(s, id), loanFromPerson: personId }),
  openPerson: (s, id) => ({ ...s, ...clear, tab: 'loans', personId: id }),
  setLoansView: (s, loansView) => ({ ...s, loansView }),
  /** Voltar: do empréstimo para a pessoa de onde veio (ou para a lista), da pessoa para "Por pessoa". */
  back: (s) => s.loanId ? (s.loanFromPerson ? navigate.openPerson(s, s.loanFromPerson) : navigate.go(s, 'loans'))
    : s.personId ? { ...navigate.go(s, 'loans'), loansView: 'person' } : s.investmentId ? navigate.go(s, 'investments') : s,
};
export const isDetail = (s) => !!(s.loanId || s.investmentId || s.personId);
export const routeOf = (s) => s.investmentId ? 'investment-detail' : s.loanId ? 'loan-detail' : s.personId ? 'person-detail' : s.tab;
export const fabVisible = (s) => !isDetail(s) && s.tab !== 'settings';
export const fabLabel = (s) => ({ investments: 'Novo título', loans: 'Novo empréstimo' })[s.tab] ?? 'Adicionar';
export const TABS = [['home', 'Início', 'home'], ['investments', 'Investimentos', 'inv'], ['loans', 'Empréstimos', 'loans'], ['settings', 'Ajustes', 'cfg']];
