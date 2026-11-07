// Visits, as lines in the server's own log. The free host keeps no disk and restarts after 15 quiet minutes, but its
// log keeps every line for days, so a count is a log search for "visit " or "run started ". A line says what kind of
// page or run it was and whether the visitor looks like a crawler; it never holds an address, a user agent or a
// sentence the maker typed, so nothing in it can name a person.

// Link previews, search engines, uptime checks and scripts: counted, but marked, so people can be told apart.
const CRAWLER = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|whatsapp|curl|wget|python|node-fetch|undici|axios|go-http/i;

/**
 * Which page a path is: one of the three a person opens, or null for scripts, styles, data and the rest.
 * @param {string} path
 * @returns {"home" | "run" | "share" | null}
 */
export function pageKind(path) {
  if (path === "/" || path === "/index.html") return "home";
  if (/^\/run\/[^/]+$/.test(path)) return "run";
  if (/^\/s\/[a-z0-9-]+(\.md)?$/.test(path)) return "share";
  return null;
}

/**
 * @param {string | undefined} userAgent
 * @returns {boolean} true for a crawler, a script, or a request with no user agent at all
 */
export const looksLikeCrawler = (userAgent) => !userAgent || CRAWLER.test(userAgent);

/**
 * The log line for a request, or null when it isn't a page being opened: "visit home", "visit run (crawler)".
 * @param {string} method
 * @param {string} path
 * @param {string | undefined} userAgent
 * @returns {string | null}
 */
export function visitLine(method, path, userAgent) {
  if (method !== "GET") return null;
  const kind = pageKind(path);
  return kind ? `visit ${kind}${looksLikeCrawler(userAgent) ? " (crawler)" : ""}` : null;
}

/**
 * The log line for a run that started: "run started film (showcase london-crime-film)" or "run started reel (typed)".
 * @param {{ format?: string } | undefined} input
 * @param {string} [showcase] the showcase id, when it was one
 * @returns {string}
 */
export function runLine(input, showcase) {
  const format = /^[a-z]+$/.test(input?.format ?? "") ? input.format : "unknown";
  return `run started ${format} (${showcase ? `showcase ${showcase}` : "typed"})`;
}

/**
 * Express middleware: one line per page opened, before the page is served.
 * @param {(line: string) => void} [log]
 */
export const countVisits = (log = (line) => console.log(line)) => (req, _res, next) => {
  const line = visitLine(req.method, req.path, req.get("user-agent"));
  if (line) log(line);
  next();
};
