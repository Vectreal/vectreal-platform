import type { EnvironmentKey, LightingSetupId } from '@vctrl/core'

/**
 * Where the Lighting tool's thumbnails are served from. They are rendered
 * through the viewer by `scripts/render-lighting-thumbnails.ts` and committed
 * under `public/`; `tests/lighting-thumbnails.spec.ts` fails while any setup
 * or map has none.
 */
const THUMBNAIL_ROOT = '/media/images/lighting'

/** A setup's chrome ball and grey ball, lit by it. */
export const lightingSetupThumbnail = (id: LightingSetupId) =>
	`${THUMBNAIL_ROOT}/setups/${id}.webp`

/** A map's chrome ball. */
export const environmentThumbnail = (key: EnvironmentKey) =>
	`${THUMBNAIL_ROOT}/environments/${key}.webp`
