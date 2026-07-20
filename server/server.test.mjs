import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "./index.js";
import { NICKNAME_TTL_MS } from "./constants.js";

/** @type {import('node:http').Server} */
let server;
let baseUrl;

before(async () => {
  server = createServer({ dbPath: ":memory:" });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  return { status: res.status, json };
}

async function newSession() {
  const { json } = await api("/api/sessions/anonymous", { method: "POST", body: { locale: "ko-KR" } });
  return json;
}

describe("sessions", () => {
  test("issues an anonymous session with a formatted nickname", async () => {
    const { status, json } = await api("/api/sessions/anonymous", { method: "POST", body: {} });
    assert.equal(status, 201);
    assert.match(json.sessionId, /^as_/);
    assert.ok(json.token);
    assert.match(json.nickname, /^익명의 /);
    assert.ok(new Date(json.expiresAt).getTime() > Date.now());
  });
});

describe("auth", () => {
  test("missing token on an authed route returns 401", async () => {
    const { status } = await api("/api/posts/nearby?lat=0&lng=0");
    assert.equal(status, 401);
  });

  test("garbage token returns 401", async () => {
    const { status } = await api("/api/posts/nearby?lat=0&lng=0", { token: "not-a-real-token" });
    assert.equal(status, 401);
  });

  test("unknown route returns 404", async () => {
    const { status } = await api("/api/does/not/exist");
    assert.equal(status, 404);
  });

  test("malformed JSON body returns 400", async () => {
    // 인증이 필요 없는 라우트로 보내서 401이 아니라 순수 바디 파싱 실패(400)를 확인한다.
    const res = await fetch(`${baseUrl}/api/sessions/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    });
    assert.equal(res.status, 400);
  });
});

describe("posts + nearby feed", () => {
  test("create tmi post then find it in the nearby feed", async () => {
    const session = await newSession();
    const created = await api("/api/posts", {
      method: "POST",
      token: session.token,
      body: { type: "tmi", text: "테스트 게시물", lat: 37.5665, lng: 126.978, radiusM: 50 },
    });
    assert.equal(created.status, 201);
    assert.match(created.json.id, /^post_/);
    assert.equal(created.json.distance, "0m");

    const feed = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: session.token });
    assert.equal(feed.status, 200);
    assert.ok(feed.json.items.some((item) => item.id === created.json.id));
  });

  test("posts far outside radiusM are excluded from the feed", async () => {
    const session = await newSession();
    await api("/api/posts", {
      method: "POST",
      token: session.token,
      body: { type: "tmi", text: "먼 곳 게시물", lat: 0, lng: 0, radiusM: 50 },
    });
    const feed = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: session.token });
    assert.equal(feed.json.items.some((item) => item.text === "먼 곳 게시물"), false);
  });

  test("rejects a post containing a banned word", async () => {
    const session = await newSession();
    const res = await api("/api/posts", {
      method: "POST",
      token: session.token,
      body: { type: "tmi", text: "이 씨발 뭐야", lat: 0, lng: 0, radiusM: 50 },
    });
    assert.equal(res.status, 400);
  });

  test("rejects a post containing a phone number", async () => {
    const session = await newSession();
    const res = await api("/api/posts", {
      method: "POST",
      token: session.token,
      body: { type: "tmi", text: "010-1234-5678로 연락줘", lat: 0, lng: 0, radiusM: 50 },
    });
    assert.equal(res.status, 400);
  });

  test("rapid second post within the cooldown window is rejected with 429", async () => {
    const session = await newSession();
    const first = await api("/api/posts", {
      method: "POST",
      token: session.token,
      body: { type: "tmi", text: "첫 글", lat: 0, lng: 0, radiusM: 50 },
    });
    assert.equal(first.status, 201);
    const second = await api("/api/posts", {
      method: "POST",
      token: session.token,
      body: { type: "tmi", text: "바로 이어 쓴 글", lat: 0, lng: 0, radiusM: 50 },
    });
    assert.equal(second.status, 429);
  });

  test("unauthenticated create is rejected", async () => {
    const res = await api("/api/posts", { method: "POST", body: { type: "tmi", text: "x", lat: 0, lng: 0 } });
    assert.equal(res.status, 401);
  });
});

describe("comments", () => {
  test("create and list comments, attributed to the caller's nickname", async () => {
    const author = await newSession();
    const created = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "댓글 달릴 글", lat: 0, lng: 0, radiusM: 50 },
    });

    const commenter = await newSession();
    const comment = await api(`/api/posts/${created.json.id}/comments`, {
      method: "POST",
      token: commenter.token,
      body: { text: "첫 댓글" },
    });
    assert.equal(comment.status, 201);
    assert.equal(comment.json.who, commenter.nickname);

    const list = await api(`/api/posts/${created.json.id}/comments`, { token: author.token });
    assert.equal(list.status, 200);
    assert.equal(list.json.items.length, 1);
    assert.equal(list.json.items[0].text, "첫 댓글");
  });

  test("comment on a non-existent post returns 404", async () => {
    const session = await newSession();
    const res = await api("/api/posts/post_999999/comments", {
      method: "POST",
      token: session.token,
      body: { text: "hi" },
    });
    assert.equal(res.status, 404);
  });
});

describe("reactions", () => {
  test("reacting returns updated counts, and re-reacting swaps the session's counted key", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "반응 테스트", lat: 0, lng: 0, radiusM: 50 },
    });

    const first = await api(`/api/posts/${post.json.id}/reactions`, {
      method: "POST",
      token: author.token,
      body: { key: "laugh" },
    });
    assert.equal(first.status, 200);
    assert.deepEqual(
      first.json.reactions.map((r) => r.key),
      ["laugh"],
    );

    const second = await api(`/api/posts/${post.json.id}/reactions`, {
      method: "POST",
      token: author.token,
      body: { key: "fire" },
    });
    assert.deepEqual(
      second.json.reactions.map((r) => r.key),
      ["fire"],
    );
  });

  test("unknown reaction key is rejected", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "반응 테스트2", lat: 0, lng: 0, radiusM: 50 },
    });
    const res = await api(`/api/posts/${post.json.id}/reactions`, {
      method: "POST",
      token: author.token,
      body: { key: "not-a-real-key" },
    });
    assert.equal(res.status, 400);
  });
});

describe("votes", () => {
  test("first vote succeeds, second vote from the same session is rejected with 409", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: {
        type: "vote",
        text: "카페 자리 vs 음료",
        lat: 0,
        lng: 0,
        radiusM: 50,
        options: [{ label: "자리 옮기기" }, { label: "음료 하나 더" }],
      },
    });
    assert.equal(post.status, 201);
    const optionId = post.json.options[0].id;

    const voter = await newSession();
    const firstVote = await api(`/api/posts/${post.json.id}/votes`, {
      method: "POST",
      token: voter.token,
      body: { optionId },
    });
    assert.equal(firstVote.status, 200);
    assert.equal(firstVote.json.votedOptionId, optionId);
    assert.equal(
      firstVote.json.options.find((o) => o.id === optionId).count,
      1,
    );

    const secondVote = await api(`/api/posts/${post.json.id}/votes`, {
      method: "POST",
      token: voter.token,
      body: { optionId: post.json.options[1].id },
    });
    assert.equal(secondVote.status, 409);
  });

  test("voting on a tmi (non-vote) post is rejected", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "투표 아님", lat: 0, lng: 0, radiusM: 50 },
    });
    const res = await api(`/api/posts/${post.json.id}/votes`, {
      method: "POST",
      token: author.token,
      body: { optionId: "option_1" },
    });
    assert.equal(res.status, 400);
  });
});

describe("reports", () => {
  test("post/comment/author reports succeed once, duplicates return 409", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "신고 테스트", lat: 0, lng: 0, radiusM: 50 },
    });
    const comment = await api(`/api/posts/${post.json.id}/comments`, {
      method: "POST",
      token: author.token,
      body: { text: "신고할 댓글" },
    });

    const reporter = await newSession();

    const reportPost1 = await api(`/api/posts/${post.json.id}/reports`, {
      method: "POST",
      token: reporter.token,
      body: { reason: "spam" },
    });
    assert.equal(reportPost1.status, 201);
    const reportPost2 = await api(`/api/posts/${post.json.id}/reports`, {
      method: "POST",
      token: reporter.token,
      body: { reason: "spam again" },
    });
    assert.equal(reportPost2.status, 409);

    const reportComment1 = await api(`/api/posts/${post.json.id}/comments/${comment.json.id}/reports`, {
      method: "POST",
      token: reporter.token,
      body: { reason: "spam" },
    });
    assert.equal(reportComment1.status, 201);

    const reportAuthor1 = await api(`/api/authors/${encodeURIComponent(author.nickname)}/reports`, {
      method: "POST",
      token: reporter.token,
      body: { reason: "spam" },
    });
    assert.equal(reportAuthor1.status, 201);
    const reportAuthor2 = await api(`/api/authors/${encodeURIComponent(author.nickname)}/reports`, {
      method: "POST",
      token: reporter.token,
      body: { reason: "again" },
    });
    assert.equal(reportAuthor2.status, 409);
  });

  test("report without a reason is rejected", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "신고 사유 없음 테스트", lat: 0, lng: 0, radiusM: 50 },
    });
    const res = await api(`/api/posts/${post.json.id}/reports`, {
      method: "POST",
      token: author.token,
      body: {},
    });
    assert.equal(res.status, 400);
  });
});

describe("hide / unhide", () => {
  test("hiding a post removes it from that session's own feed; unhiding restores it", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "숨김 테스트", lat: 37.5665, lng: 126.978, radiusM: 50 },
    });

    const viewer = await newSession();
    const feedInitial = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: viewer.token });
    assert.ok(feedInitial.json.items.some((i) => i.id === post.json.id));

    const hideRes = await api(`/api/posts/${post.json.id}/hide`, { method: "POST", token: viewer.token });
    assert.deepEqual(hideRes.json, { postId: post.json.id, hidden: true });

    const feedAfterHide = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: viewer.token });
    assert.equal(feedAfterHide.json.items.some((i) => i.id === post.json.id), false);

    // 다른 세션(작성자)의 피드에는 여전히 보여야 한다 — 숨김은 세션 스코프.
    const feedForAuthor = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: author.token });
    assert.ok(feedForAuthor.json.items.some((i) => i.id === post.json.id));

    const unhideRes = await api(`/api/posts/${post.json.id}/hide`, { method: "DELETE", token: viewer.token });
    assert.deepEqual(unhideRes.json, { postId: post.json.id, hidden: false });
    const feedAfterUnhide = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: viewer.token });
    assert.ok(feedAfterUnhide.json.items.some((i) => i.id === post.json.id));
  });

  test("unhiding a post that was never hidden is a no-op success", async () => {
    const session = await newSession();
    const res = await api(`/api/posts/post_1/hide`, { method: "DELETE", token: session.token });
    assert.equal(res.status, 200);
  });
});

describe("block / unblock", () => {
  test("blocking an author removes all of their posts from the session's feed; unblocking restores them", async () => {
    const author = await newSession();
    const post = await api("/api/posts", {
      method: "POST",
      token: author.token,
      body: { type: "tmi", text: "차단 테스트", lat: 37.5665, lng: 126.978, radiusM: 50 },
    });

    const viewer = await newSession();
    const blockRes = await api(`/api/posts/${post.json.id}/block-author`, { method: "POST", token: viewer.token });
    assert.equal(blockRes.status, 200);
    assert.equal(blockRes.json.authorNickname, author.nickname);
    assert.equal(blockRes.json.blocked, true);

    const feedAfterBlock = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: viewer.token });
    assert.equal(feedAfterBlock.json.items.some((i) => i.who === author.nickname), false);

    const unblockRes = await api(`/api/sessions/me/blocked-authors/${encodeURIComponent(author.nickname)}`, {
      method: "DELETE",
      token: viewer.token,
    });
    assert.deepEqual(unblockRes.json, { authorNickname: author.nickname, blocked: false });

    const feedAfterUnblock = await api(`/api/posts/nearby?lat=37.5665&lng=126.978&radiusM=50`, { token: viewer.token });
    assert.ok(feedAfterUnblock.json.items.some((i) => i.id === post.json.id));
  });
});

describe("nickname rotation", () => {
  test("nickname re-rolls once the 24h TTL has elapsed", async () => {
    const session = await newSession();
    // 세션의 nickname_assigned_at을 과거로 되돌려 TTL 만료를 시뮬레이션한다 (실제 대기 없이).
    const past = Date.now() - NICKNAME_TTL_MS - 1000;
    const repo = server.__repoForTests;
    assert.ok(repo, "test hook __repoForTests must be exposed by createServer");
    const before = repo.getSessionByToken(session.token);
    repo.updateSessionNickname(before.id, before.nickname, past);

    const res = await api("/api/posts", {
      method: "POST",
      token: session.token,
      body: { type: "tmi", text: "닉네임 회전 확인용", lat: 0, lng: 0, radiusM: 50 },
    });
    assert.equal(res.status, 201);
    const after = repo.getSessionByToken(session.token);
    assert.ok(after.nickname_assigned_at > past, "nickname_assigned_at should be refreshed after TTL expiry");
  });
});
