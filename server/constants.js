// src/app.js의 동일 상수를 그대로 미러링한다 (app.js가 export하지 않아 중복 불가피).
export const NICKNAME_TTL_MS = 24 * 60 * 60 * 1000;
export const NICKNAME_CANDIDATES = ["라쿤", "사과", "고양이", "복숭아", "너구리", "두더지", "라임", "새우", "밤", "별", "연필", "봄"];
export const COMPOSE_COOLDOWN_MS = 10000;
export const BAD_WORDS = ["시발", "씨발", "병신", "개새", "좆", "fuck", "shit"];
export const PHONE_PATTERN = /\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const RADIUS_MIN_METERS = 10;
export const RADIUS_MAX_METERS = 200;
export const RADIUS_DEFAULT_METERS = 50;

export const NEARBY_BATCH_SIZE = 50;
export const NEARBY_PAGE_SIZE = 20;
export const NEARBY_SCAN_CEILING = 1000;

export const REACTION_DEFS = [
  { key: "laugh", label: "😂" },
  { key: "fire", label: "🔥" },
  { key: "heart", label: "❤️" },
  { key: "wow", label: "😮" },
  { key: "sad", label: "😢" },
];
export const REACTION_KEYS = new Set(REACTION_DEFS.map((r) => r.key));
