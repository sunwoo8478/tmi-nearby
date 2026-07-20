import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  isValidUserPost,
  sumReactions,
  getComposeCooldownRemainingMs,
  containsBadWord,
  containsPhoneNumber,
  containsLocationHint,
  getCommentReportId,
} from "./utils.js";

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

describe("getComposeCooldownRemainingMs", () => {
  test("returns 0 when there is no previous submission", () => {
    assert.equal(getComposeCooldownRemainingMs(0, 1000, 10000), 0);
  });

  test("returns 0 once the cooldown window has fully elapsed", () => {
    assert.equal(getComposeCooldownRemainingMs(1000, 11000, 10000), 0);
  });

  test("returns the remaining ms while still inside the cooldown window", () => {
    assert.equal(getComposeCooldownRemainingMs(1000, 4000, 10000), 7000);
  });

  test("treats the boundary (elapsed === cooldownMs) as allowed", () => {
    assert.equal(getComposeCooldownRemainingMs(1000, 11000, 10000), 0);
  });
});

describe("containsBadWord", () => {
  const badWords = ["시발", "씨발", "병신", "개새", "좆", "fuck", "shit"];

  test("returns true when text contains a banned word", () => {
    assert.equal(containsBadWord("이 씨발 진짜", badWords), true);
  });

  test("matches banned words regardless of case", () => {
    assert.equal(containsBadWord("what the FUCK", badWords), true);
  });

  test("returns false for clean text", () => {
    assert.equal(containsBadWord("오늘 점심 뭐 먹지", badWords), false);
  });

  test("returns false for an empty string", () => {
    assert.equal(containsBadWord("", badWords), false);
  });
});

describe("containsPhoneNumber", () => {
  const phonePattern = /\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/;

  test("detects a hyphenated phone number", () => {
    assert.equal(containsPhoneNumber("연락처는 010-1234-5678 이에요", phonePattern), true);
  });

  test("detects a phone number without separators", () => {
    assert.equal(containsPhoneNumber("01012345678로 연락주세요", phonePattern), true);
  });

  test("returns false when no phone number is present", () => {
    assert.equal(containsPhoneNumber("오늘 날씨 진짜 좋다", phonePattern), false);
  });
});

describe("containsLocationHint", () => {
  test("detects a legal dong name", () => {
    assert.equal(containsLocationHint("저희 집은 역삼동이에요"), true);
  });

  test("detects a named apartment complex", () => {
    assert.equal(containsLocationHint("래미안아파트 살아요"), true);
  });

  test("detects a named residential complex (단지)", () => {
    assert.equal(containsLocationHint("신도시단지 앞에서 만나요"), true);
  });

  test("detects a named building (빌딩)", () => {
    assert.equal(containsLocationHint("타워빌딩 1층에서 봐요"), true);
  });

  test("detects a building/unit number", () => {
    assert.equal(containsLocationHint("103동 1502호에 살아요"), true);
  });

  test("detects a standalone unit number", () => {
    assert.equal(containsLocationHint("1502호로 와주세요"), true);
  });

  test("does not flag a common word that happens to end in 동", () => {
    assert.equal(containsLocationHint("오늘 운동하고 왔어요"), false);
  });

  test("does not flag a generic apartment mention with no complex name", () => {
    assert.equal(containsLocationHint("우리 아파트 살아요"), false);
  });

  test("does not flag the word 전화번호 (no digit prefix before 호)", () => {
    assert.equal(containsLocationHint("전화번호 남기지 마세요"), false);
  });

  test("does not flag 단지 used as an adverb (merely/just)", () => {
    assert.equal(containsLocationHint("그냥 단지 궁금해서 물어본거에요"), false);
  });

  test("does not flag 동네 (neighborhood) with no space before it", () => {
    assert.equal(containsLocationHint("우리동네 최고"), false);
  });

  test("does not flag 아파트 glued to a generic prefix with no space", () => {
    assert.equal(containsLocationHint("우리아파트 살아요"), false);
  });

  test("does not flag a subway line number (호선)", () => {
    assert.equal(containsLocationHint("2호선 타고 가요"), false);
  });

  test("does not flag a store branch number (호점)", () => {
    assert.equal(containsLocationHint("3호점에서 만나요"), false);
  });

  test("does not flag a vehicle number (호차)", () => {
    assert.equal(containsLocationHint("1호차에 있어요"), false);
  });

  test("still flags a room number (호실) as a location hint", () => {
    assert.equal(containsLocationHint("301호실에 있어요"), true);
  });

  test("returns false for an empty string", () => {
    assert.equal(containsLocationHint(""), false);
  });
});

describe("getCommentReportId", () => {
  test("joins postId and commentIndex with a hyphen", () => {
    assert.equal(getCommentReportId(42, 3), "42-3");
  });

  test("distinguishes different comment indexes on the same post", () => {
    assert.notEqual(getCommentReportId(1, 0), getCommentReportId(1, 1));
  });

  test("distinguishes the same comment index on different posts", () => {
    assert.notEqual(getCommentReportId(1, 0), getCommentReportId(2, 0));
  });
});
