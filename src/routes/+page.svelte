<script>
	// studio.bibel.wiki: pick a language, an edition, a book and a chapter; get the song's lyrics,
	// Style and notes to paste into Suno (or another music service). Everything is fetched and
	// built here in the browser, just in time. The choice is kept in the address (?lang=&ed=&book=&ch=).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { editions as loadEditions, languages as loadLanguages } from '#lib/catalog.js';
	import { prepare, song } from '#lib/song.js';
	import { edition as importedEdition, projects as loadProjects } from '#lib/imported.js';
	import Copy from '#lib/Copy.svelte';
	import LanguagePicker from '#lib/LanguagePicker.svelte';
	import BookPicker from '#lib/BookPicker.svelte';
	import EditionPicker from '#lib/EditionPicker.svelte';

	let langs = $state([]);
	let imps = $state([]); // texts entered by hand (import/, local dev server only)
	let imp = $state('');
	let picking = $state(false); // the language dialog is open
	let bp = $state(null); // the book/chapter panel: {tab, anchor}
	let ep = $state(null); // the Bible panel: its anchor
	let bookLoading = $state(false); // learning a book's chapters (CDN editions)
	let iso = $state('');
	let eds = $state([]);
	let edId = $state('');
	let bookCode = $state('');
	let chapter = $state(0);
	let chapters = $state([]);
	let alignment = $state(null);
	let result = $state(null);
	let status = $state('');
	let error = $state('');

	const edition = $derived(eds.find((e) => e.id === edId) || null);
	const current = $derived(langs.find((l) => l.iso === iso) || null);
	const book = $derived(edition?.books.find((b) => b.code === bookCode) || null);
	const maxChars = 5000;

	function remember() {
		const q = new URLSearchParams();
		if (imp) q.set('imp', imp);
		if (iso) q.set('lang', iso);
		if (edId) q.set('ed', edId);
		if (bookCode) q.set('book', bookCode);
		if (chapter) q.set('ch', String(chapter));
		goto(`?${q}`, { replace: true, reset: false });
	}

	async function run(label, fn) {
		error = '';
		status = label;
		try {
			return await fn();
		} catch (e) {
			error = String(e?.message || e);
			return null;
		} finally {
			status = '';
		}
	}

	async function chooseLanguage(code, want = {}) {
		imp = '';
		iso = code;
		eds = [];
		edId = bookCode = '';
		chapter = 0;
		chapters = [];
		result = null;
		remember();
		if (!code) return;
		const list = await run('Reading the catalog …', () => loadEditions(code));
		if (!list || iso !== code) return;
		eds = list;
		const ed = list.find((e) => e.id === want.ed) || (list.length === 1 ? list[0] : null);
		if (ed) await chooseEdition(ed.id, want);
	}

	// a text entered by hand: shown as its own edition, instead of the catalog's
	async function chooseImport(id, want = {}) {
		imp = id;
		iso = '';
		eds = [];
		edId = bookCode = '';
		chapter = 0;
		chapters = [];
		result = null;
		remember();
		const p = imps.find((x) => x.id === id);
		if (!p) return;
		const ed = await run('Reading the text entered by hand …', () => importedEdition(p));
		if (!ed || imp !== id) return;
		eds = [ed];
		await chooseEdition(ed.id, { ...want, book: want.book || (ed.books.length === 1 ? ed.books[0].code : null) });
	}

	async function chooseEdition(id, want = {}) {
		edId = id;
		bookCode = '';
		chapter = 0;
		chapters = [];
		result = null;
		remember();
		const b = edition?.books.find((x) => x.code === want.book);
		if (b) await chooseBook(b.code, want);
	}

	async function chooseBook(code, want = {}) {
		bookCode = code;
		chapter = 0;
		result = null;
		const b = book;
		chapters = b?.chapterList ? [...b.chapterList] : b?.chapters ? Array.from({ length: b.chapters }, (_, i) => i + 1) : [];
		remember();
		if (want.ch) await chooseChapter(want.ch);
	}

	async function chooseChapter(c) {
		chapter = c;
		remember();
		const ed = edition, b = book;
		const prep = await run('Preparing the text …', () => prepare(ed, b, c, (s) => (status = s)));
		if (!prep || edId !== ed.id || bookCode !== b.code) return;
		chapters = prep.chapters;
		alignment = prep.alignment;
		if (!prep.chapters.includes(c)) {
			error = `${b.name} has no chapter ${c} in this edition.`;
			return;
		}
		const res = await run('Writing the song …', () => song(prep, b, c, (s) => (status = s)));
		if (res && chapter === c && bookCode === b.code) result = res;
	}

	// a book with an unknown chapter count (CDN editions): load it to learn its chapters
	async function openBook(code) {
		await chooseBook(code);
		if (!chapters.length && book) {
			const ed = edition, b = book;
			bookLoading = true;
			const prep = await run('Preparing the book …', () => prepare(ed, b, 0, (s) => (status = s)));
			bookLoading = false;
			if (prep && bookCode === b.code) chapters = prep.chapters;
		}
	}

	const openPicker = (tab, e) => (bp = { tab, anchor: e.currentTarget.getBoundingClientRect() });
	const at = $derived(chapters.indexOf(chapter));

	onMount(async () => {
		const q = new URLSearchParams(location.search);
		const [list, own] = await Promise.all([run('Reading the catalog …', () => loadLanguages()), loadProjects()]);
		if (list) langs = list;
		imps = own;
		const want = { ed: q.get('ed'), book: q.get('book'), ch: Number(q.get('ch')) || 0 };
		if (q.get('imp') && imps.some((p) => p.id === q.get('imp'))) await chooseImport(q.get('imp'), want);
		else if (q.get('lang') && langs.some((l) => l.iso === q.get('lang'))) await chooseLanguage(q.get('lang'), want);
	});

	const off = $derived(alignment && chapter && alignment.off.includes(chapter));
