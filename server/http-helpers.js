export class HttpError extends Error {
  constructor(status, body) {
    super(typeof body === "string" ? body : body?.error ?? "error");
    this.status = status;
    this.body = typeof body === "string" ? { error: body } : body;
  }
}

export const badRequest = (body) => new HttpError(400, body);
export const unauthorized = (body = "unauthorized") => new HttpError(401, body);
export const notFound = (body = "not_found") => new HttpError(404, body);
export const conflict = (body) => new HttpError(409, body);

const MAX_BODY_BYTES = 64 * 1024;

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<any>} 바디가 없으면 {}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(badRequest("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(badRequest("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * @param {import('node:http').ServerResponse} res
 */
export function sendJson(res, status, body) {
  const payload = JSON.stringify(body ?? {});
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}
