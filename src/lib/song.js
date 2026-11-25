// The song of a chapter: bible-song-builder's projection, with its inputs fetched just in time.
// The release data (config, plans, alignment index) is served by this site under /data/; the
// alignments come from the bcv-commons datasets on Hugging Face at the revisions the config pins.
import { Config, bookText, chapterPlan, lexemeKeys, loadAlignment, loadBookText, prepareBook, projectChapter, spineChapters, verseMap } from 'bible-song-builder';
import { getJson } from './catalog.js';
import { bookUsj, byChapter, chapterText } from './text.js';
import * as imported from './imported.js';

let configP = null;
export const config = () => (configP ??= getJson('/data/config.json').then((b) => new Config(b)));

/** files for the library: a file of a pinned bcv-commons dataset, or null */
function files(cfg) {
	const text = async (ds, path) => {
		const pin = cfg.pins.huggingface[ds];
		const res = await fetch(`https://huggingface.co/datasets/${pin.repo}/resolve/${pin.revision}/${path}`);
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`${ds}/${path}: HTTP ${res.status}`);
		return res.text();
	};
	return { text, json: async (ds, path) => { const t = await text(ds, path); return t === null ? null : JSON.parse(t); } };
}

const books = new Map();

/** The text and its alignment, ready for songs: {ctx, vmap, chapters, planChapters, alignment,
 *  edition, perChapter}. Once per edition and book; for an edition read by chapter (DBT), once per
 *  set of chapters (`chapter`: a number or a list), since the library builds a chapter's song from
 *  that chapter's text alone (with the chapters its speakers are named in, see song). */
export function prepare(edition, book, chapter, onStatus = () => {}) {
	const perChapter = byChapter(edition.route[book.testament]);
	const read = perChapter ? [...new Set([chapter].flat().filter(Boolean))].sort((a, b) => a - b) : [];
	if (perChapter && !read.length) return Promise.resolve({ chapters: [] }); // read by chapter: nothing book-wide to load
	const key = `${edition.id}|${book.code}|${read.join(',')}`;
	if (!books.has(key)) books.set(key, load(edition, book, read, onStatus).catch((e) => { books.delete(key); throw e; }));
	return books.get(key);
}

// a DBT chapter's text, fetched once per page visit
const texts = new Map();
function textOf(edition, book, c) {
	const key = `${edition.id}|${book.code}|${c}`;
	const read = edition.imported ? imported.chapterText : chapterText;
	if (!texts.has(key)) texts.set(key, read(edition, book, c).catch((e) => { texts.delete(key); throw e; }));
	return texts.get(key);
}

/** bookText's input from several chapters' */
function merge(parts) {
	const out = { verses: {}, paragraphStarts: [], headingBefore: [], poetryVerses: [], name: parts[0]?.name || '' };
	for (const p of parts) {
		Object.assign(out.verses, p.verses);
		for (const k of ['paragraphStarts', 'headingBefore', 'poetryVerses']) out[k].push(...(p[k] || []));
	}
	return out;
}

async function load(edition, book, read, onStatus) {
	const cfg = await config();
	const f = edition.imported ? imported.withAlignment(files(cfg), edition) : files(cfg);
	const al0 = edition.alignment || {};
	const ed = {
		name: edition.short, iso: edition.iso, licence: edition.licence || edition.name,
		compact_edition: al0.compact_edition || null, full_layer: al0.full_layer || null,
		verse_map: al0.verse_map || '_versification_eng.json'
	};
	let bt;
	if (read.length) {
		onStatus(`Fetching ${edition.short} ${book.name} ${read.join(', ')} …`);
		bt = await bookText(ed, book.code, { ...merge(await Promise.all(read.map((c) => textOf(edition, book, c)))), partial: true });
	} else {
		onStatus(`Fetching ${edition.short} ${book.name} …`);
		const usj = await bookUsj(edition, book, (d, n) => onStatus(`Fetching ${edition.short} ${book.name}: chapter ${d} of ${n}`));
		onStatus('Reading the text …');
		bt = await loadBookText(cfg, ed, book.code, usj);
	}
	onStatus('Fetching the alignment and the song plan …');
	const [al, bookPlan, vmap, lexemes] = await Promise.all([
		loadAlignment(f, ed, book.code, bt.fileHash, bt.chapterFingerprints, { partial: bt.partial }),
		getJson(`/data/plan/${book.code}/${book.code}.json`),
		verseMap(f, ed),
		lexemeKeys(f, book.code)]);
	// a chapter entered by hand and changed after it was aligned: its alignment no longer fits
	if (f.stale) for (const c of await f.stale(book.code)) al.chaptersOff.add(c);
	const ctx = prepareBook({ cfg, edition: ed, book: book.code, bt, al, bookPlan, vmap, lexemes });
	const chapters = book.chapterList ? [...book.chapterList] : read.length && book.chapters ? Array.from({ length: book.chapters }, (_, i) => i + 1)
		: [...new Set([...bt.verses.keys()].map((k) => Math.floor(k / 1000)))].sort((a, b) => a - b);
	return {
		ctx, vmap, chapters, planChapters: new Set(bookPlan.chapters || []), alignment: { kind: al.kind, off: [...al.chaptersOff] },
		edition, perChapter: read.length > 0
	};
}

const pad = (n) => String(n).padStart(3, '0');

/** {lyrics, style, notes, chars, data} of one edition chapter. For an edition read by chapter: a
 *  speaker the chapter does not name points to the chapter of the book that does; that chapter is
 *  fetched too and the song made again from both, so it is the one the whole book would give. */
export async function song(prep, book, chapter, onStatus = () => {}) {
	const first = credit(prep, await project(prep, book, chapter));
	if (!prep.perChapter) return first;
	const named = new Set();
	for (const s of first.data?.sections || []) {
		for (const ln of s.lines) {
			const p = ln.speaker?.pointer;
			if (p && p.book === book.code && p.verse) named.add(parseInt(p.verse, 10));
		}
	}
	named.delete(chapter);
	for (const c of named) if (!prep.chapters.includes(c)) named.delete(c); // a chapter the edition does not have
	if (!named.size) return first;
	const both = await prepare(prep.edition, book, [chapter, ...named], onStatus);
	return credit(both, await project(both, book, chapter));
}

/** A text entered by hand: its alignment came with it, not from a bcv-commons layer */
function credit(prep, res) {
	if (!prep.edition?.imported) return res;
	const rev = prep.ctx.cfg.pins.huggingface['compact-alignments'].revision.slice(0, 10);
	const line = `Alignment: entered by hand with the text (import/${prep.edition.short}/, make-tanakh's full_align.py`
		+ ` format), on the source word index of bcv-commons/compact-alignments @${rev}.`;
	return { ...res, notes: res.notes.split('\n').map((l) => (l.startsWith('Alignment: ') ? line : l)).join('\n') };
}

async function project({ ctx, vmap, planChapters }, book, chapter) {
	// the spine chapters edition chapter c draws on (c-1, c, c+1 and any the verse map moves a verse
	// from), only those the book plan lists, so chapter 1 and the last ask for no missing file
	const near = spineChapters(vmap, book.code, chapter).filter((c) => !planChapters.size || planChapters.has(c));
	const docs = (await Promise.all(near.map((c) =>
		getJson(`/data/plan/${book.code}/${book.code}_${pad(c)}.json`).catch(() => null)))).filter(Boolean);
	return projectChapter(ctx, chapter, chapterPlan(docs));
}
