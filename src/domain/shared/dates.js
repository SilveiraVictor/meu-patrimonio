const DAY = 864e5;
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const diffDays = (from, to) => Math.round((to - from) / DAY);
export const diffDaysFloor = (from, to) => Math.floor((to - from) / DAY);
export const addDays = (d, n) => new Date(d.getTime() + n * DAY);
export const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
export const DAY_MS = DAY;
export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
