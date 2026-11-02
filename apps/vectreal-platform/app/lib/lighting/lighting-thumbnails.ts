import type { EnvironmentKey, LightingSetupId } from '@vctrl/core'

/**
 * The Lighting tool's thumbnails. They are rendered through the viewer by
 * `scripts/render-lighting-thumbnails.ts` and committed under
 * `app/assets/lighting`; `tests/lighting-thumbnails.spec.ts` fails while any
 * setup or map has none.
 *
 * Imported rather than served from `public/media`, so Vite names each for its
 * content and `/assets` serves it immutable: a rerender gets a new URL, and an
 * unchanged one is never revalidated, which `/media`'s five minutes forced on
 * every tile of the grid.
 */
const THUMBNAILS = import.meta.glob<string>('../../assets/lighting/**/*.webp', {
	eager: true,
	query: '?url',
	import: 'default'
})

const thumbnail = (folder: string, name: string) =>
	THUMBNAILS[`../../assets/lighting/${folder}/${name}.webp`]

/** A setup's chrome ball and grey ball, lit by it. */
export const lightingSetupThumbnail = (id: LightingSetupId) =>
	thumbnail('setups', id)

/** A map's chrome ball. */
export const environmentThumbnail = (key: EnvironmentKey) =>
	thumbnail('environments', key)
