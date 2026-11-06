/**
 * The full screen button is reached from the viewer, off unless a surface
 * asks for it, and shows the viewer's own container.
 *
 * A source guard, like `scene-view-return-wiring.spec.ts`: this runner cannot
 * mount the viewer, and `fullscreen-control.spec.tsx` keeps passing while the
 * lines that draw the button are deleted.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('the full screen button is wired into the viewer', () => {
	it('is off unless a surface turns it on', () => {
		expect(source).toContain('showFullscreenButton = false,')
	})

	it('hands the button to the overlay, behind its opt-in, aimed at the container', () => {
		const overlay = source.slice(
			source.indexOf('<Overlay'),
			source.indexOf('loader={loader}')
		)
		expect(overlay).toMatch(
			/fullscreenControl=\{\s*showFullscreenButton \? \(\s*<FullscreenControl/
		)
		expect(overlay).toContain('<FullscreenControl target={container} />')
	})

	it('paints the theme background behind a scene without one in full screen', () => {
		expect(source).toContain('vv:[&:fullscreen]:bg-background')
	})
})
