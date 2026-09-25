/**
 * Every screenshot the product window shows is captured, with its stage box.
 *
 * The window lays the live camera over each capture, where the capture blanked
 * the canvas or the thumbnail it replaces. A view whose screenshot is missing
 * shows a broken image, and one whose box is missing puts the camera in the
 * wrong place over a blank slot. `scripts/capture-home-product-shots.ts` writes
 * both together; Manage needs a signed-in local account, so it is the one that
 * can be left out by running the script without one.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import PRODUCT_SHOTS from './product-shots.json'

const SHOTS_DIR = resolve(import.meta.dirname, '../../assets/home/product')
const CAPTURED = ['prepare', 'manage'] as const

describe('the product window captures', () => {
	it.each(CAPTURED)(
		'%s has both themes and a stage box in the frame',
		(view) => {
			for (const theme of ['light', 'dark'])
				expect(existsSync(resolve(SHOTS_DIR, `${view}-${theme}.webp`))).toBe(
					true
				)

			const box = (PRODUCT_SHOTS as Record<string, Record<string, number>>)[
				view
			]
			expect(box).toBeDefined()
			expect(box.w).toBeGreaterThan(0.05)
			expect(box.h).toBeGreaterThan(0.05)
			expect(box.x + box.w).toBeLessThanOrEqual(1)
			expect(box.y + box.h).toBeLessThanOrEqual(1)
		}
	)
})
