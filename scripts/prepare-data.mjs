#!/usr/bin/env node
// static/data/ for the site, from one bible-song-builder release (npm run data; part of dev and build).
//
//   config.json             the release's client config (config/ of bible-song-builder, its pins)
//   plan/<BOOK>/*.json      the release's song plans (plans.zip)
//   alignments/<iso>.json   catalog edition id -> its bcv-commons alignment: compact edition, verse map,
//                           full layer, from compact-alignments manifest.json at the pinned revision
//   languages.json          the languages that have an aligned edition the site can read
//   version.json            which release and which manifest
//
// The release is the tag of the bible-song-builder dependency in package.json
// (github:bcv-commons/bible-song-builder#vX.Y.Z), so the library and its data always agree.
// SONG_DATA_DIR=<folder with config.json and plans.zip> uses those files instead of downloading
// the release (for trying a release before it is published).
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static', 'data');
const REPO = 'bcv-commons/bible-song-builder';

// manifest source.provider -> the catalog's edition id prefix. PKF editions (provider cdn.bibel.wiki)
// are left out: their catalog ids differ and the site has no reader for the pkf route yet.
const PREFIX = {
	'bible.helloao.org': 'h',
	'4.dbt.io (Digital Bible Platform / Bible Brain)': 'd',
	'cdn.bibel.wiki/openbible': 'o',
	'cdn.bibel.wiki/ebible': 'e',
	'eBible.org': 'e',
	'cdn.bibel.wiki/crosswire': 'c'
};
// the providers whose text the site reads (helloAO, and the CDN's own USJ); DBT needs a key
const READABLE = new Set(['h', 'o', 'e', 'c']);

async function release() {
	const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
	const spec = (pkg.dependencies || {})['bible-song-builder'] || '';
	const tag = spec.split('#')[1];
	if (!tag) throw new Error(`package.json: bible-song-builder must be pinned to a tag (github:${REPO}#vX.Y.Z), not "${spec}"`);
	return tag;
}

async function get(url) {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
	return new Uint8Array(await r.arrayBuffer());
}

async function main() {
	const tag = process.env.SONG_DATA_DIR ? 'local' : await release();
	const stamp = join(OUT, 'version.json');
	if (tag !== 'local' && existsSync(stamp) && JSON.parse(await readFile(stamp, 'utf8')).release === tag) {
		console.log(`static/data: release ${tag} already in place`);
		return;
	}
	let config, plans;
	if (process.env.SONG_DATA_DIR) {
		config = await readFile(join(process.env.SONG_DATA_DIR, 'config.json'));
		plans = await readFile(join(process.env.SONG_DATA_DIR, 'plans.zip'));
	} else {
		const base = `https://github.com/${REPO}/releases/download/${tag}`;
		config = await get(`${base}/config.json`);
		plans = await get(`${base}/plans.zip`);
	}
	await rm(OUT, { recursive: true, force: true });
	await mkdir(OUT, { recursive: true });
	await writeFile(join(OUT, 'config.json'), config);
	let n = 0;
	for (const [path, bytes] of Object.entries(unzipSync(new Uint8Array(plans)))) {
		if (!path.startsWith('plan/') || path.endsWith('/')) continue;
		await mkdir(dirname(join(OUT, path)), { recursive: true });
		await writeFile(join(OUT, path), bytes);
		n++;
	}

	const cfg = JSON.parse(new TextDecoder().decode(config));
	const pin = cfg.pins.huggingface['compact-alignments'];
	const manifest = JSON.parse(new TextDecoder().decode(
		await get(`https://huggingface.co/datasets/${pin.repo}/resolve/${pin.revision}/manifest.json`)));
	// full alignment layers bible-song-builder pins (the BSB's), by compact edition
	const full = {};
	for (const e of Object.values(cfg.pins.editions)) if (e.full_layer && e.compact_edition) full[e.compact_edition] = e.full_layer;

	await mkdir(join(OUT, 'alignments'), { recursive: true });
	const languages = [];
	let editions = 0;
	for (const [iso, lang] of Object.entries(manifest.languages)) {
		const out = {};
		for (const [ed, e] of Object.entries(lang.editions)) {
			const p = PREFIX[e.source?.provider];
			if (!p || !e.source.edition) continue;
			out[`${p}:${e.source.edition}`] = {
				compact_edition: ed, verse_map: e.verse_map, books: e.books,
				...(full[ed] ? { full_layer: full[ed] } : {})
			};
		}
		if (!Object.keys(out).length) continue;
		await writeFile(join(OUT, 'alignments', `${iso}.json`), JSON.stringify(out));
		editions += Object.keys(out).length;
		if (Object.keys(out).some((id) => READABLE.has(id[0]))) languages.push(iso);
	}
	await writeFile(join(OUT, 'languages.json'), JSON.stringify(languages.sort()));
	await writeFile(stamp, JSON.stringify({ release: tag, 'compact-alignments': pin.revision }, null, 1));
	console.log(`static/data: release ${tag}, ${n} plan files, ${editions} aligned editions, ${languages.length} languages`);
}

await main();
