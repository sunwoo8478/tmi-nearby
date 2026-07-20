/**
 * @param {string} prefix
 * @param {number|bigint} rowid
 * @returns {string}
 */
export function formatId(prefix, rowid) {
  return `${prefix}_${rowid}`;
}

/**
 * @param {string} prefix
 * @param {string} raw
 * @returns {number|null} null이면 형식이 안 맞거나 정수가 아님
 */
export function parseId(prefix, raw) {
  if (typeof raw !== "string" || !raw.startsWith(`${prefix}_`)) return null;
  const numeric = raw.slice(prefix.length + 1);
  if (!/^\d+$/.test(numeric)) return null;
  return Number(numeric);
}

/**
 * @param {string} nickname
 * @returns {string}
 */
export function formatWho(nickname) {
  return `익명의 ${nickname}`;
}
