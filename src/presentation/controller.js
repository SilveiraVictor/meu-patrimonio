import { navigate, routeOf, fabVisible, fabLabel } from './navigation.js';

/** Ações padrão de navegação; telas novas acrescentam as suas sem alterar este arquivo. */
export const navigationActions = (store) => ({
  go: (tab) => store.dispatch(navigate.go, tab),
  back: () => store.dispatch(navigate.back),
  openInvestment: (id) => store.dispatch(navigate.openInvestment, id),
  openLoan: (id) => store.dispatch(navigate.openLoan, id),
  openLoanFrom: (id, personId) => store.dispatch(navigate.openLoanFrom, id, personId),
  openPerson: (id) => store.dispatch(navigate.openPerson, id),
  setLoansView: (v) => store.dispatch(navigate.setLoansView, v),
});

/** Liga estado → tela → shell. Descarta respostas atrasadas quando a navegação muda no meio do carregamento. */
export function createController({ app, store, shell, views, actions = {} }) {
  let ticket = 0;
  const all = { ...navigationActions(store), ...actions };
  async function render() {
    const mine = ++ticket, state = store.get(), route = routeOf(state), view = views[route] ?? views.fallback;
    const model = await view.load(app, state);
    if (mine !== ticket) return;
    shell.render(String(view.render(model, state)), route + '|' + (state.loanId ?? state.investmentId ?? state.personId ?? ''));
    shell.setNav(state); shell.setFab({ visible: fabVisible(state), label: fabLabel(state) });
  }
  store.subscribe(render);
  shell.onAction((name, arg, arg2, el) => all[name]?.(arg, arg2, el));
  return { render, actions: all };
}
