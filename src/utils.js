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
