/**
 * @typedef {object} Route
 * @property {string} method
 * @property {string} pattern
 * @property {boolean} auth
 * @property {(ctx: object) => Promise<{status:number, body:any}>} handler
 */

function splitPath(pattern) {
  return pattern.split("/").filter(Boolean);
}

/**
 * @param {Route[]} routes
 * @param {string} method
 * @param {string} pathname
 * @returns {{route: Route, params: Record<string,string>} | null}
 */
export function matchRoute(routes, method, pathname) {
  const pathSegments = splitPath(pathname);
  for (const route of routes) {
    if (route.method !== method) continue;
    const patternSegments = splitPath(route.pattern);
    if (patternSegments.length !== pathSegments.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const p = patternSegments[i];
      const s = pathSegments[i];
      if (p.startsWith(":")) {
        params[p.slice(1)] = decodeURIComponent(s);
      } else if (p !== s) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}
