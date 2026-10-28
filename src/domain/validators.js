const digits = (v) => String(v).replace(/\D/g, '');
const allEqual = (d) => /^(\d)\1+$/.test(d);

export function isValidCpf(value) {
  const d = digits(value);
  if (d.length !== 11 || allEqual(d)) return false;
  const check = (n) => { let t = 0; for (let i = 0; i < n; i++) t += +d[i] * (n + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  return check(9) === +d[9] && check(10) === +d[10];
}

export function isValidCnpj(value) {
  const d = digits(value);
  if (d.length !== 14 || allEqual(d)) return false;
  const check = (n) => { let t = 0, w = n - 7; for (let i = 0; i < n; i++) { t += +d[i] * w--; if (w < 2) w = 9; } const r = t % 11; return r < 2 ? 0 : 11 - r; };
  return check(12) === +d[12] && check(13) === +d[13];
}
