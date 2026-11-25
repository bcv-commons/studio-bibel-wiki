// Texts entered by hand (import/<project>/, git-ignored): served by the local dev server only, so they
// never go into the build or onto the site. A project folder holds per chapter <book><ccc>.txt (the
// draft, make-tanakh's prose format) and <book><ccc>.align (its full alignment, make-tanakh's
// scripts/full_align.py working file); src/lib/imported.js reads them.
//   GET /import/index.json             {projects: [{id, books: {MAT: [5, 8]}}]}: the aligned chapters
//   GET /import/<project>/<file>       one .txt or .align file
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const FILE = /^([0-9a-z]{3})(\d{3})\.(txt|align)$/;

export function importTexts(root = resolve('import')) {
	async function index() {
		const projects = [];
		const dirs = await readdir(root, { withFileTypes: true }).catch(() => []);
		for (const d of dirs.filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
			const names = new Set(await readdir(join(root, d.name)));
			const books = {};
			for (const n of names) {
				const m = FILE.exec(n);
				if (!m || m[3] !== 'txt' || !names.has(`${m[1]}${m[2]}.align`)) continue;
				(books[m[1].toUpperCase()] ??= []).push(parseInt(m[2], 10));
			}
			for (const b of Object.values(books)) b.sort((x, y) => x - y);
			if (Object.keys(books).length) projects.push({ id: d.name, books });
		}
		return { projects };
	}

	// (a block body: a function returned from configureServer would be run by Vite as a post hook)
	const serve = (server) => { server.middlewares.use(async (req, res, next) => {
		const path = decodeURIComponent((req.url || '').split('?')[0]);
		if (!path.startsWith('/import/')) return next();
		const send = (status, type, body) => {
			res.statusCode = status;
			res.setHeader('Content-Type', type);
			res.setHeader('Cache-Control', 'no-store');
			res.end(body);
		};
		try {
			if (path === '/import/index.json') return send(200, 'application/json', JSON.stringify(await index()));
			const m = /^\/import\/([A-Za-z0-9_-]+)\/([^/]+)$/.exec(path);
			if (!m || !FILE.test(m[2])) return send(404, 'text/plain', 'not found');
			send(200, 'text/plain; charset=utf-8', await readFile(join(root, m[1], m[2])));
		} catch {
			send(404, 'text/plain', 'not found');
		}
	}); };

	return { name: 'import-texts', configureServer: serve, configurePreviewServer: serve };
}
