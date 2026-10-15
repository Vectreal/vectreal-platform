/**
 * Hold-to-compare draws the source without making it the scene's model.
 *
 * A source guard, because a route module cannot be imported by a test. Swapping
 * `model` itself reset the shadow bake and the animation playback on every
 * press and release; the viewer's `displayedModel` changes only what is drawn,
 * which `displayed-model-wiring.spec.ts` pins on the viewer's side.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const publisherPage = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		'../app/routes/publisher-page/publisher.$sceneId.tsx'
	),
	'utf8'
)

describe('the publisher viewer during a compare', () => {
	it('keeps the loaded model and draws the compared one', () => {
		expect(publisherPage).toContain('model={file?.model}')
		expect(publisherPage).toContain('displayedModel={comparedModel?.model}')
	})
})
