import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// runes mode for the project, not for libraries
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			// Everything runs in the browser (the texts, alignments and plans are fetched just in
			// time), so the site is static: one page, no server functions.
			adapter: adapter()
		})
	]
});
