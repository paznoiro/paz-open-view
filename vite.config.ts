import path from 'node:path'
import { defineConfig } from 'vite'
import { viewerAssets } from './plugins/viewerAssets'

const root = path.dirname(new URL(import.meta.url).pathname)

export default defineConfig({
  // Relative, so the site works from any folder of a static host (a project page lives under /<repo>/).
  base: './',
  plugins: [viewerAssets()],
  resolve: {
    // One copy of three.js for the renderer and everything that draws with it.
    dedupe: ['three'],
  },
  server: { port: 5174 },
  preview: { port: 4174 },
  build: {
    target: 'esnext',
    modulePreload: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // One page per viewer. Add a viewer by adding a folder with an index.html here.
      input: {
        home: path.resolve(root, 'index.html'),
        dwg: path.resolve(root, 'dwg/index.html'),
      },
    },
  },
})
