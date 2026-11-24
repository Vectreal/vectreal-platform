/**
 * While the canvas suspends, the loader is drawn in the viewer's own box.
 *
 * A source guard, like `composer-first-frame-wiring.spec.ts`: the canvas
 * needs a WebGL context this runner does not have. r3f's Canvas rethrows a
 * suspension from inside it to the nearest boundary outside, and that
 * boundary's fallback used to be the bare loader: outside the overlay's
 * centering layer and outside the `.vctrl-viewer` scope its colors live in,
 * it took the host page's layout, which in a flex row is the left edge.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const viewer = readFileSync(
	join(import.meta.dirname, '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe("the canvas's suspense fallback", () => {
	it('is the boxed loader, not the bare one', () => {
		expect(viewer).toContain('<Suspense fallback={suspendedLoader}>')
		expect(viewer).not.toContain('<Suspense fallback={loader}>')
	})

	it("fills the viewer's box, in its scope, with the loader in the middle", () => {
		const box = viewer.slice(viewer.indexOf('const suspendedLoader = ('))
		const classes = box.match(/cn\(\s*'([^']*)'/)?.[1].split(' ')
		expect(classes).toEqual(
			expect.arrayContaining([
				'viewer',
				'vctrl-viewer',
				'vv:flex',
				'vv:h-full',
				'vv:w-full',
				'vv:items-center',
				'vv:justify-center'
			])
		)
		expect(box).toMatch(/fallbackColorScheme\s*\),\s*className\s*\)/)
		// The loader is the box's only child, and the box is the whole fallback.
		expect(box).toMatch(
			/^const suspendedLoader = \(\s*<div[\s\S]*?>\s*\{loader\}\s*<\/div>\s*\)/
		)
	})
})
