/**
 * Portas (contratos) que a aplicação exige da infraestrutura (DIP).
 * @typedef {{ get(id):Promise<any>, list():Promise<any[]>, save(entity):Promise<void>, remove(id):Promise<void> }} Repository
 * @typedef {{ today():Date }} Clock
 */
export {};
