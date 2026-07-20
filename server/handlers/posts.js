import { haversineDistanceMeters, formatDistanceMeters } from "../../src/geo.js";
import { formatId, parseId, formatWho } from "../ids.js";
import { badRequest, notFound, conflict } from "../http-helpers.js";
import { isUniqueConstraintError } from "../db.js";
import { assertCleanText, assertCooldownElapsed, clampRadius } from "../validation.js";
import {
  RADIUS_DEFAULT_METERS,
  NEARBY_BATCH_SIZE,
  NEARBY_PAGE_SIZE,
  NEARBY_SCAN_CEILING,
  REACTION_DEFS,
  REACTION_KEYS,
} from "../constants.js";

const REACTION_LABEL_BY_KEY = new Map(REACTION_DEFS.map((r) => [r.key, r.label]));

function encodeCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString("base64url");
}

function decodeCursor(raw) {
  try {
    const { createdAt, id } = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof createdAt !== "number" || typeof id !== "number") return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function reactionsForPost(repo, postId) {
  const counts = repo.getReactionCountsByPostId(postId);
  return counts
    .map((row) => ({ key: row.reaction_key, label: REACTION_LABEL_BY_KEY.get(row.reaction_key) ?? "", count: row.count }))
    .sort((a, b) => b.count - a.count);
}

function voteOptionsForPost(repo, postId) {
  const options = repo.getVoteOptionsByPostId(postId);
  const counts = new Map(repo.getVoteCountsByPost(postId).map((row) => [row.option_id, row.count]));
  const total = [...counts.values()].reduce((sum, c) => sum + c, 0);
  return options.map((opt) => {
    const count = counts.get(opt.id) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { id: formatId("option", opt.id), label: opt.label, pct, count };
  });
}

/**
 * GET /api/posts/nearby?lat=&lng=&radiusM=&cursor=
 */
export async function listNearby(ctx) {
  const { repo, session, query } = ctx;
  const lat = Number(query.get("lat"));
  const lng = Number(query.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest("lat_lng_required");
  const radiusM = clampRadius(query.get("radiusM") ?? RADIUS_DEFAULT_METERS);

  const rawCursor = query.get("cursor");
  let cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) throw badRequest("invalid_cursor");

  const items = [];
  let scanned = 0;
  let exhausted = false;
  let lastRow = null;

  while (items.length < NEARBY_PAGE_SIZE && scanned < NEARBY_SCAN_CEILING) {
    const batch = repo.getNearbyBatch({
      sessionId: session.id,
      beforeCreatedAt: cursor?.createdAt,
      beforeId: cursor?.id,
      limit: NEARBY_BATCH_SIZE,
    });
    if (batch.length === 0) {
      exhausted = true;
      break;
    }
    for (const row of batch) {
      scanned++;
      lastRow = row;
      const distanceMeters = haversineDistanceMeters(lat, lng, row.lat, row.lng);
      if (distanceMeters <= radiusM) {
        items.push({
          id: formatId("post", row.id),
          type: row.type,
          who: row.who,
          distance: formatDistanceMeters(distanceMeters),
          text: row.text,
          commentsCount: repo.getCommentsByPostId(row.id).length,
          reactions: reactionsForPost(repo, row.id),
          watching: row.watching,
          createdAt: new Date(row.created_at).toISOString(),
          ...(row.type === "vote" ? { options: voteOptionsForPost(repo, row.id) } : {}),
        });
      }
      if (items.length >= NEARBY_PAGE_SIZE) break;
    }
    cursor = lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : cursor;
    if (batch.length < NEARBY_BATCH_SIZE) {
      exhausted = true;
      break;
    }
  }

  const nextCursor = exhausted || !lastRow ? null : encodeCursor(lastRow.created_at, lastRow.id);
  return { status: 200, body: { items, nextCursor } };
}

/**
 * POST /api/posts
 */
export async function create(ctx) {
  const { repo, session, now, body } = ctx;
  if (body.type !== "tmi" && body.type !== "vote") throw badRequest("invalid_type");
  const text = String(body.text ?? "").trim();
  if (!text) throw badRequest("text_required");
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest("lat_lng_required");

  assertCooldownElapsed(session.last_post_at, now);
  assertCleanText(text);

  let optionLabels = [];
  if (body.type === "vote") {
    if (!Array.isArray(body.options) || body.options.length < 2) throw badRequest("options_required");
    optionLabels = body.options.map((o) => String(o?.label ?? "").trim());
    if (optionLabels.some((label) => !label)) throw badRequest("option_label_required");
    optionLabels.forEach(assertCleanText);
  }

  const radiusM = clampRadius(body.radiusM ?? RADIUS_DEFAULT_METERS);
  const watching = 5 + Math.floor(Math.random() * 30);
  const createdAt = now;
  const who = formatWho(session.nickname);

  const info = repo.insertPost({
    sessionId: session.id,
    type: body.type,
    who,
    text,
    lat,
    lng,
    radiusM,
    watching,
    createdAt,
  });
  const postId = Number(info.lastInsertRowid);

  if (body.type === "vote") {
    optionLabels.forEach((label, index) => repo.insertVoteOption(postId, label, index));
  }
  repo.touchLastPostAt(session.id, now);

  return {
    status: 201,
    body: {
      id: formatId("post", postId),
      type: body.type,
      who,
      distance: "0m",
      text,
      createdAt: new Date(createdAt).toISOString(),
      ...(body.type === "vote" ? { options: voteOptionsForPost(repo, postId) } : {}),
    },
  };
}

function requirePost(repo, postIdParam) {
  const postId = parseId("post", postIdParam);
  if (postId == null) throw badRequest("invalid_post_id");
  const post = repo.getPostById(postId);
  if (!post) throw notFound("post_not_found");
  return { postId, post };
}

/**
 * GET /api/posts/:postId/comments
 */
export async function listComments(ctx) {
  const { repo, params } = ctx;
  const { postId } = requirePost(repo, params.postId);
  const items = repo.getCommentsByPostId(postId).map((row) => ({
    id: formatId("comment", row.id),
    who: row.who,
    text: row.text,
    createdAt: new Date(row.created_at).toISOString(),
  }));
  return { status: 200, body: { items } };
}

/**
 * POST /api/posts/:postId/comments
 */
export async function createComment(ctx) {
  const { repo, session, now, params, body } = ctx;
  const { postId } = requirePost(repo, params.postId);
  const text = String(body.text ?? "").trim();
  if (!text) throw badRequest("text_required");

  assertCooldownElapsed(session.last_comment_at, now);
  assertCleanText(text);

  const who = formatWho(session.nickname);
  const info = repo.insertComment(postId, session.id, who, text, now);
  repo.touchLastCommentAt(session.id, now);

  return {
    status: 201,
    body: { id: formatId("comment", Number(info.lastInsertRowid)), who, text, createdAt: new Date(now).toISOString() },
  };
}

/**
 * POST /api/posts/:postId/reactions
 */
export async function react(ctx) {
  const { repo, session, now, params, body } = ctx;
  const { postId } = requirePost(repo, params.postId);
  const key = String(body.key ?? "");
  if (!REACTION_KEYS.has(key)) throw badRequest("invalid_reaction_key");

  repo.upsertReaction(postId, session.id, key, now);
  return { status: 200, body: { postId: formatId("post", postId), reactions: reactionsForPost(repo, postId) } };
}

/**
 * POST /api/posts/:postId/votes
 */
export async function vote(ctx) {
  const { repo, session, now, params, body } = ctx;
  const { postId, post } = requirePost(repo, params.postId);
  if (post.type !== "vote") throw badRequest("not_a_vote_post");

  const optionId = parseId("option", body.optionId);
  if (optionId == null) throw badRequest("invalid_option_id");
  const option = repo.getVoteOptionById(optionId);
  if (!option || option.post_id !== postId) throw badRequest("option_not_found_for_post");

  try {
    repo.insertVote(postId, optionId, session.id, now);
  } catch (err) {
    if (isUniqueConstraintError(err)) throw conflict("already_voted");
    throw err;
  }

  return {
    status: 200,
    body: {
      postId: formatId("post", postId),
      options: voteOptionsForPost(repo, postId),
      votedOptionId: formatId("option", optionId),
    },
  };
}
