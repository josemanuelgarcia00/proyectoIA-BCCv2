/** Igual que datetime.now().isoformat(timespec="seconds") en Python: hora
 * local sin zona horaria, p.ej. "2026-06-23T14:40:05". */
export function localIsoTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
