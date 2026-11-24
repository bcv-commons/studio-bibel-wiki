// The song of a chapter: bible-song-builder's projection, with its inputs fetched just in time.
// The release data (config, plans, alignment index) is served by this site under /data/; the
// alignments come from the bcv-commons datasets on Hugging Face at the revisions the config pins.
import { Config, chapterPlan, lexemeKeys, loadAlignment, loadBookText, prepareBook, projectChapter, verseMap } from 'bible-song-builder';
import { getJson } from './catalog.js';
import { bookUsj } from './text.js';

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

/** The book-level work, once per edition and book: {ctx, chapters} */
export function prepare(edition, book, onStatus = () => {}) {
	const key = `${edition.id}|${book.code}`;
	if (!books.has(key)) books.set(key, load(edition, book, onStatus).catch((e) => { books.delete(key); throw e; }));
	return books.get(key);
}

async function load(edition, book, onStatus) {
	const cfg = await config();
	const f = files(cfg);
	onStatus(`Fetching ${edition.short} ${book.name} …`);
	const usj = await bookUsj(edition, book, (d, n) => onStatus(`Fetching ${edition.short} ${book.name}: chapter ${d} of ${n}`));
	const al0 = edition.alignment || {};
	const ed = {
		name: edition.short, iso: edition.iso, licence: edition.licence || edition.name,
		compact_edition: al0.compact_edition || null, full_layer: al0.full_layer || null,
		verse_map: al0.verse_map || '_versification_eng.json'
	};
	onStatus('Reading the text …');
	const bt = await loadBookText(cfg, ed, book.code, usj);
	onStatus('Fetching the alignment and the song plan …');
	const [al, bookPlan, vmap, lexemes] = await Promise.all([
		loadAlignment(f, ed, book.code, bt.fileHash, bt.chapterFingerprints),
		getJson(`/data/plan/${book.code}/${book.code}.json`),
		verseMap(f, ed),
		lexemeKeys(f, book.code)]);
	const ctx = prepareBook({ cfg, edition: ed, book: book.code, bt, al, bookPlan, vmap, lexemes });
	const chapters = [...new Set([...bt.verses.keys()].map((k) => Math.floor(k / 1000)))].sort((a, b) => a - b);
	return { ctx, chapters, planChapters: new Set(bookPlan.chapters || []), alignment: { kind: al.kind, off: [...al.chaptersOff] } };
}

const pad = (n) => String(n).padStart(3, '0');

/** {lyrics, style, notes, chars} of one edition chapter */
export async function song({ ctx, planChapters }, book, chapter) {
	// only the spine chapters the book plan lists, so chapter 1 and the last ask for no missing file
	const near = [chapter - 1, chapter, chapter + 1].filter((c) => !planChapters.size || planChapters.has(c));
	const docs = (await Promise.all(near.map((c) =>
		getJson(`/data/plan/${book.code}/${book.code}_${pad(c)}.json`).catch(() => null)))).filter(Boolean);
	return projectChapter(ctx, chapter, chapterPlan(docs));
}
