/**
 * The opening pose is recorded where framing completes and read wherever a
 * camera is selected after it.
 *
 * A source guard, because `SceneCamera` needs a WebGL context this package's
 * runner does not have, and dropping either half type-checks cleanly: the pure
 * rule keeps passing its own tests while a scene's pose-less default camera
 * goes back to being somewhere nothing can return to.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, 'scene-camera.tsx'),
	'utf8'
)

describe('the opening pose is wired into SceneCamera', () => {
	it('applies it to the camera being selected', () => {
		expect(source).toContain('withOpeningPose(foundCamera, openingPose)')
	})

	it('records it once framing completes, by either route', () => {
		const record = source.slice(
			source.indexOf('const completeInitialFraming'),
			source.indexOf("type: 'initial_framing_completed'")
		)
		expect(record).toContain('openingPose.current = {')
		expect(source.match(/completeInitialFraming\(\)/g)).toHaveLength(2)
	})

	it('hands it to every selection made after framing', () => {
		// The camera command and the selection effect; initialization runs before
		// any framing, so it has none to pass.
		expect(
			source.match(/sceneTransition,\s*openingPose\.current\s*\)/g)
		).toHaveLength(2)
	})

	it('leaves it out of an edit to the camera already in view', () => {
		// Changing a pose-less camera's field of view must not fly it home.
		const edit = source.slice(
			source.indexOf('if (previousSelectionKey.current === selectionKey) {'),
			source.indexOf('startTransition(selection)')
		)
		expect(edit).toContain('applyCameraInstantly(')
		expect(edit).not.toContain('openingPose')
		expect(edit).not.toContain('applyCameraInstantly(selection)')
	})

	it('forgets it with the model', () => {
		const reset = source.slice(source.indexOf('if (!hasModel) {'))
		expect(reset.slice(0, reset.indexOf('return'))).toContain(
			'openingPose.current = null'
		)
	})
})
