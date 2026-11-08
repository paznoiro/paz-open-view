/**
 * The messages between Peek (the parent page) and a viewer frame in this repo.
 *
 * Keep this in step with `src/cad/protocol.ts` in Peek: the channel name and the message shapes are the contract. Peek
 * sends a drawing's bytes with `postMessage` and receives only small events back (layer names, errors); the bytes
 * never go anywhere else.
 */
export const CAD_CHANNEL = 'documents-cad-v1'
export const MAX_CAD_BYTES = 100 * 1024 * 1024
export interface CadLayer { name: string; visible: boolean }
export interface CadTheme { mode: 'light' | 'dark'; background: string }
export type CadCommand =
  | { type: 'open'; name: string; buffer: ArrayBuffer; theme: CadTheme }
  | { type: 'theme'; theme: CadTheme }
  | { type: 'fit' | 'zoom-in' | 'zoom-out' }
  | { type: 'layer'; name: string; visible: boolean }
export type CadEvent =
  | { type: 'ready' | 'escape' }
  | { type: 'loaded'; layers: CadLayer[] }
  | { type: 'error'; message: string }

/** Pages that may drive a viewer frame. Peek's own address, and a local dev server while building Peek. */
const DEFAULT_PARENTS = ['https://peek.zaporion.com']
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/**
 * Whether a message from this origin may open a drawing. `VITE_ALLOWED_PARENTS` (comma-separated origins, set when
 * building) replaces the default list, for a copy of Peek served from another address.
 */
export function allowedParent(origin: string): boolean {
  const configured = (import.meta.env.VITE_ALLOWED_PARENTS as string | undefined)?.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)
  return LOCAL.test(origin) || (configured?.length ? configured : DEFAULT_PARENTS).includes(origin)
}
