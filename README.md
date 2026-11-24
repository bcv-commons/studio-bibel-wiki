# studio.bibel.wiki

Make songs from the Bible in your language. Pick a language, a Bible, a book and a chapter, and the studio writes the
chapter's **lyrics**, a **Style** line and **notes**, ready to copy into [Suno](https://suno.com) (other music services
later). The finished songs are for [music.bibel.wiki](https://music.bibel.wiki), where people listen; this is where
they are made.

The lyrics are the Bible text itself, word for word. Line breaks, stanzas, who sings which words (voices) and the
mood of each section come from the Hebrew and Greek, through the
[bcv-commons](https://huggingface.co/bcv-commons) data and its word alignments, by the
[bible-song-builder](https://github.com/bcv-commons/bible-song-builder) library. Each song's notes give its sources
and licences.

## How it works

Everything runs in the browser, just in time; the site is static (SvelteKit, `adapter-static`, on Netlify).

| What | From | When |
|---|---|---|
| Languages, Bibles, books, text routes | the [bibles catalog](https://github.com/bcv-commons/bibles), `cdn.bibel.wiki/catalog/` | when chosen |
| The book's text | its catalog route: [helloAO](https://bible.helloao.org) chapter by chapter, or the CDN's own USJ | when a chapter is chosen |
| The word alignment, the lexeme index, the verse map | bcv-commons datasets on Hugging Face, at the revisions the release pins | then |
| The song plans and the config | this site, `/data/` (from the bible-song-builder release) | then |

A Bible is listed when its catalog route is one the studio reads (helloAO, or USJ on the CDN). It is marked "no
alignment" when bcv-commons has no word alignment for it; then each verse is one line, without voices or moods.
Bibles on the Digital Bible Platform need an API key and are not offered yet.

## The release it is built on

`package.json` pins the library: `"bible-song-builder": "github:bcv-commons/bible-song-builder#vX.Y.Z"`.
`npm run data` (part of `dev` and `build`, `scripts/prepare-data.mjs`) downloads that tag's release files,
`config.json` and `plans.zip`, into `static/data/`, and makes an index of the aligned editions per language from the
compact-alignments manifest at the revision that config pins. So the library, the plans and the config always come
from one version. To move to a new release, change the tag and run `npm install`.

## Develop

```
npm install
npm run dev          # http://localhost:5173 (runs npm run data first)
npm run build        # the site in build/
npm run preview
```

`SONG_DATA_DIR=<folder with config.json and plans.zip> npm run data` uses local release files instead of
downloading them.

## Licences

The code is MIT (`LICENSE`). `src/lib/vendor/verse_text/` is from bcv-commons/bibles, CC0. The Bible texts, the
alignments and the plans keep their own licences, which every song's notes list.
