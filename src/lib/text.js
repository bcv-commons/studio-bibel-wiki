// An edition's text, fetched through its catalog route (catalog.editions): a whole book as USJ
// (helloAO, the CDN's own editions), or one chapter as plain data for bookText (DBT).
import { mergeBookUsj } from './vendor/verse_text/helloao_to_usj.mjs';
import { extractSofria } from './vendor/verse_text/extract_sofria.js';
import { extractPlain } from './vendor/verse_text/extract_plain.js';
import { firstNumber } from './vendor/verse_text/rule.js';

/** The routes read a chapter at a time, through the site's DBT key proxy (netlify/functions/dbt.mjs) */
export const byChapter = (r) => !!r && !r.path && !!r.id && (r.route === 'sofria' || r.route === 'plain');

/** The book's USJ. helloAO: every chapter, merged (bible.helloao.org/api/<id>/<BOOK>/<n>.json);
 *  the CDN's own editions: <base><path><BOOK>.usj.json. onProgress(done, total) for helloAO. */
export async function bookUsj(edition, book, onProgress = () => {}) {
	const r = edition.route[book.testament];
	if (r.route === 'helloao') {
		const n = book.chapters ?? (await helloaoChapters(edition.short, book.code));
		let done = 0;
		const chapters = await Promise.all(Array.from({ length: n }, async (_, i) => {
			const res = await fetch(`https://bible.helloao.org/api/${edition.short}/${book.code}/${i + 1}.json`);
			if (!res.ok) throw new Error(`helloAO ${edition.short} ${book.code} ${i + 1}: HTTP ${res.status}`);
			const j = await res.json();
			onProgress(++done, n);
			return j;
		}));
		return mergeBookUsj(book.code, chapters);
	}
	const res = await fetch(`${edition.base}${r.path}${book.code}.usj.json`);
	if (!res.ok) throw new Error(`${edition.id} ${book.code}: HTTP ${res.status}`);
	return res.json();
}

async function helloaoChapters(id, code) {
	const res = await fetch(`https://bible.helloao.org/api/${id}/books.json`);
	const b = (await res.json()).books.find((x) => x.id === code);
	return b ? b.numberOfChapters : 0;
}

/** One chapter of a DBT edition as bookText's input: {verses, paragraphStarts, headingBefore,
 *  poetryVerses, name}. sofria (text_json): DBT answers with a signed link to the chapter's Sofria,
 *  read with bibles' extract_sofria; plain (text_plain): the verses, read with extract_plain (no
 *  layout, so each verse is one paragraph). */
export async function chapterText(edition, book, chapter) {
	const r = edition.route[book.testament];
	const res = await fetch(`/api/dbt/${r.id}/${book.code}/${chapter}`);
	if (!res.ok) throw new Error(`${edition.short} ${book.code} ${chapter}: HTTP ${res.status} from DBT`);
	const data = (await res.json()).data || [];
	const keyed = (list) => Object.fromEntries(list.map((v) => [`${chapter}:${v.verse}`, v.text]));
	if (r.route === 'plain') {
		const verses = keyed(extractPlain(data));
		if (!Object.keys(verses).length) throw new Error(`${edition.short} has no text for ${book.name} ${chapter}`);
		return { verses, name: book.name };
	}
	if (!data[0]?.path) throw new Error(`${edition.short} has no text for ${book.name} ${chapter}`);
	const doc = await fetch(data[0].path).then((x) => {
		if (!x.ok) throw new Error(`${edition.short} ${book.code} ${chapter}: HTTP ${x.status} from DBT's file store`);
		return x.json();
	});
	return { verses: keyed(extractSofria(doc)), name: book.name, ...sofriaLayout(doc, chapter) };
}

const usfm = (subtype) => (subtype && subtype.startsWith('usfm:') ? subtype.slice(5) : subtype || '');
const isHeading = (m) => m.startsWith('s') || m === 'ms' || m === 'mr' || m === 'd';
const PARAGRAPH = new Set(['p', 'm', 'pmo', 'pm', 'pi', 'pi1', 'pi2', 'nb', 'po', 'pr', 'mi']);

/** The layout facts of a Sofria chapter, by the rules of bible-song-builder's usjLayout: a heading
 *  (a heading graft, or an s/ms/mr/d paragraph) stands before the next verse that opens a
 *  paragraph; a prose paragraph opens at a verse when its first content is that verse's label; a
 *  q* paragraph is poetry for its verses and the verse it continues. */
export function sofriaLayout(doc, chapter) {
	const paragraphStarts = [], headingBefore = [], poetryVerses = [];
	const key = (n) => `${chapter}:${n}`;
	let lastVerse = null, pendingHeading = false;
	for (const b of doc.sequence?.blocks || []) {
		if (b.type === 'graft') {
			if ((b.sequence?.type || b.subtype) === 'heading') pendingHeading = true;
			continue;
		}
		if (b.type !== 'paragraph') continue;
		const marker = usfm(b.subtype);
		if (isHeading(marker)) {
			pendingHeading = true;
			continue;
		}
		// the verse labels in the paragraph, and whether one comes before any text
		const nums = [];
		let opens = null;
		const scan = (items) => {
			for (const it of items || []) {
				if (typeof it === 'string') {
					if (opens === null && it.trim()) opens = false;
				} else if (it?.type === 'mark' && it.subtype === 'verses_label') {
					const n = parseInt(firstNumber(Array.isArray(it.atts?.number) ? it.atts.number[0] : it.atts?.number), 10);
					if (opens === null) opens = true;
					if (!Number.isNaN(n)) nums.push(n);
				} else if (it?.type === 'wrapper') {
					if (it.subtype === 'chapter' && String(it.atts?.number) !== String(chapter)) continue;
					scan(it.content);
				}
			}
		};
		scan(b.content);
		if (opens && nums.length) {
			if (PARAGRAPH.has(marker)) paragraphStarts.push(key(nums[0]));
			if (pendingHeading) headingBefore.push(key(nums[0]));
		}
		if (marker.startsWith('q')) {
			if (lastVerse !== null && !opens) poetryVerses.push(lastVerse);
			poetryVerses.push(...nums.map(key));
		}
		if (nums.length) {
			lastVerse = key(nums[nums.length - 1]);
			pendingHeading = false;
		}
	}
	return { paragraphStarts, headingBefore, poetryVerses };
}
