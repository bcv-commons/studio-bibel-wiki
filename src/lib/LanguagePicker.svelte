<script>
	// Choose a language, the way demo-bibel-wiki's PrimaryLangSelector does: quick picks (the last
	// ones chosen here, then a few widely used languages), and a search by English name, the
	// language's own name or ISO code; arrow keys, Enter and Escape work in the list.
	import { onMount } from 'svelte';

	/** @type {{ langs: {iso: string, name: string, own: string|null}[], current: string, onPick: (iso: string) => void, onClose: () => void }} */
	let { langs, current, onPick, onClose } = $props();

	const RECENT_KEY = 'studio-bibel-wiki-recent-langs';
	const MAX_RECENTS = 5;
	const POPULAR = ['eng', 'cmn', 'hin', 'spa', 'arb', 'fra', 'por', 'deu', 'rus'];
	const MIN_CHARS = 2;

	function recents() {
		try {
			return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
		} catch {
			return [];
		}
	}

	let query = $state('');
	let idx = $state(-1);
	let input = $state();
	let list = $state();

	const byIso = $derived(new Map(langs.map((l) => [l.iso, l])));
	const picks = $derived([...new Set([...recents(), ...POPULAR])].map((c) => byIso.get(c)).filter(Boolean).slice(0, 8));
	const q = $derived(query.trim().toLowerCase());
	const results = $derived(q.length < MIN_CHARS ? [] : langs.filter((l) =>
		l.iso.includes(q) || l.name.toLowerCase().includes(q) || (l.own || '').toLowerCase().includes(q)));

	$effect(() => { idx = results.length ? 0 : -1; });
	$effect(() => { if (idx >= 0) list?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' }); });
	onMount(() => input?.focus());

	function pick(l) {
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify([l.iso, ...recents().filter((c) => c !== l.iso)].slice(0, MAX_RECENTS)));
		} catch { /* private mode */ }
		onClose();
		if (l.iso !== current) onPick(l.iso);
	}

	function key(e) {
		if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
		if (!results.length) return;
		if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % results.length; }
		else if (e.key === 'ArrowUp') { e.preventDefault(); idx = idx <= 0 ? results.length - 1 : idx - 1; }
		else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); pick(results[idx]); }
	}

	// the matched part of a name, marked
	function parts(text) {
		const i = q ? (text || '').toLowerCase().indexOf(q) : -1;
		return i < 0 ? [text, '', ''] : [text.slice(0, i), text.slice(i, i + q.length), text.slice(i + q.length)];
	}
</script>

{#snippet marked(text)}
	{@const [a, b, c] = parts(text)}{a}{#if b}<mark>{b}</mark>{/if}{c}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onClose}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="lp-title" tabindex="-1"
		onclick={(e) => e.stopPropagation()} onkeydown={key}>
		<header>
			<h2 id="lp-title">Choose a language</h2>
			<button class="x" onclick={onClose} aria-label="Close">×</button>
		</header>

		{#if q.length < MIN_CHARS && picks.length}
			<div class="picks">
				{#each picks as l (l.iso)}
					<button class:on={l.iso === current} onclick={() => pick(l)}>{l.name}{l.iso === current ? ' ✓' : ''}</button>
				{/each}
			</div>
		{/if}

		<div class="search">
			<input bind:this={input} bind:value={query} type="search" autocomplete="off" spellcheck="false"
				placeholder="Search by language name or ISO code …" aria-label="Search languages"
				aria-controls="lp-results" />
			<p class="count">{langs.length} languages</p>
		</div>

		{#if q.length >= MIN_CHARS}
			<div class="results" id="lp-results" role="listbox" bind:this={list}>
				{#each results as l, i (l.iso)}
					<button role="option" aria-selected={i === idx} data-idx={i} class:hi={i === idx} class:on={l.iso === current}
						onclick={() => pick(l)} onmouseenter={() => (idx = i)}>
						<span class="names">
							<span class="name">{@render marked(l.name)}{l.iso === current ? ' ✓' : ''}</span>
							{#if l.own}<span class="own">{@render marked(l.own)}</span>{/if}
						</span>
						<span class="iso">{@render marked(l.iso)}</span>
					</button>
				{:else}
					<p class="none">No language matches “{query.trim()}”</p>
				{/each}
			</div>
		{:else if q.length}
			<p class="none">Type one more letter …</p>
		{/if}
	</div>
</div>

<style>
	.backdrop { position: fixed; inset: 0; z-index: 50; background: rgb(0 0 0 / 0.45); display: flex; align-items: center; justify-content: center; padding: 1rem; }
	.dialog { width: 100%; max-width: 28rem; max-height: 80vh; display: flex; flex-direction: column; background: #fff; border-radius: 10px; box-shadow: 0 20px 50px -20px rgb(0 0 0 / 0.5); outline: none; }
	header { display: flex; align-items: center; justify-content: space-between; padding: 0.8rem 1rem; border-bottom: 1px solid #e3e3df; }
	h2 { margin: 0; font-size: 1.1rem; }
	.x { border: 0; background: none; font-size: 1.5rem; line-height: 1; color: #888; cursor: pointer; }
	.x:hover { color: #1d1d1f; }
	.picks { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.8rem 1rem 0; }
	.picks button { font: inherit; font-size: 0.9rem; padding: 0.3rem 0.8rem; border: 1px solid #d8d3c6; border-radius: 999px; background: #f6f3ea; color: #1d1d1f; cursor: pointer; }
	.picks button:hover { border-color: #8a6d3b; }
	.picks button.on { background: #8a6d3b; border-color: #8a6d3b; color: #fff; font-weight: 600; }
	.search { padding: 0.8rem 1rem; }
	.search input { box-sizing: border-box; width: 100%; font: inherit; padding: 0.5rem 0.7rem; border: 1px solid #ccc; border-radius: 6px; }
	.search input:focus { outline: 2px solid #8a6d3b; outline-offset: 0; border-color: #8a6d3b; }
	.count { margin: 0.3rem 0 0; font-size: 0.75rem; color: #888; }
	.results { overflow-y: auto; padding: 0 0.6rem 0.8rem; }
	.results button { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.45rem 0.6rem; border: 0; border-radius: 6px; background: none; font: inherit; text-align: left; color: #1d1d1f; cursor: pointer; }
	.results button.hi { background: #f1ead9; }
	.results button.on .name { font-weight: 600; }
	.names { flex: 1; min-width: 0; display: flex; flex-direction: column; }
	.name, .own { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.own { font-size: 0.85rem; color: #666; }
	.iso { flex-shrink: 0; font: 0.75rem ui-monospace, SFMono-Regular, Menlo, monospace; color: #777; padding: 0.1rem 0.4rem; border-radius: 4px; background: #f3f1ec; }
	.none { margin: 0; padding: 0.4rem 1rem 1rem; color: #777; font-size: 0.9rem; }
	mark { background: #ecd9a6; color: inherit; border-radius: 2px; padding: 0 1px; }
</style>
