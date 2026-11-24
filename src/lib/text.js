// An edition's text of one book, as USJ, fetched through its catalog route (catalog.editions).
import { mergeBookUsj } from './vendor/verse_text/helloao_to_usj.mjs';

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

