import { describe, expect, it } from 'vitest'

import { renderSvg } from './render-svg'
import { heightfield } from './scenes/heightfield'

const VIEWPORT = { width: 1200, height: 480 }

describe('renderSvg', () => {
	it('emits a well-formed svg element sized to the viewport', () => {
		const svg = renderSvg(heightfield(1337, { viewport: VIEWPORT }), {
			viewport: VIEWPORT
		})

		expect(svg.startsWith('<svg')).toBe(true)
		expect(svg.endsWith('</svg>')).toBe(true)
		expect(svg).toContain('viewBox="0 0 1200 480"')
	})

	it('batches segments into a small number of paths', () => {
		const svg = renderSvg(heightfield(1337, { viewport: VIEWPORT }), {
			viewport: VIEWPORT
		})
		const paths = svg.match(/<path /g) ?? []

		expect(paths.length).toBeGreaterThan(0)
		expect(paths.length).toBeLessThanOrEqual(16)
	})

	it('emits no path data when given no segments', () => {
		const svg = renderSvg([], { viewport: VIEWPORT })
		expect(svg).not.toContain('<path ')
	})

	it('omits the background rect unless asked for it', () => {
		const withBackground = renderSvg([], {
			viewport: VIEWPORT,
			background: true
		})
		const without = renderSvg([], { viewport: VIEWPORT })

		expect(withBackground).toContain('<rect')
		expect(without).not.toContain('<rect')
	})

	it('separates accent segments onto their own paths', () => {
		const svg = renderSvg(
			[
				{ x1: 0, y1: 0, x2: 10, y2: 10, opacity: 1, width: 0.55, accent: false },
				{ x1: 0, y1: 0, x2: 20, y2: 20, opacity: 1, width: 0.55, accent: true }
			],
			{ viewport: VIEWPORT }
		)

		expect(svg).toContain('rgba(206, 216, 228')
		expect(svg).toContain('rgba(252, 108, 24')
	})
})
