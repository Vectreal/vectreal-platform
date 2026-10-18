/**
 * Where the publisher decides what a hotspot view looks like to an author.
 *
 * The route mounts the whole publisher, so the lines that decide it are
 * pinned as source. What the viewer itself draws on a hotspot view - the way
 * back, the camera switcher naming the hotspot - is covered by the viewer's
 * own wiring specs.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const route = () =>
	readFileSync(
		join(
			import.meta.dirname,
			'../app/routes/publisher-page/publisher.$sceneId.tsx'
		),
		'utf8'
	)

describe('the publisher preview', () => {
	it("offers the visitor's way back (if the author kept it) and camera switcher only while previewing", () => {
		expect(route()).toContain(
			'isPreviewMode && shouldShowSceneViewReturn(presentation)'
		)
		expect(route()).toContain('showCameraControls={isPreviewMode}')
	})

	it('leaves cards to clicks in preview, and holds the content card in the editor', () => {
		const source = route()
		const held = source.slice(
			source.indexOf('revealedHotspotId={'),
			source.indexOf('showSceneViewReturn=')
		)
		expect(held).toContain('isPreviewMode')
		expect(held).toContain('? undefined')
		expect(held).toContain("openComposeTool === 'hotspots'")
		expect(held).toContain('? heldHotspotCardId')
		expect(held).toContain(': null')
	})

	it('picks markers up for editing outside preview, never flies them', () => {
		const source = route()
		const handler = source.slice(
			source.indexOf('const handleHotspotSelect'),
			source.indexOf('const cameraOptions')
		)
		// Preview passes nothing, which is what gives a marker the visitor's flight.
		expect(handler).toContain('if (isPreviewMode) return undefined')
		// Outside the Hotspot tool a click opens it on that hotspot.
		expect(handler).toContain('return openHotspotInHotspotTool')
	})

	it('starts a loaded scene with no hotspot mode to put a camera back from', () => {
		const loader = readFileSync(
			join(
				import.meta.dirname,
				'../app/hooks/scene-loader/use-scene-settings.ts'
			),
			'utf8'
		)
		expect(loader.match(/resetHotspotEditing\(\)/g)).toHaveLength(2)
		expect(loader).not.toContain('setActiveHotspotId(null)')
	})
})
