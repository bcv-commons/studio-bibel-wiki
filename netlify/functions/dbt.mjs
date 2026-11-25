// The one server piece of the site: it adds the DBT (Bible Brain) API key, which must not reach the
// browser, to a request for one chapter of a fileset, and passes DBT's answer back unchanged.
//   GET /api/dbt/<fileset>/<BOOK>/<chapter>  ->  https://4.dbt.io/api/bibles/filesets/<fileset>/<BOOK>/<chapter>?v=4
// text_plain filesets answer with the verses; text_json (Sofria) and text_usx with a signed link
// (data[0].path) that the browser fetches itself (DBT's CloudFront allows any origin).
// The key is DBT_API_KEY in the site's Netlify environment (locally: .env, read by netlify dev).
// It answers only requests from the site's own pages (ownPage); the site's one server function.

const API = 'https://4.dbt.io/api';
// (netlify dev, unlike Netlify itself, retries a 404 answer as <path>.html and .htm, so locally
// DBT's 404 for a missing fileset or chapter shows as this function's 400)
const ROUTE = /^\/api\/dbt\/([A-Za-z0-9_-]{1,40})\/([0-9A-Z]{3})\/(\d{1,3})$/;

const json = (status, body, cache = 'no-store') => new Response(JSON.stringify(body), {
	status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache }
});

/** Whether the request comes from this site's own pages. A same-origin GET carries no Origin header,
 *  so the test is Sec-Fetch-Site, which the browser sets and a page cannot; a browser without it is
 *  judged by Origin or Referer. Anything outside a browser can fake these: the check stops other
 *  sites' pages and casual reuse of the key, not a determined script. */
function ownPage(req) {
	const site = req.headers.get('sec-fetch-site');
	if (site) return site === 'same-origin';
	const host = new URL(req.url).host;
	const from = req.headers.get('origin') || req.headers.get('referer');
	try {
		return !!from && new URL(from).host === host;
	} catch {
		return false;
	}
}

export default async (req) => {
	if (req.method !== 'GET') return json(405, { error: 'GET only' });
	if (!ownPage(req)) return json(403, { error: "only for studio.bibel.wiki's own pages" });
	const m = ROUTE.exec(new URL(req.url).pathname);
	if (!m) return json(400, { error: 'expected /api/dbt/<fileset>/<BOOK>/<chapter>' });
	const key = process.env.DBT_API_KEY;
	if (!key) return json(500, { error: 'DBT_API_KEY is not set' });
	const [, fileset, book, chapter] = m;
	const url = `${API}/bibles/filesets/${fileset}/${book}/${chapter}?v=4&key=${encodeURIComponent(key)}`;
	let res;
	try {
		res = await fetch(url, { headers: { Accept: 'application/json' } });
	} catch (e) {
		return json(502, { error: `DBT unreachable: ${e.message}` });
	}
	const body = (await res.text()).replaceAll(key, '');
	// signed links in the answer expire after about a day: an hour of caching is safe
	return new Response(body, {
		status: res.status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': res.ok ? 'public, max-age=3600' : 'no-store' }
	});
};

export const config = { path: '/api/dbt/*' };
