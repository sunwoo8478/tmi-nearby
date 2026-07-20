import { createAnonymousSession } from "../auth.js";
import { formatWho } from "../ids.js";

/**
 * POST /api/sessions/anonymous
 */
export async function createAnonymous(ctx) {
  const { repo, now, body } = ctx;
  const session = createAnonymousSession(repo, {
    deviceId: body.deviceId,
    locale: body.locale,
    now,
  });
  return {
    status: 201,
    body: {
      sessionId: session.id,
      token: session.token,
      nickname: formatWho(session.nickname),
      expiresAt: new Date(session.expiresAt).toISOString(),
    },
  };
}
