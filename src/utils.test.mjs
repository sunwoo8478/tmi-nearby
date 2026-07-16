import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, isValidUserPost, sumReactions } from "./utils.js";

describe("escapeHtml", () => {
  test("escapes each special character individually", () => {
    assert.equal(escapeHtml("&"), "&amp;");
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml(">"), "&gt;");
    assert.equal(escapeHtml('"'), "&quot;");
    assert.equal(escapeHtml("'"), "&#39;");
  });

  test("escapes a mix of special characters in one string", () => {
    assert.equal(
      escapeHtml(`<script>alert("x & 'y'")</script>`),
      "&lt;script&gt;alert(&quot;x &amp; &#39;y&#39;&quot;)&lt;/script&gt;",
    );
  });

  test("leaves plain strings with no special characters untouched", () => {
    assert.equal(escapeHtml("방금 계산대에서 카드 거꾸로 꽂음"), "방금 계산대에서 카드 거꾸로 꽂음");
    assert.equal(escapeHtml(""), "");
  });

  test("converts non-string input with String() before escaping", () => {
    assert.equal(escapeHtml(123), "123");
    assert.equal(escapeHtml(null), "null");
    assert.equal(escapeHtml(undefined), "undefined");
    assert.equal(escapeHtml({ toString: () => "<b>" }), "&lt;b&gt;");
  });
});

describe("isValidUserPost", () => {
  const validPost = {
    id: 1,
    who: "익명의 라쿤",
    text: "TMI",
    comments: [],
    reactions: [],
  };

  test("returns true for a well-formed post", () => {
    assert.equal(isValidUserPost(validPost), true);
  });

  test("returns true even when id is falsy but defined (0)", () => {
    assert.equal(isValidUserPost({ ...validPost, id: 0 }), true);
  });

  test("returns false when id is missing", () => {
    const { id, ...rest } = validPost;
    assert.equal(isValidUserPost(rest), false);
  });

  test("returns false when who is not a string", () => {
    assert.equal(isValidUserPost({ ...validPost, who: 123 }), false);
  });

  test("returns false when text is not a string", () => {
    assert.equal(isValidUserPost({ ...validPost, text: null }), false);
  });

  test("returns false when comments is not an array", () => {
    assert.equal(isValidUserPost({ ...validPost, comments: "none" }), false);
  });

  test("returns false when reactions is not an array", () => {
    assert.equal(isValidUserPost({ ...validPost, reactions: undefined }), false);
  });

  test("returns false for null or undefined input", () => {
    assert.equal(isValidUserPost(null), false);
    assert.equal(isValidUserPost(undefined), false);
  });
});

describe("sumReactions", () => {
  test("sums the numbers found in each reaction string", () => {
    assert.equal(sumReactions(["✨ 1", "😂 14", "🔥 12"]), 27);
  });

  test("treats reactions with no digits as 0", () => {
    assert.equal(sumReactions(["✨", "😂 5"]), 5);
  });

  test("returns 0 for an empty array", () => {
    assert.equal(sumReactions([]), 0);
  });
});
