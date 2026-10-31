/**
 * Every lighting setup and environment map has its thumbnail.
 *
 * The Lighting tool shows a chrome ball for each, rendered once and
 * committed; a setup or map added without rerunning
 * `render-lighting-thumbnails` would show a broken image.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { ENVIRONMENT_KEYS, LIGHTING_SETUPS } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import {
	environmentThumbnail,
	lightingSetupThumbnail
} from '../app/lib/lighting/lighting-thumbnails'

const served = (url: string) =>
	existsSync(join(import.meta.dirname, '..', 'public', url))

describe('lighting thumbnails', () => {
	it.each(LIGHTING_SETUPS.map(({ id }) => id))('setup %s has one', (id) => {
		expect(served(lightingSetupThumbnail(id))).toBe(true)
	})

	it.each(ENVIRONMENT_KEYS)('map %s has one', (key) => {
		expect(served(environmentThumbnail(key))).toBe(true)
	})
})