</script>

<svelte:head>
	<title>{book && chapter ? `${book.name} ${chapter} · ${edition.short} · ` : ''}studio.bibel.wiki</title>
</svelte:head>

<header>
	<h1>studio<span>.bibel.wiki</span></h1>
	<p>Make songs from the Bible in your language. Pick a chapter, copy its lyrics and Style into
		<a href="https://suno.com" rel="noopener">Suno</a>, and make the song. Listen to songs at
		<a href="https://music.bibel.wiki">music.bibel.wiki</a>.</p>
</header>

<main>
	{#if imps.length}
		<nav class="byhand" aria-label="Texts entered by hand">
			{#each imps as p (p.id)}
				<button class:on={imp === p.id} onclick={() => chooseImport(p.id)}
					title="A text entered by hand in import/{p.id}/, with its own alignment">✎ Entered by hand: {p.id}</button>
			{/each}
		</nav>
	{/if}

	{#if imp && edition}
		<section class="imported">
			<p><strong>{edition.name}</strong>{edition.meta?.Status ? ` · ${edition.meta.Status}` : ''}{edition.meta?.Date ? ` · ${edition.meta.Date}` : ''}</p>
			{#if edition.meta?.Translation}<p class="small">{edition.meta.Translation}</p>{/if}
			<p class="small">From <code>import/{imp}/</code> on this computer: only the local dev server shows it, the site does not.</p>
			<button onclick={() => chooseLanguage('')}>Back to the catalog</button>
		</section>
	{/if}

	<section class="pick">
		{#if !imp}
		<div class="field">
			<span id="lang-label">Language</span>
			<button class="lang" aria-labelledby="lang-label" aria-haspopup="dialog" disabled={!langs.length} onclick={() => (picking = true)}>
				{#if current}{current.name}{#if current.own}<span class="own">&nbsp;· {current.own}</span>{/if}{:else}Choose a language …{/if}
			</button>
		</div>
		<div class="field">
			<span id="bible-label">Bible</span>
			<button class="lang" aria-labelledby="bible-label" aria-haspopup="dialog" disabled={!eds.length}
				onclick={(e) => (ep = e.currentTarget.getBoundingClientRect())}>
				{#if edition}{edition.name}{#if !edition.alignment}<span class="own">&nbsp;· no alignment</span>{/if}
				{:else}{iso && !eds.length && !status ? 'No edition the studio can read yet' : 'Choose a Bible …'}{/if}
			</button>
		</div>
		{/if}
		<div class="field">
			<span id="book-label">Book</span>
			<button class="lang" aria-labelledby="book-label" aria-haspopup="dialog" disabled={!edition} onclick={(e) => openPicker('book', e)}>
				{book ? book.name : 'Choose a book …'}
			</button>
		</div>
		<div class="field">
			<span id="chapter-label">Chapter</span>
			<div class="chapter">
				<button class="step" aria-label="Previous chapter" disabled={at <= 0} onclick={() => chooseChapter(chapters[at - 1])}>‹</button>
				<button class="lang" aria-labelledby="chapter-label" aria-haspopup="dialog" disabled={!book || (!chapters.length && !bookLoading)}
					onclick={(e) => openPicker('chapter', e)}>{chapter || (bookLoading ? 'Loading …' : 'Choose …')}</button>
				<button class="step" aria-label="Next chapter" disabled={at < 0 || at >= chapters.length - 1} onclick={() => chooseChapter(chapters[at + 1])}>›</button>
			</div>
		</div>
	</section>

	{#if picking}
		<LanguagePicker {langs} current={iso} onPick={(code) => chooseLanguage(code)} onClose={() => (picking = false)} />
	{/if}

	{#if ep}
		<EditionPicker editions={eds} current={edId} anchor={ep} onPick={(id) => chooseEdition(id)} onClose={() => (ep = null)} />
	{/if}

	{#if bp}
		<BookPicker books={edition?.books || []} book={bookCode} {chapter} {chapters} loading={bookLoading} tab={bp.tab} anchor={bp.anchor}
			onBook={(code) => openBook(code)} onChapter={(c) => chooseChapter(c)} onClose={() => (bp = null)} />
	{/if}

	{#if status}<p class="status">{status}</p>{/if}
	{#if error}<p class="error">{error}</p>{/if}

	{#if result && !status}
		{#if !edition.alignment || alignment?.kind === 'none'}
			<p class="note">This Bible has no word alignment to the Hebrew and Greek yet, so each verse is one line and the voices and moods are left out.</p>
		{:else if off}
			<p class="note">This chapter's text differs from the text the alignment was made from, so each verse is one line here.</p>
		{/if}
		<section class="out">
			<article>
				<header><h2>Style</h2><Copy text={result.style} /></header>
				<pre class="style">{result.style}</pre>
			</article>
			<article>
				<header>
					<h2>Lyrics</h2>
					<span class:over={result.chars > maxChars}>{result.chars} characters{result.chars > maxChars ? `, over Suno's ${maxChars}` : ''}</span>
					<Copy text={result.lyrics} />
				</header>
				<pre dir={edition.dir}>{result.lyrics}</pre>
			</article>
			<article>
				<header><h2>Notes</h2><Copy text={result.notes} /></header>
				<pre class="notes">{result.notes}</pre>
			</article>
		</section>
	{/if}
</main>

<footer>
	<p>Lyrics are the Bible text itself, word for word; line breaks, voices and moods come from the Hebrew and Greek
		through <a href="https://huggingface.co/bcv-commons">bcv-commons</a> data, by
		<a href="https://github.com/bcv-commons/bible-song-builder">bible-song-builder</a>. Texts from the
		<a href="https://github.com/bcv-commons/bibles">bibles catalog</a>; each song's notes give its sources and licences.</p>
</footer>

<style>
	:global(body) {
		margin: 0;
		font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
		color: #1d1d1f;
		background: #fafaf7;
	}
	header, main, footer { max-width: 60rem; margin: 0 auto; padding: 0 1rem; }
	h1 { margin: 1.5rem 0 0.25rem; font-size: 1.8rem; letter-spacing: -0.02em; }
	h1 span { color: #8a6d3b; font-weight: 500; }
	a { color: #6b4f1d; }
	.pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.75rem; margin: 1.25rem 0; }
	.field { display: flex; flex-direction: column; font-size: 0.85rem; color: #555; gap: 0.25rem; }
	button.lang { font: inherit; font-size: 1rem; text-align: left; padding: 0.45rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; color: #1d1d1f; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	button.lang:hover:not(:disabled) { border-color: #8a6d3b; }
	button.lang .own { color: #777; }
	.chapter { display: flex; gap: 0.3rem; }
	.chapter button.lang { flex: 1; text-align: center; }
	.step { font: inherit; font-size: 1.1rem; width: 2.2rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; color: #6b4f1d; cursor: pointer; }
	.step:disabled { color: #ccc; cursor: default; }
	.byhand { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 1rem; }
	.byhand button, .imported button { font: inherit; font-size: 0.9rem; padding: 0.35rem 0.7rem; border: 1px solid #8a6d3b; border-radius: 6px; background: #fff; color: #6b4f1d; cursor: pointer; }
	.byhand button.on { background: #8a6d3b; color: #fff; }
	.imported { background: #fff; border: 1px solid #e3e3df; border-radius: 8px; padding: 0.6rem 1rem; margin-top: 0.75rem; }
	.imported p { margin: 0.2rem 0; }
	.imported .small { font-size: 0.85rem; color: #555; }
	.status { color: #555; }
	.error { color: #a12; }
	.note { background: #fff6e0; border: 1px solid #ecd9a6; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.9rem; }
	.out { display: grid; gap: 1rem; }
	article { background: #fff; border: 1px solid #e3e3df; border-radius: 8px; padding: 0.75rem 1rem; }
	article header { display: flex; align-items: center; gap: 0.75rem; padding: 0; margin: 0; max-width: none; }
	article h2 { font-size: 1rem; margin: 0; flex: 1; }
	article header span { font-size: 0.85rem; color: #666; }
	article header span.over { color: #a12; }
	pre { white-space: pre-wrap; font: inherit; margin: 0.5rem 0 0; }
	pre.notes { font-size: 0.85rem; color: #444; }
	footer { margin: 2rem auto; font-size: 0.85rem; color: #666; }
</style>
