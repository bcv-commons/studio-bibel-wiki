<script>
	// Choose a book and a chapter, the way demo-bibel-wiki's Standard mode does (BiblePickerSheet, after
	// sab-pwa): a panel anchored under the button that opened it, with Book and Chapter tabs; the books
	// in a grid of short names grouped by section, the chapters in a grid of numbers. Choosing a book
	// moves on to its chapters; the Chapter button opens on the chapters directly.

	/** @type {{
	 *   books: {code: string, name: string}[], book: string, chapter: number,
	 *   chapters: number[], loading: boolean, tab: 'book'|'chapter', anchor: DOMRect|null,
	 *   onBook: (code: string) => void, onChapter: (c: number) => void, onClose: () => void }} */
	let { books, book, chapter, chapters, loading, tab: start, anchor, onBook, onChapter, onClose } = $props();

	const SECTIONS = [
		['Pentateuch', 'GEN EXO LEV NUM DEU'],
		['Historical', 'JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST'],
		['Poetry', 'JOB PSA PRO ECC SNG'],
		['Major Prophets', 'ISA JER LAM EZK DAN'],
		['Minor Prophets', 'HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'],
		['Gospels', 'MAT MRK LUK JHN'],
		['History', 'ACT'],
		['Pauline Epistles', 'ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM'],
		['General Epistles', 'HEB JAS 1PE 2PE 1JN 2JN 3JN JUD'],
		['Revelation', 'REV']
	].map(([name, codes]) => [name, new Set(codes.split(' '))]);

	// the panel starts on the tab and book it was opened with, then follows the choices made in it
	// svelte-ignore state_referenced_locally
	let tab = $state(start);
	// svelte-ignore state_referenced_locally
	let picked = $state(book); // the book whose chapters are shown

	const groups = $derived.by(() => {
		const out = SECTIONS.map(([name, codes]) => ({ name, books: books.filter((b) => codes.has(b.code)) }));
		const known = new Set(SECTIONS.flatMap(([, c]) => [...c]));
		out.push({ name: 'Other', books: books.filter((b) => !known.has(b.code)) });
		return out.filter((g) => g.books.length);
	});
	const pickedBook = $derived(books.find((b) => b.code === picked) || null);

	// a short name for the cell: the first letters, with a leading number kept ("1 Samuel" -> "1Sam")
	function short(name) {
		const m = /^(\d+)\s*(.*)$/u.exec(name.trim());
		return m ? m[1] + [...m[2]].slice(0, 3).join('') : [...name.trim()].slice(0, 4).join('');
	}

	function chooseBook(code) {
		picked = code;
		tab = 'chapter';
		if (code !== book) onBook(code);
	}

	function chooseChapter(c) {
		onClose();
		onChapter(c);
	}

	const W = $derived(tab === 'chapter' && start === 'chapter' ? 260 : 340);
	const style = $derived(anchor
		? `top:${Math.min(anchor.bottom + 8, innerHeight - 120)}px;left:${Math.max(8, Math.min(anchor.left, innerWidth - W - 8))}px;width:min(${W}px, calc(100vw - 1rem))`
		: `top:64px;left:50%;transform:translateX(-50%);width:min(${W}px, calc(100vw - 1rem))`);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onClose}>
	<div class="panel" {style} role="dialog" aria-modal="true" aria-label="Choose a book and chapter" tabindex="-1"
		onclick={(e) => e.stopPropagation()}>
		<div class="tabs">
			{#if start === 'book'}
				<button class:active={tab === 'book'} onclick={() => (tab = 'book')}>{pickedBook ? pickedBook.name : 'Book'}</button>
			{/if}
			{#if picked}
				<button class:active={tab === 'chapter'} onclick={() => (tab = 'chapter')}>Chapter</button>
			{/if}
		</div>

		<div class="body">
			{#if tab === 'book'}
				{#each groups as g (g.name)}
					<section>
						<h3>{g.name}</h3>
						<div class="grid">
							{#each g.books as b (b.code)}
								<button class="cell" class:current={b.code === book} title={b.name} onclick={() => chooseBook(b.code)}>{short(b.name)}</button>
							{/each}
						</div>
					</section>
				{/each}
			{:else if loading || picked !== book}
				<p class="empty">Loading the chapters …</p>
			{:else if !chapters.length}
				<p class="empty">This book has no chapters in this edition.</p>
			{:else}
				<div class="grid numbers">
					{#each chapters as c (c)}
						<button class="cell" class:active={c === chapter} onclick={() => chooseChapter(c)}>{c}</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* a dropdown, not a modal: the transparent layer only catches the click outside */
	.scrim { position: fixed; inset: 0; z-index: 40; }
	.panel { position: fixed; max-height: min(70vh, 520px); display: flex; flex-direction: column; overflow: hidden; background: #fff; border-radius: 10px; border: 1px solid #e3e3df; box-shadow: 0 12px 32px rgb(0 0 0 / 0.22); outline: none; }
	.tabs { display: flex; flex-shrink: 0; background: #6b4f1d; }
	.tabs button { flex: 1; min-width: 0; border: 0; border-bottom: 2px solid transparent; background: none; color: rgb(255 255 255 / 0.65); font: inherit; font-size: 0.85rem; font-weight: 600; padding: 0.65rem 0.5rem; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.tabs button.active { color: #fff; border-bottom-color: #fff; }
	.body { overflow-y: auto; padding: 0.5rem 0.6rem 0.75rem; }
	section { margin-top: 0.6rem; }
	section:first-child { margin-top: 0.25rem; }
	h3 { margin: 0 0 0.3rem; padding: 0 0.15rem; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8b8170; }
	.grid { display: grid; grid-template-columns: repeat(auto-fill, 2.6rem); gap: 0.3rem; }
	.grid.numbers { grid-template-columns: repeat(auto-fill, 1.9rem); padding-top: 0.25rem; }
	.cell { width: 100%; aspect-ratio: 1 / 1; border: 0; border-radius: 4px; background: #f3efe5; color: #3d2f12; font: inherit; font-size: 0.72rem; font-weight: 600; cursor: pointer; display: grid; place-items: center; overflow: hidden; padding: 0; transition: background 100ms ease; }
	.numbers .cell { font-size: 0.68rem; }
	.cell:hover { background: #e6dcc4; }
	.cell.current { box-shadow: inset 0 0 0 2px #c9a227; }
	.cell.active { background: #8a6d3b; color: #fff; }
	.empty { margin: 0; padding: 2rem 0; text-align: center; color: #888; font-size: 0.9rem; }
</style>
