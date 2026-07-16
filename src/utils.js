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
  return post
    && typeof post.id !== "undefined"
    && typeof post.who === "string"
    && typeof post.text === "string"
    && Array.isArray(post.comments)
    && Array.isArray(post.reactions);
}

/**
 * @param {string[]} reactions
 * @returns {number}
 */
export function sumReactions(reactions) {
  return reactions.reduce((total, reaction) => total + Number(reaction.match(/\d+/)?.[0] ?? 0), 0);
}
