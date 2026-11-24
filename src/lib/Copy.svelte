<script>
	// A button that copies text to the clipboard, and says so.
	let { text } = $props();
	let done = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(text);
		done = true;
		setTimeout(() => (done = false), 1500);
	}
</script>

<button onclick={copy}>{done ? 'Copied' : 'Copy'}</button>

<style>
	button {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.25rem 0.8rem;
		border: 1px solid #8a6d3b;
		border-radius: 6px;
		background: #fff;
		color: #6b4f1d;
		cursor: pointer;
	}
	button:hover { background: #f6efe2; }
</style>
