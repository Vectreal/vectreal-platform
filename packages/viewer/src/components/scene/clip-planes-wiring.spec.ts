/**
 * The clip planes contain everything the viewer draws, not only the model.
 *
 * A source guard rather than a behavioral test, like
 * `model-frame-wiring.spec.ts`: this package's runner has no WebGL context.
 * `clip-planes.spec.ts` covers the rule; this pins that the planes are set
 * through it and that the shadow ground and the light handle register.
 *
 * `SceneModel` fitted near and far to the model's sphere alone, so the shadow
 * ground (2.5 × the footprint) and the light handle (2.5 × the radius out)
 * were cut off by the planes.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')

const sceneModel = read('scene-model.tsx')
const sceneShadows = read('scene-shadows.tsx')
const gizmo = read('shadow-light-gizmo.tsx')
const viewer = read('..', '..', 'vectreal-viewer.tsx')

describe('the clip planes contain what the viewer draws', () => {
	it('sets the planes from the model and the registered extents', () => {
		expect(sceneModel).toMatch(
			/resolveClipPlanes\(\s*perspectiveCamera,\s*sphere,\s*clipExtents \?\? \[\],\s*size\.height\s*\)/
		)
		expect(sceneModel).toContain('perspectiveCamera.near = near')
		expect(sceneModel).toContain('perspectiveCamera.far = far')
	})

	it('hands one registry to the model and the shadows', () => {
		expect(viewer.match(/clipExtents=\{clipExtents\}/g)).toHaveLength(2)
	})

	it('registers the shadow ground and the light handle', () => {
		expect(sceneShadows).toContain('useClipExtents(clipExtents, groundExtent)')
		expect(sceneShadows).toContain('clipExtents={clipExtents}')
		expect(gizmo).toContain('useClipExtents(clipExtents, handleExtent)')
		expect(gizmo).toContain('screenRadius: active ? ARROW_PIXELS : 0')
		expect(gizmo).toContain('scale={ARROW_PIXELS}')
	})
})
