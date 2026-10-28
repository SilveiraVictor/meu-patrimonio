import { digits } from './text.js';
export const cpfMask = (v) => { const d = digits(v); return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : v; };
export const cnpjMask = (v) => { const d = digits(v); return d.length === 14 ? `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**` : v; };
export const cpfFormat = (v) => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
export const cnpjFormat = (v) => digits(v).slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
export const phoneFormat = (v) => digits(v).slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
