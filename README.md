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

Everything runs in the browser, just in time; the site is static (SvelteKit, `adapter-static`, on Netlify). The one
exception is a small function that adds the Digital Bible Platform key to a request (see below).

| What | From | When |
|---|---|---|
| Languages, Bibles, books, text routes | the [bibles catalog](https://github.com/bcv-commons/bibles), `cdn.bibel.wiki/catalog/` | when chosen |
| The book's text | its catalog route: [helloAO](https://bible.helloao.org), USJ or Sofria on the CDN, or the [Digital Bible Platform](https://4.dbt.io) (DBT) one chapter at a time | when a chapter is chosen |
| The word alignment, the lexeme index, the verse map | bcv-commons datasets on Hugging Face, at the revisions the release pins | then |
| The song plans and the config | this site, `/data/` (from the bible-song-builder release) | then |

A Bible is listed when its catalog route is one the studio reads (helloAO, USJ or Sofria on the CDN, DBT Sofria or
plain text). In the Bible panel the aligned Bibles come first; a Bible with no bcv-commons word alignment is marked,
and then each verse is one line, without voices or moods.

### DBT and its key

DBT needs an API key, which must not reach the browser. `netlify/functions/dbt.mjs` answers
`/api/dbt/<fileset>/<BOOK>/<chapter>`: it adds the key (`DBT_API_KEY`) to the request for that one chapter and passes
DBT's answer back unchanged, and only to the site's own pages. It is the site's only server code. On Netlify the key is
an environment variable (scope Functions); locally it is in `.env` (git-ignored). For a DBT edition each chapter is
read on its own; when a singer is named in another chapter of the book, that chapter is read too.

## The release it is built on

`package.json` pins the library: `"bible-song-builder": "github:bcv-commons/bible-song-builder#vX.Y.Z"`.
`npm run data` (part of `dev` and `build`, `scripts/prepare-data.mjs`) downloads that tag's release files,
`config.json` and `plans.zip`, into `static/data/`, and makes an index of the aligned editions per language from the
compact-alignments manifest at the revision that config pins. So the library, the plans and the config always come
from one version. To move to a new release:
`npm install bible-song-builder@github:bcv-commons/bible-song-builder#vX.Y.Z` (a plain `npm install` after editing
the tag does not update it); the next `npm run data` fetches that release's files.

## Develop

```
npm install
netlify dev          # http://localhost:8888, with the DBT function (needs DBT_API_KEY in .env)
npm run dev          # http://localhost:5173 without it: everything but DBT Bibles
npm run build        # the site in build/
npm run preview
```

Both dev commands run `npm run data` first. `netlify dev` is the [Netlify CLI](https://docs.netlify.com/cli/get-started/);
it starts `npm run dev` itself and puts the function in front of it.

`SONG_DATA_DIR=<folder with config.json and plans.zip> npm run data` uses local release files instead of
downloading them.

### Texts entered by hand

A text not yet in the catalog can be tried locally: put it in `import/<project>/` (git-ignored) as
`<book><chapter>.txt` with its alignment `<book><chapter>.align`, in make-tanakh's `full_align.py` format (for
example `mat005.txt`, `mat005.align`). The dev server lists them, and the page shows a button "✎ Entered by hand:
`<project>`" that uses the text as one more Bible. An alignment is used only while its text is unchanged (it carries the
text's hash); a chapter edited since is a line per verse. The built site does not have this.

## Licences

The code is MIT (`LICENSE`). `src/lib/vendor/verse_text/` is from bcv-commons/bibles, CC0. The Bible texts, the
alignments and the plans keep their own licences, which every song's notes list.
