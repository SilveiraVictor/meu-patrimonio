/** Estado observável e mínimo; mudanças só por funções puras (reducers). */
export class Store {
  #state; #listeners = new Set();
  constructor(initial) { this.#state = initial; }
  get() { return this.#state; }
  dispatch(reducer, ...args) {
    const next = reducer(this.#state, ...args);
    if (next === this.#state) return;
    this.#state = next; this.#listeners.forEach((l) => l(next));
  }
  subscribe(l) { this.#listeners.add(l); return () => this.#listeners.delete(l); }
}
