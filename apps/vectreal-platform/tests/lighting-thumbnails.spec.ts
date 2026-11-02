/**
 * Every lighting setup and environment map has its thumbnail.
 *
 * The Lighting tool shows a chrome ball for each, rendered once and
 * committed; a setup or map added without rerunning
 * `render-lighting-thumbnails` would show a broken image. The URLs come from
 * an `import.meta.glob` over the committed files, so a missing file has no
 * URL at all.
 */
import { ENVIRONMENT_KEYS, LIGHTING_SETUPS } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import {
	environmentThumbnail,
	lightingSetupThumbnail
} from '../app/lib/lighting/lighting-thumbnails'

describe('lighting thumbnails', () => {
	it.each(LIGHTING_SETUPS.map(({ id }) => id))('setup %s has one', (id) => {
		expect(lightingSetupThumbnail(id)).toMatch(
			new RegExp(`/setups/${id}\\.webp`)
		)
	})

	it.each(ENVIRONMENT_KEYS)('map %s has one', (key) => {
		expect(environmentThumbnail(key)).toMatch(
			new RegExp(`/environments/${key}\\.webp`)
		)
	})
})
