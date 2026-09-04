import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveEmbedHotspotPresentation } from './embed-presentation'

const resolve = (query: string) =>
	resolveEmbedHotspotPresentation(new URLSearchParams(query))

describe('resolveEmbedHotspotPresentation', () => {
	it('draws everything when the host says nothing', () => {
		expect(resolve('')).toEqual({
			showMarkers: true,
			revealContent: true,
			color: undefined
		})
	})

	it('reads 0 as off and anything else as on, matching autoRotate', () => {
		expect(resolve('hotspots=0').showMarkers).toBe(false)
		expect(resolve('hotspots=1').showMarkers).toBe(true)
		expect(resolve('hotspots=true').showMarkers).toBe(true)
		expect(resolve('hotspotContent=0').revealContent).toBe(false)
		expect(resolve('hotspotContent=1').revealContent).toBe(true)
	})

	it('reads a present-but-empty value as on, the same as an absent one', () => {
		// `?hotspots=` is a host writing the parameter and leaving it blank,
		// which says nothing and is certainly not `0`.
		expect(resolve('hotspots=').showMarkers).toBe(true)
		expect(resolve('hotspotContent=').revealContent).toBe(true)
	})

	it('takes a hex colour, in every length CSS allows', () => {
		expect(resolve('hotspotColor=%23fc6c18').color).toBe('#fc6c18')
		expect(resolve('hotspotColor=%23fff').color).toBe('#fff')
		expect(resolve('hotspotColor=%23FC6C18AA').color).toBe('#FC6C18AA')
	})

	/**
	 * The value lands in an inline `style` on the marker root, so anything but a
	 * hex literal would let a query string write style into the page: a value
	 * like `red; background: url(...)` closes the declaration and adds its own.
	 */
	it.each([
		['a named colour', 'red'],
		['a function', 'rgb(1,2,3)'],
		['a declaration break-out', 'red; background: url(x)'],
		['a bare url', 'url(https://a.test/x.png)'],
		['a custom property', 'var(--brand)'],
		['a five-digit hex, which CSS has no such length for', '#ff00f'],
		['a hex with a non-hex digit', '#gggggg'],
		['no hash', 'fc6c18'],
		['an empty value', '']
	])('refuses %s', (_label, value) => {
		expect(
			resolveEmbedHotspotPresentation(
				new URLSearchParams([['hotspotColor', value]])
			).color
		).toBeUndefined()
	})

	it('trims the value before judging it', () => {
		expect(
			resolveEmbedHotspotPresentation(
				new URLSearchParams([['hotspotColor', '  #fc6c18  ']])
			).color
		).toBe('#fc6c18')
	})
})

/**
 * The parser above is thorough and reaches nothing on its own.
 *
 * These options are read in one place and forwarded through two components, and
 * every link in that chain type-checks perfectly while doing nothing. A source
 * guard rather than a render test, because reaching the embed page needs a
 * router, a loaded model and a canvas.
 */
describe('the presentation reaches the viewer', () => {
	const read = (file: string) =>
		readFileSync(
			join(import.meta.dirname, '../../../components/scene-embed', file),
			'utf8'
		)
	const page = read('scene-embed-page.tsx')
	const viewer = read('scene-embed-viewer.tsx')

	it('is read from the same query string as the opening commands', () => {
		expect(page).toContain('resolveEmbedHotspotPresentation(searchParams)')
	})

	it('is a channel of its own, not a ViewerCommand', () => {
		// As a command it would execute on `viewer_ready`, so suppressed markers
		// would draw first and vanish on the ready event.
		const initialCommands = page
			.split('function useInitialCommands')[1]
			?.split('\n}')[0]

		expect(initialCommands).toBeTruthy()
		expect(initialCommands).not.toContain('hotspot')
	})

	it('reaches the embed viewer, and the viewer props behind it', () => {
		expect(page).toContain('hotspotPresentation={hotspotPresentation}')
		expect(viewer).toContain('hotspotColor={hotspotPresentation?.color}')
		expect(viewer).toContain(
			'showHotspotMarkers={hotspotPresentation?.showMarkers}'
		)
		expect(viewer).toContain(
			'revealHotspotContent={hotspotPresentation?.revealContent}'
		)
	})

	it('passes undefined where no presentation was given', () => {
		// Optional chaining rather than a default object, so every surface that
		// is not an embed gets the viewer's own defaults without restating them.
		expect(viewer).toContain('hotspotPresentation?.')
		expect(viewer).not.toContain('hotspotPresentation.showMarkers')
	})
})
