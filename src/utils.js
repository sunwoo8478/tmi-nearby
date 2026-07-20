/**
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

/**
 * @param {*} post
 * @returns {boolean}
 */
export function isValidUserPost(post) {
  return Boolean(post
    && typeof post.id !== "undefined"
    && typeof post.who === "string"
    && typeof post.text === "string"
    && Array.isArray(post.comments)
    && Array.isArray(post.reactions));
}

/**
 * @param {string[]} reactions
 * @returns {number}
 */
export function sumReactions(reactions) {
  return reactions.reduce((total, reaction) => total + Number(reaction.match(/\d+/)?.[0] ?? 0), 0);
}

/**
 * @param {number} lastComposeTime - epoch ms of the previous submission, or 0 if none yet
 * @param {number} now - current epoch ms
 * @param {number} cooldownMs
 * @returns {number} remaining cooldown in ms, or 0 if a new submission is allowed
 */
export function getComposeCooldownRemainingMs(lastComposeTime, now, cooldownMs) {
  if (!lastComposeTime) return 0;
  const elapsed = now - lastComposeTime;
  return elapsed < cooldownMs ? cooldownMs - elapsed : 0;
}

/**
 * @param {string} text
 * @param {string[]} badWords
 * @returns {boolean}
 */
export function containsBadWord(text, badWords) {
  const lower = text.toLowerCase();
  return badWords.some((word) => lower.includes(word));
}

/**
 * @param {string} text
 * @param {RegExp} phonePattern
 * @returns {boolean}
 */
export function containsPhoneNumber(text, phonePattern) {
  return phonePattern.test(text);
}

const LOCATION_NAME_SUFFIXES = ["동", "아파트", "단지", "빌딩"];
const LOCATION_NAME_PATTERN = new RegExp(`([가-힣A-Za-z0-9]{2,})(?:${LOCATION_NAME_SUFFIXES.join("|")})(?!네)`);
const LOCATION_UNIT_PATTERN = /\d+\s*(?:동|호)(?!\s*(?:선|점|차|실))/;
const GENERIC_LOCATION_PREFIXES = new Set(["우리", "저희", "여기", "이", "그", "저"]);

/**
 * 완벽한 주소 파서는 아니고, "OO동/OO아파트/OO단지/OO빌딩"처럼 이름 뒤에
 * 붙는 한국 주소 접미사와 "103동/301호" 같은 동·호수 표기를 잡아내는
 * 실용적인 휴리스틱이다. "동네"(단어), "호선/호점/호차"(지하철·매장·차량
 * 번호), "우리/저희 아파트"처럼 이름이 없는 일반적인 표현은 걸러내지만,
 * 완벽하지는 않다(예: "동"으로 끝나는 사람 이름은 여전히 오탐 가능).
 * @param {string} text
 * @returns {boolean}
 */
export function containsLocationHint(text) {
  if (LOCATION_UNIT_PATTERN.test(text)) return true;
  const match = LOCATION_NAME_PATTERN.exec(text);
  if (!match) return false;
  return !GENERIC_LOCATION_PREFIXES.has(match[1]);
}

/**
 * @param {number} postId
 * @param {number} commentIndex
 * @returns {string}
 */
export function getCommentReportId(postId, commentIndex) {
  return `${postId}-${commentIndex}`;
}
