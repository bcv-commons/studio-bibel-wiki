// Texts entered by hand, with their own alignment: import/<project>/<book><ccc>.txt and .align, served
// by the local dev server only (scripts/import-texts.mjs). A project is shown as one more edition,
// read a chapter at a time like DBT, and its alignment is handed to the library as a full-alignments
// layer of its own.
//   .txt    make-tanakh's prose draft: !!<meta>!! lines, ===title===, ==heading==, v<n> verse
//           markers, //1 //2 poetry lines, a blank line between paragraphs, {X: …} inline notes
//   .align  make-tanakh's scripts/full_align.py working file: "# text <hash>", then per verse
//           <verse>\t<main string>\t<fn string>\t<profile>, ordinals into compact-alignments' _index
import { ORDER } from './catalog.js';

const NT = new Set(ORDER.slice(ORDER.indexOf('MAT')));
const ISO = 'bar'; // Bavarian, the ISO 639-3 group of Viennese; the library has no settings for it, so defaults

const get = (url) => fetch(url, { cache: 'no-store' }).then((r) => {
	if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
	return r.text();
});
const file = (project, book, c, ext) => `/import/${project}/${book.toLowerCase()}${String(c).padStart(3, '0')}.${ext}`;

/** The projects in import/ with aligned chapters: [{id, books: {MAT: [5, 8]}}]. Only on the local dev
 *  server (vite dev, also under netlify dev): a built site, on Netlify or in vite preview, never asks. */
export async function projects() {
	if (!import.meta.env.DEV) return [];
	try {
		const res = await fetch('/import/index.json', { cache: 'no-store' });
		if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return [];
		return (await res.json()).projects || [];
	} catch {
		return [];
	}
}

/** A project as an edition (the shape catalog.editions gives) */
export async function edition(project) {
	const books = [];
	let meta = {};
	for (const [code, list] of Object.entries(project.books).sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))) {
		const d = draft(await get(file(project.id, code, list[0], 'txt')));
		if (!books.length) meta = d.meta;
		books.push({ code, name: d.bookName || code, testament: NT.has(code) ? 'nt' : 'ot', chapters: Math.max(...list), chapterList: list, aligned: true });
	}
	const route = { route: 'import', project: project.id };
	return {
		id: `import:${project.id}`, short: project.id, iso: ISO, imported: true,
		name: `${project.id}, entered by hand`,
		licence: [meta.Status, meta.Translation?.replace(/\s*\([^)]*\.txt\)/g, '')].filter(Boolean).join('; ') || 'entered by hand',
		dir: 'ltr', books, route: { ot: route, nt: route }, base: '', meta,
		alignment: { full_layer: `import-${project.id}`, compact_edition: null, verse_map: '_versification_eng.json', books: books.map((b) => b.code) }
	};
}

// make-tanakh's bridge_align.MARK and full_align.NOTE (Python's \w is Unicode)
const MARK = /(?<![\p{L}\p{N}_>.])v(\d+)(?=\s)/u;
const NOTE = /\{[A-Z]:[\s\S]*?\}/g;
const POETRY = /^\/\/(\d*)\s+/;

/** The draft: {meta, bookName, chapterTitle, verses: [[v, raw]] (bridge_align.draft_verses, kept
 *  exact for the text hash), and the layout: paragraphStarts, headingBefore, poetryVerses (verse numbers)} */
function draft(text) {
	const meta = {};
	let title = null;
	const body = [];
	for (const l of text.split(/\r\n|\n|\r/)) {
		const m = /^!!<([^:>]+):\s*(.*?)>!!\s*$/.exec(l);
		if (l.startsWith('!!<')) {
			if (m) meta[m[1].trim()] = m[2];
		} else if (/^===.*===\s*$/.test(l) && title === null) title = l.trim().replace(/^=+|=+$/g, '');
		else body.push(l);
	}
	const stream = [];
	let buf = [];
	const flush = () => { if (buf.length) stream.push(['t', buf.join(' ')]); buf = []; };
	for (const l of body) {
		if (/^==.*==\s*$/.test(l)) { flush(); stream.push(['h', l.trim()]); }
		else if (l.trim()) buf.push(l.trim());
		else flush();
	}
	flush();
	const verses = [], paragraphStarts = [], headingBefore = [], poetryVerses = [];
	let pending = false;
	for (const [kind, t] of stream) {
		if (kind === 'h') { pending = true; continue; }
		const parts = t.split(new RegExp(MARK.source, 'gu'));
		const poetry = POETRY.test(t);
		const lead = parts[0].replace(POETRY, '').trim();
		if (parts[0].trim() && verses.length) verses[verses.length - 1][1] += ' ' + parts[0].trim();
		if (poetry && lead && verses.length) poetryVerses.push(verses[verses.length - 1][0]);
		for (let i = 1; i < parts.length - 1; i += 2) {
			const v = parseInt(parts[i], 10);
			if (i === 1 && !lead) {
				if (!poetry) paragraphStarts.push(v);
				if (pending) headingBefore.push(v);
			}
			if (poetry) poetryVerses.push(v);
			verses.push([v, `v${parts[i]} ` + parts[i + 1].trim()]);
			pending = false;
		}
	}
	return { meta, chapterTitle: title, bookName: title ? title.split(',')[0].trim() : null, verses, paragraphStarts, headingBefore, poetryVerses };
}

