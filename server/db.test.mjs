import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { openDb, isUniqueConstraintError } from "./db.js";

/** @type {ReturnType<typeof openDb>} */
let repo;

beforeEach(() => {
  repo = openDb(":memory:");
});

function seedSession(id = "as_1", token = "tok_1") {
  repo.insertSession({
    id,
    token,
    deviceId: null,
    locale: "ko-KR",
    nickname: "라쿤",
    nicknameAssignedAt: 0,
    createdAt: 0,
    expiresAt: 999999999999,
  });
  return id;
}

describe("sessions", () => {
  test("insert and look up by token", () => {
    seedSession("as_1", "tok_1");
    const session = repo.getSessionByToken("tok_1");
    assert.equal(session.id, "as_1");
    assert.equal(session.nickname, "라쿤");
  });

  test("unknown token returns null", () => {
    assert.equal(repo.getSessionByToken("nope"), null);
  });
});

describe("votes uniqueness", () => {
  test("second vote from the same session on the same post throws a unique constraint error", () => {
    const sessionId = seedSession();
    const postInfo = repo.insertPost({
      sessionId,
      type: "vote",
      who: "익명의 라쿤",
      text: "A vs B",
      lat: 37.5,
      lng: 127.0,
      radiusM: 50,
      watching: 10,
      createdAt: 0,
    });
    const postId = Number(postInfo.lastInsertRowid);
    const optA = Number(repo.insertVoteOption(postId, "A", 0).lastInsertRowid);
    const optB = Number(repo.insertVoteOption(postId, "B", 1).lastInsertRowid);

    repo.insertVote(postId, optA, sessionId, 1);
    assert.throws(() => repo.insertVote(postId, optB, sessionId, 2), (err) => isUniqueConstraintError(err));
  });
});

describe("reports uniqueness", () => {
  test("duplicate (session, target_type, target_id) report throws a unique constraint error", () => {
    const sessionId = seedSession();
    repo.insertReport({
      sessionId,
      targetType: "post",
      targetId: "1",
      reason: "spam",
      memo: null,
      createdAt: 0,
    });
    assert.throws(
      () =>
        repo.insertReport({
          sessionId,
          targetType: "post",
          targetId: "1",
          reason: "spam again",
          memo: null,
          createdAt: 1,
        }),
      (err) => isUniqueConstraintError(err),
    );
  });

  test("different target_type with the same target_id is allowed", () => {
    const sessionId = seedSession();
    repo.insertReport({ sessionId, targetType: "post", targetId: "1", reason: "a", memo: null, createdAt: 0 });
    assert.doesNotThrow(() =>
      repo.insertReport({ sessionId, targetType: "comment", targetId: "1", reason: "b", memo: null, createdAt: 1 }),
    );
  });
});

describe("hidden / blocked_authors idempotency", () => {
  test("inserting the same hidden row twice does not throw (INSERT OR IGNORE)", () => {
    const sessionId = seedSession();
    const postInfo = repo.insertPost({
      sessionId,
      type: "tmi",
      who: "익명의 라쿤",
      text: "hi",
      lat: 0,
      lng: 0,
      radiusM: 50,
      watching: 1,
      createdAt: 0,
    });
    const postId = Number(postInfo.lastInsertRowid);
    assert.doesNotThrow(() => {
      repo.insertHidden(sessionId, postId, 1);
      repo.insertHidden(sessionId, postId, 2);
    });
  });

  test("deleteHidden on a never-hidden row is a no-op, not an error", () => {
    const sessionId = seedSession();
    assert.doesNotThrow(() => repo.deleteHidden(sessionId, 999));
  });
});

describe("reactions upsert", () => {
  test("re-reacting with a different key replaces the session's counted reaction", () => {
    const sessionId = seedSession();
    const postInfo = repo.insertPost({
      sessionId,
      type: "tmi",
      who: "익명의 라쿤",
      text: "hi",
      lat: 0,
      lng: 0,
      radiusM: 50,
      watching: 1,
      createdAt: 0,
    });
    const postId = Number(postInfo.lastInsertRowid);
    repo.upsertReaction(postId, sessionId, "laugh", 1);
    repo.upsertReaction(postId, sessionId, "fire", 2);
    const counts = repo.getReactionCountsByPostId(postId);
    assert.deepEqual(
      counts.map((c) => [c.reaction_key, c.count]),
      [["fire", 1]],
    );
  });
});
