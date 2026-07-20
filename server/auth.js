import { randomUUID } from "node:crypto";
import { NICKNAME_CANDIDATES, NICKNAME_TTL_MS, SESSION_TTL_MS } from "./constants.js";
import { unauthorized } from "./http-helpers.js";

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {string|null}
 */
export function extractBearerToken(req) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function pickNickname() {
  return NICKNAME_CANDIDATES[Math.floor(Math.random() * NICKNAME_CANDIDATES.length)];
}

/**
 * @param {ReturnType<typeof import('./db.js').openDb>} repo
 * @param {string} [deviceId]
 * @param {string} [locale]
 * @param {number} now
 */
export function createAnonymousSession(repo, { deviceId, locale, now }) {
  const id = `as_${randomUUID()}`;
  const token = randomUUID();
  const nickname = pickNickname();
  repo.insertSession({
    id,
    token,
    deviceId: deviceId ?? null,
    locale: locale ?? null,
    nickname,
    nicknameAssignedAt: now,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return { id, token, nickname, expiresAt: now + SESSION_TTL_MS };
}

/**
 * 토큰으로 세션을 찾고, 만료됐으면 거부, 닉네임 TTL이 지났으면 즉시 재추첨한다.
 * @param {ReturnType<typeof import('./db.js').openDb>} repo
 * @param {string|null} token
 * @param {number} now
 */
export function resolveSession(repo, token, now) {
  if (!token) throw unauthorized("missing_token");
  const session = repo.getSessionByToken(token);
  if (!session) throw unauthorized("invalid_token");
  if (session.expires_at <= now) throw unauthorized("session_expired");

  if (now - session.nickname_assigned_at >= NICKNAME_TTL_MS) {
    const nickname = pickNickname();
    repo.updateSessionNickname(session.id, nickname, now);
    session.nickname = nickname;
    session.nickname_assigned_at = now;
  }
  return session;
}
