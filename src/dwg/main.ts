import { FontManager } from '@mlightcad/mtext-renderer'
import {
  AcApDocManager, AcApLayerService, AcApSettingManager, AcEdOpenMode, AcEdViewMode, layoutBackgroundColorFromRgb,
} from '@mlightcad/cad-simple-viewer'
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'
import { CAD_CHANNEL, MAX_CAD_BYTES, allowedParent } from '../shared/protocol'
import type { CadCommand, CadEvent, CadTheme } from '../shared/protocol'

/*
 * The DWG viewer frame. Peek loads this page in an iframe, posts the drawing's bytes to it and draws nothing itself.
 * The page is GPL-3.0 because the DWG reader (LibreDWG, compiled to WebAssembly) is; it is a separate site so that
 * licence stays with this code and does not reach Peek. Source: see the link on the landing page, one folder up.
 *
 * It follows Peek's own DXF frame (`src/cad/frame.ts` there), with the DWG reader registered.
 */
const token = location.hash.slice(1)
// Worker, WebAssembly and fonts sit in `files/` beside this page (see plugins/dwgAssets.ts).
const files = new URL('files/', location.href)
let parentOrigin: string | undefined
let manager: AcApDocManager | undefined
let opening = false
let currentTheme: CadTheme | undefined

function emit(event: CadEvent) {
  parent.postMessage({ channel: CAD_CHANNEL, token, ...event }, parentOrigin ?? '*')
}
function rgb(color: string): number {
  // Resolve the theme's CSS color in the browser, including color-mix/OKLCH palettes.
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')!
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return (r << 16) | (g << 8) | b
}
function applyTheme(theme: CadTheme) {
  currentTheme = theme
  document.documentElement.dataset.theme = theme.mode
  document.body.style.background = theme.background
  if (manager) manager.curView.backgroundColor = rgb(theme.background)
}

async function run(command: CadCommand) {
  if (command.type === 'open') {
    if (opening || manager) return
    opening = true
    if (!(command.buffer instanceof ArrayBuffer) || command.buffer.byteLength > MAX_CAD_BYTES) throw new Error('Drawing exceeds the 100 MB preview limit')
    AcApSettingManager.configure({ storageKey: 'zap-open-view-dwg-settings' })
    AcApSettingManager.instance.apply({ isShowCommandLine: false, isShowToolbar: false, isShowRibbon: false, isShowShortCutToolbar: false, isShowCoordinate: false }, { persist: false })
    // The reader runs in a worker of its own (the converter's design: the GPL parser stays in a separate bundle).
    AcDbDatabaseConverterManager.instance.register(
      AcDbFileType.DWG,
      new AcDbLibreDwgConverter({ useWorker: true, parserWorkerUrl: new URL('libredwg-parser-worker.js', files).href }),
    )
    manager = AcApDocManager.createInstance({
      container: document.getElementById('cad')!, autoResize: true,
      baseUrl: files.href, disableExport: true, useMainThreadDraw: true,
      notificationCenter: false,
      builtinOpenFileDialog: false,
    })
    if (!manager) throw new Error('Could not initialize the CAD viewer')
    // A redistributable, self-hosted fallback; no CDN requests or proprietary SHX fonts.
    FontManager.instance.setDefaultFonts(['Liberation Sans'])
    FontManager.instance.setSymbolFonts(['Liberation Sans'])
    applyTheme(command.theme)
    const background = layoutBackgroundColorFromRgb(rgb(command.theme.background))
    const opened = await manager.openDocument(command.name, command.buffer, {
      mode: AcEdOpenMode.Read, progressiveRendering: false,
      sysVars: { modelbkcolor: background, paperbkcolor: background },
    })
    if (!opened) throw new Error('This drawing could not be read. It may be damaged, or saved by a CAD program whose DWG variant is not supported.')
    applyTheme(currentTheme ?? command.theme)
    manager.curView.mode = AcEdViewMode.PAN
    const layers = new AcApLayerService(manager.curDocument.database).getLayerSummaries()
    emit({ type: 'loaded', layers: layers.map((layer) => ({ name: layer.name, visible: layer.on === 'Yes' && layer.frozen !== 'Yes' })) })
    return
  }
  if (!manager) return
  if (command.type === 'theme') applyTheme(command.theme)
  else if (command.type === 'fit') manager.curView.zoomToFitDrawing()
  else if (command.type === 'layer') {
    // Visibility lives only in this disposable parsed copy. There is no save/upload path.
    const layer = manager.curDocument.database.tables.layerTable.getAt(command.name)
    if (layer) {
      layer.isOff = !command.visible
      if (command.visible) layer.isFrozen = false
      manager.curView.updateLayer(layer, { isOff: layer.isOff, standardFlags: layer.standardFlags })
    }
  } else {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const box = canvas.getBoundingClientRect()
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: command.type === 'zoom-in' ? -120 : 120, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true }))
    }
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  // Only the page that embeds this frame, only from an address that may, and only with the frame's own token.
  if (event.source !== parent || event.data?.channel !== CAD_CHANNEL || event.data?.token !== token || !token) return
  if (!allowedParent(event.origin)) return
  if (parentOrigin && event.origin !== parentOrigin) return
  parentOrigin = event.origin
  void run(event.data as CadCommand).catch((error: unknown) => emit({ type: 'error', message: error instanceof Error ? error.message : 'Could not open drawing' }))
})
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') emit({ type: 'escape' })
}, true)
emit({ type: 'ready' })
