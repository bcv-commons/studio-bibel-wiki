// The bibles catalog (bcv-commons/bibles, cdn.bibel.wiki), read in the browser just in time:
// languages, a language's editions with their books and text route, and which of them have a
// bcv-commons alignment (static/data/alignments/<iso>.json, made from the release by npm run data).
import { byChapter } from './text.js';

export const CDN = 'https://cdn.bibel.wiki/';

const cache = new Map();

/** JSON of a URL, fetched once per page visit. A failure is not kept, so trying again fetches again
 *  (after a lost connection, say). */
export function getJson(url) {
	if (!cache.has(url)) {
		cache.set(url, fetch(url).then((r) => {
			if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
			return r.json();
		}).catch((e) => {
			cache.delete(url);
			throw e;
		}));
	}
	return cache.get(url);
}

/** Whether an error is a failed connection (fetch's TypeError), not an answer from a server */
export const offline = (e) => e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);

// a file the catalog does not have counts as empty; a lost connection is an error, not "nothing there"
const orEmpty = (p, empty) => p.catch((e) => {
	if (offline(e)) throw e;
	return empty;
});
const langDir = (iso) => `${CDN}catalog/${iso[0]}/${iso}/`;

/** [{iso, name, own}] of the languages with an aligned edition the site can read, by name */
export async function languages() {
	const [isos, names] = await Promise.all([getJson('/data/languages.json'),
		orEmpty(getJson(`${CDN}dbt/_app/language-names.json`), { l: {} })]);
	return isos.map((iso) => {
		const n = names.l[iso];
		const [name, own] = Array.isArray(n) ? n : [n || iso, null];
		return { iso, name, own: own && own !== name ? own : null };
	}).sort((a, b) => a.name.localeCompare(b.name));
}

/** A text route the site reads: helloAO by chapter, the CDN's own book USJ, or a DBT fileset
 *  (Sofria or plain verses, by chapter through the site's key proxy) */
export const readable = (r) => !!r && (r.route === 'helloao' || ((r.route === 'sofria' || r.route === 'usj') && !!r.path) || byChapter(r));

/** The language's editions the site can read: [{id, short, iso, name, licence, dir, books, route,
 *  base, alignment}], aligned ones first. books: [{code, name, testament, chapters|null}] */
export async function editions(iso) {
	const [books, routes, aligned] = await Promise.all([
		orEmpty(getJson(langDir(iso) + 'books.json'), { entries: {} }),
		orEmpty(getJson(langDir(iso) + 'text-route.json'), { entries: {} }),
		orEmpty(getJson(`/data/alignments/${iso}.json`), {})]);
	const base = routes.base || CDN;
	const ids = new Set([...Object.keys(books.entries || {}),
		...Object.values(routes.entries || {}).flatMap((e) => Object.keys(e))]);
	const out = [];
	for (const id of ids) {
		const route = { ot: routes.entries?.[`${iso}:ot`]?.[id], nt: routes.entries?.[`${iso}:nt`]?.[id] };
		if (!readable(route.ot) && !readable(route.nt)) continue;
		let e = books.entries?.[id];
		let bookList;
		if (e) {
			bookList = e.books.map((b) => ({ code: b.code, name: b.n || b.code, testament: b.t, chapters: b.c ?? null }));
		} else {
			// editions on the CDN (eBible, CrossWire) list their books in their _meta.json
			const path = (route.ot || route.nt).path;
			if (!path) continue; // a DBT edition that books.json does not list: its books are unknown
			const meta = await orEmpty(getJson(`${base}${path}_meta.json`), null);
			if (!meta) continue;
			e = { n: meta.name, license: { licenseUrl: (meta.licenses || []).map((l) => l.type || l.url).filter(Boolean).join(', ') }, dir: meta.direction };
			bookList = (meta.books || []).map((code) => ({ code, name: code, testament: null, chapters: null }));
		}
		const al = aligned[id] || null;
		bookList = bookList.filter((b) => readable(route[b.testament || (NT.has(b.code) ? 'nt' : 'ot')]))
			.map((b) => ({ ...b, testament: b.testament || (NT.has(b.code) ? 'nt' : 'ot'), aligned: !!al && al.books.includes(b.code) }));
		if (!bookList.length) continue;
		out.push({
			id, short: id.slice(id.indexOf(':') + 1), iso, name: e.n || id,
			licence: e.license?.licenseUrl || e.license?.type || e.license?.mark || '', dir: e.dir || 'ltr',
			books: bookList.sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code)),
			route, base, alignment: al
		});
	}
	return out.sort((a, b) => (!!b.alignment - !!a.alignment) || a.name.localeCompare(b.name));
}

export const ORDER = ('GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM '
	+ 'EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH '
	+ '1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV').split(' ');
const NT = new Set(ORDER.slice(ORDER.indexOf('MAT')));
