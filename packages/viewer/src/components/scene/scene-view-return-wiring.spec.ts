/**
 * The way back from a hotspot's camera is reached from the viewer.
 *
 * A source guard, for the same reason `hotspot-camera-wiring.spec.ts` is one:
 * this runner cannot mount the canvas, and every rule below keeps its own
 * passing tests while the line that calls it is deleted. The published-package
 * run in `viewer-e2e` clicks the marker and presses Escape for real; this pins
 * the wiring in the suite that runs on every change.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
	'utf8'
)

const between = (start: string, end: string) => {
	const from = source.indexOf(start)
	return source.slice(from, source.indexOf(end, from))
}

describe('the way back from a hotspot view is wired into the viewer', () => {
	it('routes the command to the return', () => {
		const executor = between('const executeViewerCommand', '\n\t)\n')
		expect(executor).toMatch(
			/case 'return_to_scene_view':\s*returnToSceneViewRef\.current\(\)/
		)
		expect(source).toContain('returnToSceneViewRef.current = returnToSceneView')
	})

	it('classifies cameras against every stored hotspot, not only the drawn ones', () => {
		const hook = between('useSceneViewReturn({', '})')
		expect(hook).toMatch(/\bhotspots,/)
		expect(hook).toContain('markers: hotspotMarkers')
	})

	it('records every camera the view lands on, framing included', () => {
		const funnel = between('const handleInteractionEvent', '\n\t)\n')
		expect(funnel.match(/noteCamera\(event\.cameraId\)/g)).toHaveLength(2)
	})

	it('answers Escape from the viewer container', () => {
		expect(source).toMatch(/event\.key !== 'Escape'/)
		expect(source).toContain(
			"container.addEventListener('keydown', handleKeyDown)"
		)
		expect(source).toContain('onContainerChange={setContainer}')
	})

	it('leaves Escape to an open dialog inside the viewer', () => {
		const handler = between('const handleKeyDown', 'container.addEventListener')
		expect(handler).toContain(`closest('[role="dialog"]')`)
	})

	it('is on unless a surface turns it off', () => {
		expect(source).toContain('showSceneViewReturn = true,')
	})

	it('hands the control to the overlay, behind its opt-out', () => {
		const overlay = between('<Overlay', '\n\t\t\t\t\t/>')
		expect(overlay).toMatch(
			/sceneViewReturn=\{\s*showSceneViewReturn \? \(\s*<SceneViewReturn/
		)
	})
})

describe('a card closes when the view leaves its hotspot', () => {
	const hotspots = readFileSync(
		join(import.meta.dirname, 'scene-hotspots.tsx'),
		'utf8'
	)

	it('asks the rule on every camera change and acts on it', () => {
		expect(hotspots).toMatch(
			/if \(leftOpenHotspotView\(openMarker, previous, activeCameraId \?\? null\)\) \{\s*setOpenId\(null\)/
		)
	})
})
