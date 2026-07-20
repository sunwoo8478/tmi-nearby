import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { matchRoute } from "./router.js";
import { resolveSession } from "./auth.js";
import { readJsonBody, sendJson, HttpError } from "./http-helpers.js";
import * as sessions from "./handlers/sessions.js";
import * as posts from "./handlers/posts.js";
import * as moderation from "./handlers/moderation.js";

/** @type {import('./router.js').Route[]} */
const ROUTES = [
  { method: "POST", pattern: "/api/sessions/anonymous", auth: false, handler: sessions.createAnonymous },
  { method: "GET", pattern: "/api/posts/nearby", auth: true, handler: posts.listNearby },
  { method: "POST", pattern: "/api/posts", auth: true, handler: posts.create },
  { method: "GET", pattern: "/api/posts/:postId/comments", auth: true, handler: posts.listComments },
  { method: "POST", pattern: "/api/posts/:postId/comments", auth: true, handler: posts.createComment },
  { method: "POST", pattern: "/api/posts/:postId/reactions", auth: true, handler: posts.react },
  { method: "POST", pattern: "/api/posts/:postId/votes", auth: true, handler: posts.vote },
  { method: "POST", pattern: "/api/posts/:postId/reports", auth: true, handler: moderation.reportPost },
  {
    method: "POST",
    pattern: "/api/posts/:postId/comments/:commentId/reports",
    auth: true,
    handler: moderation.reportComment,
  },
  { method: "POST", pattern: "/api/authors/:authorNickname/reports", auth: true, handler: moderation.reportAuthor },
  { method: "POST", pattern: "/api/posts/:postId/hide", auth: true, handler: moderation.hide },
  { method: "DELETE", pattern: "/api/posts/:postId/hide", auth: true, handler: moderation.unhide },
  { method: "POST", pattern: "/api/posts/:postId/block-author", auth: true, handler: moderation.block },
  {
    method: "DELETE",
    pattern: "/api/sessions/me/blocked-authors/:authorNickname",
    auth: true,
    handler: moderation.unblock,
  },
];

/**
 * @param {{dbPath: string}} options
 * @returns {import('node:http').Server}
 */
export function createServer({ dbPath }) {
  const repo = openDb(dbPath);

  const server = createHttpServer(async (req, res) => {
    const now = Date.now();
    try {
      const url = new URL(req.url, "http://localhost");
      const match = matchRoute(ROUTES, req.method, url.pathname);
      if (!match) throw new HttpError(404, "not_found");
      const { route, params } = match;

      let session = null;
      if (route.auth) {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
        session = resolveSession(repo, token, now);
      }

      const body = req.method === "GET" || req.method === "DELETE" ? {} : await readJsonBody(req);
      const ctx = { req, res, params, query: url.searchParams, body, session, now, repo };

      const result = await route.handler(ctx);
      sendJson(res, result.status, result.body);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, err.body);
      } else {
        console.error(err);
        sendJson(res, 500, { error: "internal_error" });
      }
    }
  });

  // 테스트 전용 훅 — 프로덕션 코드에서는 사용하지 않는다.
  server.__repoForTests = repo;

  server.close = ((originalClose) =>
    function patchedClose(...args) {
      repo.close();
      return originalClose.apply(server, args);
    })(server.close.bind(server));

  return server;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  const dbPath = process.env.TMI_DB_PATH ?? fileURLToPath(new URL("./data/app.sqlite3", import.meta.url));
  const server = createServer({ dbPath });
  server.listen(port, () => {
    console.log(`tmi-nearby backend listening on http://localhost:${port} (db: ${dbPath})`);
  });
}