// full_align.verse_text: no verse marker, no inline notes, single spaces
const hashText = (raw) => raw.trim().replace(/^v\d+\s+/, '').replace(NOTE, ' ').replace(/\s+/g, ' ').trim();
// the sung text: also without the poetry marks
const singText = (raw) => hashText(raw).replace(/(^|\s)\/\/\d*(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();

/** full_align.text_hash: sha256 of the "c:v:text" lines, sorted */
async function textHash(c, verses) {
	const lines = verses.map(([v, raw]) => [v, hashText(raw)]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1))
		.map(([v, t]) => `${c}:${v}:${t}`).join('\n');
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(lines));
	return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const chapters = new Map();

/** One chapter: {input (for bookText), rows: Map verse -> [main, fn], fresh (the alignment was made
 *  from this text)} */
function chapter(project, book, c) {
	const key = `${project}|${book}|${c}`;
	if (!chapters.has(key)) {
		chapters.set(key, (async () => {
			const [txt, align] = await Promise.all([get(file(project, book, c, 'txt')), get(file(project, book, c, 'align'))]);
			const d = draft(txt);
			let hash = null;
			const rows = new Map();
			for (const l of align.split(/\r\n|\n|\r/)) {
				if (l.startsWith('# text ')) hash = l.slice(7).trim();
				else if (l && !l.startsWith('#')) {
					const [v, main = '', fn = ''] = l.split('\t');
					rows.set(parseInt(v, 10), [main, fn]);
				}
			}
			const k = (v) => `${c}:${v}`;
			const input = {
				verses: Object.fromEntries(d.verses.map(([v, raw]) => [k(v), singText(raw)]).filter(([, t]) => t)),
				paragraphStarts: d.paragraphStarts.map(k), headingBefore: d.headingBefore.map(k), poetryVerses: d.poetryVerses.map(k),
				name: d.bookName || book
			};
			return { input, rows, fresh: hash !== null && hash === await textHash(c, d.verses) };
		})().catch((e) => { chapters.delete(key); throw e; }));
	}
	return chapters.get(key);
}

/** bookText's input for one chapter */
export const chapterText = async (edition, book, c) => (await chapter(edition.short, book.code, c)).input;

/** The library's files, with this edition's alignment as a full-alignments layer: the main strings
 *  parallel to _index/<BOOK>_lexemes.json, and {fn} in the .meta.json. Only chapters whose text
 *  still matches their alignment are given; stale(book) names the others. */
export function withAlignment(files, edition) {
	const layer = edition.alignment.full_layer;
	const built = new Map();
	const build = (code) => {
		if (!built.has(code)) {
			built.set(code, (async () => {
				const book = edition.books.find((b) => b.code === code);
				const lexemes = await files.json('compact-alignments', `_index/${code}_lexemes.json`);
				const got = book ? await Promise.all(book.chapterList.map(async (c) => [c, await chapter(edition.short, code, c)])) : [];
				const fresh = new Map(got.filter(([, x]) => x.fresh));
				const pick = (i) => Object.keys(lexemes).map((ref) => {
					const m = /^\S+ (\d+):(\d+)$/.exec(ref);
					const ch = m && fresh.get(parseInt(m[1], 10));
					return (ch && ch.rows.get(parseInt(m[2], 10))?.[i]) || '';
				});
				return { main: pick(0), fn: pick(1), stale: got.filter(([, x]) => !x.fresh).map(([c]) => c) };
			})().catch((e) => { built.delete(code); throw e; }));
		}
		return built.get(code);
	};
	const own = new RegExp(`/${layer}/([0-9A-Z]{3})_[0-9a-f]+(\\.meta)?\\.json$`);
	return {
		text: files.text,
		json: async (ds, path) => {
			const m = ds === 'full-alignments-manual' ? own.exec(path) : null;
			if (!m) return files.json(ds, path);
			const b = await build(m[1]);
			return m[2] ? { fn: b.fn } : b.main;
		},
		stale: async (code) => (await build(code)).stale
	};
}
