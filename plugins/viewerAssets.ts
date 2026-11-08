import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

/** Where the exact source of a build is, when it is built by the pipeline (GitHub sets both variables). */
export function sourceUrl(): string | null {
  const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha } = process.env
  return repo && sha ? `https://github.com/${repo}/tree/${sha}` : repo ? `https://github.com/${repo}` : null
}

/** Direct dependencies that end up in the page, for the notice. */
const COMPONENTS = [
  '@mlightcad/libredwg-converter', '@mlightcad/libredwg-web', '@mlightcad/cad-simple-viewer', '@mlightcad/data-model',
  '@mlightcad/three-renderer', '@mlightcad/mtext-renderer', '@mlightcad/mtext-parser', 'three',
]

function manifest(name: string): { version: string; license?: string; repository?: { url?: string } | string } {
  return JSON.parse(readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'))
}

function notice(): string {
  const source = sourceUrl()
  const lines = COMPONENTS.map((name) => {
    const pkg = manifest(name)
    const repo = (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '')
    return `* ${name} ${pkg.version} — ${pkg.license ?? 'see package'}${repo ? ` — ${repo}` : ''}`
  })
  return [
    'zap-open-view — DWG viewer',
    '',
    'This page is free software under the GNU General Public License, version 3 or later (GPL-3.0-or-later). The full text',
    'is in GPL-3.0.txt beside this file. It comes with no warranty.',
    '',
    source ? `The source this build was made from: ${source}` : 'The source this build was made from is the repository it was published from.',
    'To rebuild it: npm ci, then npm run build (the steps are in README.md and .github/workflows/pages.yml).',
    '',
    'It reads DWG drawings with LibreDWG (GPL-3.0), compiled to WebAssembly by libredwg-web and run in a Web Worker, and draws',
    'them with MLightCAD (MIT) and three.js (MIT). The version of each is pinned in package-lock.json:',
    '',
    ...lines,
    '',
    'The font is Liberation Sans (SIL Open Font License 1.1; its text is in dwg/files/fonts/LICENSE_LIBERATION).',
    '',
  ].join('\n')
}

/**
 * Ships what the DWG page needs next to it, under `dwg/files/`: the DWG parser worker and its WebAssembly module (which must
 * sit side by side), MLightCAD's text worker, and the fallback font with its list. Nothing is fetched from a CDN at runtime.
 * Also writes the notice and fills the "source" link of the pages.
 */
export function viewerAssets(): Plugin {
  const viewer = path.resolve(path.dirname(require.resolve('@mlightcad/cad-simple-viewer')), '..')
  const converter = path.dirname(require.resolve('@mlightcad/libredwg-converter'))
  const pdf = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
  const prefix = 'dwg/files/'
  const files: Record<string, Buffer | string> = {
    'libredwg-parser-worker.js': readFileSync(path.join(converter, 'libredwg-parser-worker.js')),
    'libredwg-web.wasm': readFileSync(path.join(converter, 'libredwg-web.wasm')),
    'mtext-renderer-worker.js': readFileSync(path.join(viewer, 'dist/mtext-renderer-worker.js')),
    'fonts/LiberationSans-Regular.ttf': readFileSync(path.join(pdf, 'LiberationSans-Regular.ttf')),
    'fonts/LICENSE_LIBERATION': readFileSync(path.join(pdf, 'LICENSE_LIBERATION')),
    'fonts/fonts.json': JSON.stringify([
      { name: ['Liberation Sans', 'LiberationSans', 'Arial', 'txt', 'simplex'], file: 'LiberationSans-Regular.ttf', type: 'mesh' },
    ]),
  }
  const type = (name: string) =>
    name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.js') ? 'text/javascript' : name.endsWith('.json') ? 'application/json' : name.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'application/octet-stream'
  return {
    name: 'zap-open-view-assets',
    transformIndexHtml(html) {
      const source = sourceUrl()
      return html.replaceAll('{{SOURCE_URL}}', source ?? '#').replaceAll('{{SOURCE_NOTE}}', source ? '' : ' (the link is filled in when the pipeline builds the site)')
    },
    // Not `buildStart`: the dev server runs that hook too, and its plugin context has no `emitFile`.
    generateBundle() {
      for (const [name, source] of Object.entries(files)) this.emitFile({ type: 'asset', fileName: prefix + name, source })
      this.emitFile({ type: 'asset', fileName: 'licenses/NOTICE.txt', source: notice() })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.replace(/^\//, '')
        const content = name?.startsWith(prefix) ? files[name.slice(prefix.length)] : undefined
        if (content === undefined) return next()
        res.setHeader('Content-Type', type(name!))
        res.end(content)
      })
    },
  }
}
