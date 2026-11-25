<script>
	// Choose a Bible edition of the language: a panel anchored under the Bible button, in the style of
	// BookPicker. Each edition shows where its text comes from, whether it is aligned with the Hebrew
	// and Greek (which is what gives a song its voices and moods) and how many books it has; the
	// aligned ones come first, and a filter appears when there are many.
	import { onMount } from 'svelte';

	/** @type {{ editions: any[], current: string, anchor: DOMRect|null, onPick: (id: string) => void, onClose: () => void }} */
	let { editions, current, anchor, onPick, onClose } = $props();

	const SOURCE = { d: 'Bible Brain (DBT)', h: 'helloAO', o: 'openbible.info', e: 'eBible.org', c: 'CrossWire', import: 'entered by hand' };
	const source = (e) => SOURCE[e.id.split(':')[0]] || e.id.split(':')[0];
	const FILTER_FROM = 8;

	let query = $state('');
	let input = $state();
	const q = $derived(query.trim().toLowerCase());
	const shown = $derived(q ? editions.filter((e) => `${e.name} ${e.short} ${source(e)}`.toLowerCase().includes(q)) : editions);
	const groups = $derived([
		{ name: 'Aligned with the Hebrew and Greek', list: shown.filter((e) => e.alignment) },
		{ name: 'Not aligned yet: each verse is one line, no voices or moods', list: shown.filter((e) => !e.alignment) }
	].filter((g) => g.list.length));

	onMount(() => input?.focus());

	function pick(e) {
		onClose();
		if (e.id !== current) onPick(e.id);
	}

	const W = 420;
	const style = $derived(anchor
		? `top:${Math.min(anchor.bottom + 8, innerHeight - 120)}px;left:${Math.max(8, Math.min(anchor.left, innerWidth - W - 8))}px;width:min(${W}px, calc(100vw - 1rem))`
		: `top:64px;left:50%;transform:translateX(-50%);width:min(${W}px, calc(100vw - 1rem))`);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onClose}>
	<div class="panel" {style} role="dialog" aria-modal="true" aria-label="Choose a Bible" tabindex="-1" onclick={(e) => e.stopPropagation()}>
		<div class="head">
			<span>Bible</span>
			<span class="n">{editions.length} {editions.length === 1 ? 'edition' : 'editions'}</span>
		</div>
		{#if editions.length > FILTER_FROM}
			<div class="filter">
				<input bind:this={input} bind:value={query} type="search" autocomplete="off" spellcheck="false"
					placeholder="Filter by name, code or source …" aria-label="Filter the editions" />
			</div>
		{/if}
		<div class="body">
			{#each groups as g (g.name)}
				<h3>{g.name}</h3>
				{#each g.list as e (e.id)}
					<button class="row" class:on={e.id === current} onclick={() => pick(e)}>
						<span class="title">
							<span class="name">{e.name}</span>
							<span class="code">{e.short}</span>
						</span>
						<span class="meta">
							{source(e)} · {e.books.length} {e.books.length === 1 ? 'book' : 'books'}{#if e.alignment && e.books.some((b) => !b.aligned)}, {e.books.filter((b) => b.aligned).length} aligned{/if}
						</span>
					</button>
				{/each}
			{:else}
				<p class="none">No edition matches “{query.trim()}”</p>
			{/each}
		</div>
	</div>
</div>

<style>
	.scrim { position: fixed; inset: 0; z-index: 40; }
	.panel { position: fixed; max-height: min(70vh, 560px); display: flex; flex-direction: column; overflow: hidden; background: #fff; border-radius: 10px; border: 1px solid #e3e3df; box-shadow: 0 12px 32px rgb(0 0 0 / 0.22); outline: none; }
	.head { display: flex; justify-content: space-between; align-items: baseline; padding: 0.65rem 0.9rem; background: #6b4f1d; color: #fff; font-size: 0.85rem; font-weight: 600; }
	.head .n { font-weight: 400; color: rgb(255 255 255 / 0.7); }
	.filter { padding: 0.6rem 0.7rem 0.2rem; }
	.filter input { box-sizing: border-box; width: 100%; font: inherit; font-size: 0.9rem; padding: 0.4rem 0.6rem; border: 1px solid #ccc; border-radius: 6px; }
	.filter input:focus { outline: 2px solid #8a6d3b; border-color: #8a6d3b; }
	.body { overflow-y: auto; padding: 0.3rem 0.5rem 0.7rem; }
	h3 { margin: 0.7rem 0.3rem 0.3rem; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8b8170; }
	.row { display: block; width: 100%; text-align: left; padding: 0.45rem 0.6rem; margin-bottom: 0.15rem; border: 0; border-radius: 6px; background: none; font: inherit; color: #1d1d1f; cursor: pointer; }
	.row:hover { background: #f6f1e4; }
	.row.on { background: #f1ead9; box-shadow: inset 3px 0 0 #8a6d3b; }
	.title { display: flex; align-items: baseline; gap: 0.5rem; }
	.name { flex: 1; min-width: 0; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.row.on .name { font-weight: 600; }
	.code { flex-shrink: 0; font: 0.72rem ui-monospace, SFMono-Regular, Menlo, monospace; color: #777; padding: 0.05rem 0.35rem; border-radius: 4px; background: #f3f1ec; }
	.meta { display: block; font-size: 0.78rem; color: #777; margin-top: 0.1rem; }
	.none { margin: 0; padding: 1.5rem 0; text-align: center; color: #888; font-size: 0.9rem; }
</style>
