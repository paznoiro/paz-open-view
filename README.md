# paz-open-view

Viewers for file formats whose only browser readers are **copyleft (GPL)**. Each viewer is a page of its own, published to
GitHub Pages, and [Peek](https://peek.zaporion.com) loads it in a frame when a file of that type is opened. Peek's own
code stays free of GPL code; the GPL code lives here, in the open, with its source.

| Viewer | Opens | Reader (licence) | Page |
| --- | --- | --- | --- |
| DWG | AutoCAD `.dwg` (tried with AutoCAD 2000 and 2004 drawings; newer releases depend on LibreDWG's support) | LibreDWG compiled to WebAssembly (GPL-3.0), drawn by MLightCAD (MIT) | `dwg/` |

**Your file is not uploaded.** Peek hands the drawing's bytes to the frame with `postMessage`, inside your browser. The
page sends back only small events (the layer names, an error message). It makes no other request, and its
Content-Security-Policy only lets it load its own files.

## How Peek uses it

1. This repository's pipeline publishes the site to GitHub Pages. Its run summary prints the address of each viewer.
2. Peek is built with that address in `VITE_DWG_VIEWER_URL` (see Peek's `.env.example`). Left out, Peek does not
   load anything from here and a `.dwg` is only explained.
3. Opening a `.dwg` makes Peek create an iframe at that address, wait for the page's `ready` message, and send an `open`
   message with the bytes. The channel and the message shapes are in [`src/shared/protocol.ts`](src/shared/protocol.ts);
   they mirror `src/cad/protocol.ts` in Peek, so a change to one is a change to the other.

The page answers only the window that embeds it, only with the token in its own address, and only when the message comes
from `https://peek.zaporion.com` or `localhost` (for developing Peek). A copy of Peek served from another address needs
that address in `VITE_ALLOWED_PARENTS` (comma-separated origins) when this site is built.

## Develop

```sh
npm install
npm run dev            # http://localhost:5174/dwg/
npm run build          # typechecks, then writes dist/
npm run preview        # serves dist/ at http://localhost:4174/
```

To try it in Peek, build Peek (or run its dev server) with the page's address:

```sh
VITE_DWG_VIEWER_URL=http://localhost:5174/dwg/ npm run dev     # in Peek
```

## Publish

`.github/workflows/pages.yml` builds on every push to `main` and deploys `dist/` with the official Pages actions. Once,
in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The deploy job writes the address of
each viewer, and the matching Peek setting, to the run summary.

The site is plain files: `index.html` (what this is, with the licence and a link to the source of the exact build),
`dwg/` (the page and, in `dwg/files/`, the parser worker, its 10.8 MB WebAssembly module, MLightCAD's text worker and
the fallback font), `assets/` (the bundled script) and `licenses/` (the GPL text and `NOTICE.txt`).

## Add a viewer

Make a folder with an `index.html` and a script, add the page to `build.rollupOptions.input` in `vite.config.ts`, add
any files it must serve beside it in `plugins/viewerAssets.ts`, give it a line in the table above and in `index.html`,
and list its components in `NOTICE`. Keep each viewer's reader inside its own page: that is the point of this
repository.

## Licence

Free software under the **GNU General Public License, version 3 or later** — see [`LICENSE`](LICENSE). It comes with no
warranty.

Everything a visitor receives is covered by that licence or by one compatible with it, and the source of each build is
this repository at the commit the pipeline ran on (the link is on the site's home page). The components, with their
versions and licences, are listed in `licenses/NOTICE.txt` on the site, generated from `package-lock.json`:
`@mlightcad/libredwg-converter` and `@mlightcad/libredwg-web` (GPL-3.0; the latter wraps
[GNU LibreDWG](https://www.gnu.org/software/libredwg/)), `@mlightcad/cad-simple-viewer`, `@mlightcad/data-model`,
`@mlightcad/three-renderer`, `@mlightcad/mtext-renderer`, `@mlightcad/mtext-parser` and `three` (MIT), and the Liberation
Sans font (SIL OFL 1.1).

This is a summary of the engineering, not legal advice.
