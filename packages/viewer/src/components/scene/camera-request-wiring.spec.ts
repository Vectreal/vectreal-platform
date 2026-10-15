/**
 * A camera a command flew to stays until the props ask for another.
 *
 * A source guard, because `SceneCamera` needs a WebGL context this package's
 * runner does not have.
 *
 * The selection effect compared the props' camera with the camera in view. A
 * marker click moves the view without touching the props, so the next
 * unrelated re-render of `SceneCamera` read "the props changed" and flew the
 * visitor back. A click held while the scene framed was replayed right before
 * such a re-render, which is how the viewer packaging e2e lost its way-back
 * control in CI.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, 'scene-camera.tsx'),
	'utf8'
)

const between = (start: string, end: string) =>
	source.slice(
		source.indexOf(start),
		source.indexOf(end, source.indexOf(start))
	)

describe('the selection effect answers to the props alone', () => {
	it('compares the props with what the props last asked for', () => {
		const effect = between(
			'// update camera properties if props change after initialization',
			'// Only animate when switching between cameras'
		)
		expect(effect).toContain(
			'requestedSelection.current?.cameraId === selectionKey'
		)
		expect(effect).toContain(
			'requestedSelection.current.signature === signature'
		)
		expect(effect).toContain(
			'requestedSelection.current = { cameraId: selectionKey, signature }'
		)
		expect(effect).not.toContain(
			'previousSelectionKey.current === selectionKey &&'
		)
	})

	it('signs the request without the transition', () => {
		// A host's `set_transition` command changes the transition without the
		// props asking for a camera.
		expect(
			source.match(/cameraSelectionSignature\(cameras, selection\.cameraId\)/g)
		).toHaveLength(2)
		expect(source).not.toMatch(/cameraSelectionSignature\([^)]*transition/)
	})

	it('records the request where the camera is first placed', () => {
		const init = between('initializedCameraPosition.current = true', '},\n')
		expect(init).toContain('requestedSelection.current = {')
	})

	it('never lets a command stand in for a request', () => {
		const command = between(
			"if (command.type !== 'activate_camera')",
			"type: 'camera_changed'"
		)
		expect(command).toContain(
			'previousSelectionKey.current = nextSelection.cameraId'
		)
		expect(command).not.toContain('requestedSelection')
	})
})
