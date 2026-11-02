/**
 * A host's `set_transition` is not a request for a camera.
 *
 * A source guard, because the transition reaches `SceneCamera` through a ref
 * the props never carry. Which camera the props and commands show is run on
 * the component itself in `scene-camera-selection.spec.tsx`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, 'scene-camera.tsx'),
	'utf8'
)

describe('the selection effect answers to the props alone', () => {
	it('signs the request without the transition', () => {
		// A host's `set_transition` command changes the transition without the
		// props asking for a camera.
		expect(
			source.match(/cameraSelectionSignature\(cameras, \w+\.cameraId\)/g)
		).toHaveLength(3)
		expect(source).not.toMatch(/cameraSelectionSignature\([^)]*transition/)
	})
})
