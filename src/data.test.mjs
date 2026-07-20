import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { posts, notices, myPosts } from "./data.js";

describe("posts data", () => {
  test("is a non-empty array", () => {
    assert.ok(Array.isArray(posts), "posts should be an array");
    assert.ok(posts.length > 0, "posts should not be empty");
  });

  test("uses unique ids for every post", () => {
    const ids = posts.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("only includes supported post types", () => {
    const supportedTypes = new Set(["tmi", "vote"]);
    for (const post of posts) {
      assert.ok(supportedTypes.has(post.type), `post ${post.id} has unsupported type ${post.type}`);
    }
  });

  test("includes valid vote options for vote posts", () => {
    const votePosts = posts.filter(({ type }) => type === "vote");
    assert.ok(votePosts.length > 0, "expected at least one vote post");

    for (const post of votePosts) {
      assert.ok(Array.isArray(post.options), `post ${post.id} should have options`);
      assert.ok(post.options.length > 0, `post ${post.id} should have at least one option`);

      for (const option of post.options) {
        assert.equal(typeof option.label, "string", `post ${post.id} option label should be a string`);
        assert.ok(option.label.length > 0, `post ${post.id} option label should not be empty`);
        assert.equal(typeof option.pct, "number", `post ${post.id} option pct should be a number`);
        assert.ok(Number.isFinite(option.pct), `post ${post.id} option pct should be finite`);
      }
    }
  });

  test("keeps vote option percentages close to 100", () => {
    for (const post of posts.filter(({ type }) => type === "vote")) {
      const total = post.options.reduce((sum, { pct }) => sum + pct, 0);
      assert.ok(Math.abs(total - 100) <= 1, `post ${post.id} vote pct total should be near 100, got ${total}`);
    }
  });

  test("stores comments as [author, text] string tuples", () => {
    for (const post of posts) {
      assert.ok(Array.isArray(post.comments), `post ${post.id} comments should be an array`);

      for (const comment of post.comments) {
        assert.ok(Array.isArray(comment), `post ${post.id} comment should be a tuple`);
        assert.equal(comment.length, 2, `post ${post.id} comment should have author and text`);
        assert.equal(typeof comment[0], "string", `post ${post.id} comment author should be a string`);
        assert.equal(typeof comment[1], "string", `post ${post.id} comment text should be a string`);
      }
    }
  });
});

describe("supplementary data", () => {
  test("notices and myPosts are non-empty arrays", () => {
    assert.ok(Array.isArray(notices) && notices.length > 0, "notices should not be empty");
    assert.ok(Array.isArray(myPosts) && myPosts.length > 0, "myPosts should not be empty");
  });

  test("stores notices as [icon, text, time] string tuples", () => {
    for (const notice of notices) {
      assert.ok(Array.isArray(notice));
      assert.equal(notice.length, 3);
      assert.ok(notice.every((value) => typeof value === "string"));
    }
  });

  test("stores myPosts as six-field string tuples", () => {
    for (const post of myPosts) {
      assert.ok(Array.isArray(post));
      assert.equal(post.length, 6);
      assert.ok(post.every((value) => typeof value === "string"));
    }
  });
});
