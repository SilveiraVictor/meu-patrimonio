export const normalize = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
export const digits = (v) => String(v ?? '').replace(/\D/g, '');
const SMALL = /^(de|da|do|das|dos|e)$/;
/** Nomes digitados todos em minúsculas ganham iniciais maiúsculas (exceto de, da, do, das, dos, e). */
export const niceName = (n) => n === n.toLowerCase()
  ? n.split(/\s+/).map((w, i) => (i && SMALL.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ') : n;
export const firstName = (n) => String(n).split(' ')[0];
