export const EXEMPT = new Set(['LCI', 'LCA', 'CRI', 'CRA']);
const IOF_CATEGORIES = new Set(['CDB', 'LC', 'Tesouro Direto']);
const IR_TABLE = [[180, 0.225], [360, 0.2], [720, 0.175], [Infinity, 0.15]];
const IOF_TABLE = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3];

export const irRate = (category, days) => EXEMPT.has(category) ? 0 : IR_TABLE.find(([max]) => days <= max)[1];
export const iofApplies = (category) => IOF_CATEGORIES.has(category);
export const iofRate = (days) => days >= 30 ? 0 : IOF_TABLE[Math.max(1, days) - 1] / 100;
