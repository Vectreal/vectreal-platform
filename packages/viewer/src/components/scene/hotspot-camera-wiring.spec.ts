/**
 * The aim derivation reaches the camera that uses it.
 *
 * A source guard rather than a behavioural test, and it exists because deleting
 * the one line that applies `resolveHotspotCameraTargets` type-checks cleanly
 * and breaks nothing else: the module keeps its own eight passing tests while
 * every hotspot camera silently goes back to looking at the middle of the model.
 *
 * That is the exact shape of the defect this whole change was written to fix - a
 * complete implementation with nothing calling it - so it gets a guard rather
 * than a comment. This package's runner loads `.ts` only (components need a
 * WebGL context), so reading the source is the coverage available here.
 *
 * Its limits, stated plainly: it pins that the derivation is computed from the
 * camera list and handed to `SceneCamera`, not that the camera then flies
 * anywhere. Renaming the local is meant to fail it - re-point the guard rather
 * than deleting it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('hotspot camera aiming is wired into the viewer', () => {
	it('derives the aimed camera list from the cameras and the hotspots', () => {
		expect(source).toContain('resolveHotspotCameraTargets(')
		// Both inputs, or the aim cannot follow a marker the author moves.
		expect(source).toMatch(
			/resolveHotspotCameraTargets\(\s*cameraOptions\?\.cameras,\s*hotspots\s*\)/
		)
	})

	it('hands that list to SceneCamera, after the spread that would shadow it', () => {
		const mount = source.slice(
			source.indexOf('<SceneCamera'),
			source.indexOf('/>', source.indexOf('<SceneCamera'))
		)

		expect(mount).toContain('cameras={aimedCameras}')
		// `{...cameraOptions}` carries the unaimed list, so order decides which wins.
		expect(mount.indexOf('{...cameraOptions}')).toBeLessThan(
			mount.indexOf('cameras={aimedCameras}')
		)
	})
})
