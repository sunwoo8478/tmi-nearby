import { containsBadWord, containsPhoneNumber, containsLocationHint, getComposeCooldownRemainingMs } from "../src/utils.js";
import { BAD_WORDS, PHONE_PATTERN, COMPOSE_COOLDOWN_MS, RADIUS_MIN_METERS, RADIUS_MAX_METERS } from "./constants.js";
import { badRequest, HttpError } from "./http-helpers.js";

/**
 * 게시물/댓글/투표 옵션 텍스트에 금지어·전화번호·위치 특정 표현이 있으면 예외를 던진다.
 * @param {string} text
 */
export function assertCleanText(text) {
  if (containsBadWord(text, BAD_WORDS)) throw badRequest("contains_bad_word");
  if (containsPhoneNumber(text, PHONE_PATTERN)) throw badRequest("contains_phone_number");
  if (containsLocationHint(text)) throw badRequest("contains_location_hint");
}

/**
 * @param {number} radiusM
 * @returns {number} 허용 범위로 clamp된 값
 */
export function clampRadius(radiusM) {
  const n = Number(radiusM);
  if (!Number.isFinite(n)) return RADIUS_MIN_METERS;
  return Math.min(RADIUS_MAX_METERS, Math.max(RADIUS_MIN_METERS, n));
}

/**
 * @param {number} lastActionAt
 * @param {number} now
 * @throws {HttpError} 429, 남은 ms를 body에 포함
 */
export function assertCooldownElapsed(lastActionAt, now) {
  const remainingMs = getComposeCooldownRemainingMs(lastActionAt, now, COMPOSE_COOLDOWN_MS);
  if (remainingMs > 0) {
    throw new HttpError(429, { error: "cooldown", remainingMs });
  }
}
