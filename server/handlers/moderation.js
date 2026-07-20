import { formatId, parseId } from "../ids.js";
import { badRequest, notFound, conflict } from "../http-helpers.js";
import { isUniqueConstraintError } from "../db.js";

function insertReportOrConflict(repo, { sessionId, targetType, targetId, reason, memo, createdAt }) {
  try {
    const info = repo.insertReport({ sessionId, targetType, targetId, reason, memo: memo ?? null, createdAt });
    return formatId("report", Number(info.lastInsertRowid));
  } catch (err) {
    if (isUniqueConstraintError(err)) throw conflict("already_reported");
    throw err;
  }
}

function requireReason(body) {
  const reason = String(body.reason ?? "").trim();
  if (!reason) throw badRequest("reason_required");
  return reason;
}

/**
 * POST /api/posts/:postId/reports
 */
export async function reportPost(ctx) {
  const { repo, session, now, params, body } = ctx;
  const postId = parseId("post", params.postId);
  if (postId == null) throw badRequest("invalid_post_id");
  if (!repo.getPostById(postId)) throw notFound("post_not_found");

  const reason = requireReason(body);
  const reportId = insertReportOrConflict(repo, {
    sessionId: session.id,
    targetType: "post",
    targetId: String(postId),
    reason,
    memo: body.memo,
    createdAt: now,
  });
  return { status: 201, body: { reportId, status: "received" } };
}

/**
 * POST /api/posts/:postId/comments/:commentId/reports
 */
export async function reportComment(ctx) {
  const { repo, session, now, params, body } = ctx;
  const postId = parseId("post", params.postId);
  const commentId = parseId("comment", params.commentId);
  if (postId == null || commentId == null) throw badRequest("invalid_id");
  const comment = repo.getCommentById(commentId);
  if (!comment || comment.post_id !== postId) throw notFound("comment_not_found");

  const reason = requireReason(body);
  const reportId = insertReportOrConflict(repo, {
    sessionId: session.id,
    targetType: "comment",
    targetId: String(commentId),
    reason,
    memo: body.memo,
    createdAt: now,
  });
  return { status: 201, body: { reportId, status: "received" } };
}

/**
 * POST /api/authors/:authorNickname/reports
 */
export async function reportAuthor(ctx) {
  const { repo, session, now, params, body } = ctx;
  const authorNickname = params.authorNickname;
  const reason = requireReason(body);
  const reportId = insertReportOrConflict(repo, {
    sessionId: session.id,
    targetType: "author",
    targetId: authorNickname,
    reason,
    memo: body.memo,
    createdAt: now,
  });
  return { status: 201, body: { reportId, status: "received" } };
}

/**
 * POST /api/posts/:postId/hide
 */
export async function hide(ctx) {
  const { repo, session, now, params } = ctx;
  const postId = parseId("post", params.postId);
  if (postId == null) throw badRequest("invalid_post_id");
  if (!repo.getPostById(postId)) throw notFound("post_not_found");

  repo.insertHidden(session.id, postId, now);
  return { status: 200, body: { postId: formatId("post", postId), hidden: true } };
}

/**
 * DELETE /api/posts/:postId/hide
 */
export async function unhide(ctx) {
  const { repo, session, params } = ctx;
  const postId = parseId("post", params.postId);
  if (postId == null) throw badRequest("invalid_post_id");

  repo.deleteHidden(session.id, postId);
  return { status: 200, body: { postId: formatId("post", postId), hidden: false } };
}

/**
 * POST /api/posts/:postId/block-author
 * 요청 바디의 authorNickname이 아니라, 실제 게시물 소유자(post.who)를 기준으로 차단한다
 * (클라이언트가 postId와 무관한 닉네임을 보내는 걸 막기 위함).
 */
export async function block(ctx) {
  const { repo, session, now, params } = ctx;
  const postId = parseId("post", params.postId);
  if (postId == null) throw badRequest("invalid_post_id");
  const post = repo.getPostById(postId);
  if (!post) throw notFound("post_not_found");

  repo.insertBlockedAuthor(session.id, post.who, now);
  return { status: 200, body: { authorNickname: post.who, blocked: true } };
}

/**
 * DELETE /api/sessions/me/blocked-authors/:authorNickname
 */
export async function unblock(ctx) {
  const { repo, session, params } = ctx;
  const authorNickname = params.authorNickname;
  repo.deleteBlockedAuthor(session.id, authorNickname);
  return { status: 200, body: { authorNickname, blocked: false } };
}
