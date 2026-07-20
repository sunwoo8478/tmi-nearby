import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  device_id TEXT,
  locale TEXT,
  nickname TEXT NOT NULL,
  nickname_assigned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_post_at INTEGER NOT NULL DEFAULT 0,
  last_comment_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL CHECK (type IN ('tmi','vote')),
  who TEXT NOT NULL,
  text TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_m INTEGER NOT NULL,
  watching INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS vote_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_vote_options_post ON vote_options(post_id);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  option_id INTEGER NOT NULL REFERENCES vote_options(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  created_at INTEGER NOT NULL,
  UNIQUE (post_id, session_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  who TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS reactions (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  reaction_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, session_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','author')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  memo TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS hidden (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  post_id INTEGER NOT NULL REFERENCES posts(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, post_id)
);

CREATE TABLE IF NOT EXISTS blocked_authors (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  author_nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, author_nickname)
);
`;

export const SQLITE_CONSTRAINT_ERRCODE = 2067;

export function isUniqueConstraintError(err) {
  return err && err.code === "ERR_SQLITE_ERROR" && err.errcode === SQLITE_CONSTRAINT_ERRCODE;
}

/**
 * @param {string} dbPath ":memory:" 또는 파일 경로
 */
export function openDb(dbPath) {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  const stmt = (sql) => db.prepare(sql);

  const insertSession = stmt(
    `INSERT INTO sessions (id, token, device_id, locale, nickname, nickname_assigned_at, created_at, expires_at)
     VALUES (@id, @token, @deviceId, @locale, @nickname, @nicknameAssignedAt, @createdAt, @expiresAt)`,
  );
  const getSessionByToken = stmt(`SELECT * FROM sessions WHERE token = ?`);
  const updateSessionNickname = stmt(
    `UPDATE sessions SET nickname = ?, nickname_assigned_at = ? WHERE id = ?`,
  );
  const touchLastPostAt = stmt(`UPDATE sessions SET last_post_at = ? WHERE id = ?`);
  const touchLastCommentAt = stmt(`UPDATE sessions SET last_comment_at = ? WHERE id = ?`);

  const insertPost = stmt(
    `INSERT INTO posts (session_id, type, who, text, lat, lng, radius_m, watching, created_at)
     VALUES (@sessionId, @type, @who, @text, @lat, @lng, @radiusM, @watching, @createdAt)`,
  );
  const getPostById = stmt(`SELECT * FROM posts WHERE id = ?`);
  const insertVoteOption = stmt(
    `INSERT INTO vote_options (post_id, label, sort_order) VALUES (?, ?, ?)`,
  );
  const getVoteOptionsByPostId = stmt(
    `SELECT * FROM vote_options WHERE post_id = ? ORDER BY sort_order ASC, id ASC`,
  );
  const getVoteOptionById = stmt(`SELECT * FROM vote_options WHERE id = ?`);

  const insertVote = stmt(
    `INSERT INTO votes (post_id, option_id, session_id, created_at) VALUES (?, ?, ?, ?)`,
  );
  const getVoteCountsByPost = stmt(
    `SELECT option_id, COUNT(*) AS count FROM votes WHERE post_id = ? GROUP BY option_id`,
  );
  const getSessionVoteForPost = stmt(
    `SELECT * FROM votes WHERE post_id = ? AND session_id = ?`,
  );

  const insertComment = stmt(
    `INSERT INTO comments (post_id, session_id, who, text, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const getCommentsByPostId = stmt(
    `SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC, id ASC`,
  );
  const getCommentById = stmt(`SELECT * FROM comments WHERE id = ?`);

  const upsertReaction = stmt(
    `INSERT INTO reactions (post_id, session_id, reaction_key, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (post_id, session_id) DO UPDATE SET reaction_key = excluded.reaction_key, created_at = excluded.created_at`,
  );
  const getReactionCountsByPostId = stmt(
    `SELECT reaction_key, COUNT(*) AS count FROM reactions WHERE post_id = ? GROUP BY reaction_key`,
  );

  const insertReport = stmt(
    `INSERT INTO reports (session_id, target_type, target_id, reason, memo, created_at)
     VALUES (@sessionId, @targetType, @targetId, @reason, @memo, @createdAt)`,
  );

  const insertHidden = stmt(
    `INSERT OR IGNORE INTO hidden (session_id, post_id, created_at) VALUES (?, ?, ?)`,
  );
  const deleteHidden = stmt(`DELETE FROM hidden WHERE session_id = ? AND post_id = ?`);

  const insertBlockedAuthor = stmt(
    `INSERT OR IGNORE INTO blocked_authors (session_id, author_nickname, created_at) VALUES (?, ?, ?)`,
  );
  const deleteBlockedAuthor = stmt(
    `DELETE FROM blocked_authors WHERE session_id = ? AND author_nickname = ?`,
  );

  const getNearbyBatch = stmt(`
    SELECT p.* FROM posts p
    WHERE NOT EXISTS (SELECT 1 FROM hidden h WHERE h.session_id = @sessionId AND h.post_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM blocked_authors b WHERE b.session_id = @sessionId AND b.author_nickname = p.who
      )
      AND (@hasCursor = 0 OR p.created_at < @beforeCreatedAt
           OR (p.created_at = @beforeCreatedAt AND p.id < @beforeId))
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT @limit
  `);

  return {
    db,
    insertSession: (row) => insertSession.run(row),
    getSessionByToken: (token) => getSessionByToken.get(token) ?? null,
    updateSessionNickname: (sessionId, nickname, nicknameAssignedAt) =>
      updateSessionNickname.run(nickname, nicknameAssignedAt, sessionId),
    touchLastPostAt: (sessionId, now) => touchLastPostAt.run(now, sessionId),
    touchLastCommentAt: (sessionId, now) => touchLastCommentAt.run(now, sessionId),

    insertPost: (row) => insertPost.run(row),
    getPostById: (id) => getPostById.get(id) ?? null,
    insertVoteOption: (postId, label, sortOrder) => insertVoteOption.run(postId, label, sortOrder),
    getVoteOptionsByPostId: (postId) => getVoteOptionsByPostId.all(postId),
    getVoteOptionById: (id) => getVoteOptionById.get(id) ?? null,

    insertVote: (postId, optionId, sessionId, createdAt) =>
      insertVote.run(postId, optionId, sessionId, createdAt),
    getVoteCountsByPost: (postId) => getVoteCountsByPost.all(postId),
    getSessionVoteForPost: (postId, sessionId) =>
      getSessionVoteForPost.get(postId, sessionId) ?? null,

    insertComment: (postId, sessionId, who, text, createdAt) =>
      insertComment.run(postId, sessionId, who, text, createdAt),
    getCommentsByPostId: (postId) => getCommentsByPostId.all(postId),
    getCommentById: (id) => getCommentById.get(id) ?? null,

    upsertReaction: (postId, sessionId, reactionKey, createdAt) =>
      upsertReaction.run(postId, sessionId, reactionKey, createdAt),
    getReactionCountsByPostId: (postId) => getReactionCountsByPostId.all(postId),

    insertReport: (row) => insertReport.run(row),

    insertHidden: (sessionId, postId, createdAt) => insertHidden.run(sessionId, postId, createdAt),
    deleteHidden: (sessionId, postId) => deleteHidden.run(sessionId, postId),

    insertBlockedAuthor: (sessionId, authorNickname, createdAt) =>
      insertBlockedAuthor.run(sessionId, authorNickname, createdAt),
    deleteBlockedAuthor: (sessionId, authorNickname) =>
      deleteBlockedAuthor.run(sessionId, authorNickname),

    getNearbyBatch: ({ sessionId, beforeCreatedAt, beforeId, limit }) =>
      getNearbyBatch.all({
        sessionId,
        hasCursor: beforeCreatedAt == null ? 0 : 1,
        beforeCreatedAt: beforeCreatedAt ?? 0,
        beforeId: beforeId ?? 0,
        limit,
      }),

    close: () => db.close(),
  };
}
