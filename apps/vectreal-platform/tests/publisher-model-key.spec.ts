/**
 * The publisher tells the viewer which load it is showing.
 *
 * Optimization swaps the rendered object for a new rendition of the same model.
 * The viewer keeps the camera only when it can tell that from a new model, and
 * the loader's `loadId` is the fact that says so: a load mints it,
 * `replaceModel` keeps it. Without this prop the viewer falls back to object
 * identity and every optimization pass snaps the view back to its opening
 * framing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const page = readFileSync(
	join(
		import.meta.dirname,
		'..',
		'app',
		'routes',
		'publisher-page',
		'publisher.$sceneId.tsx'
	),
	'utf8'
)

describe('the publisher canvas', () => {
	it('keys the viewer on the load, not on the rendered object', () => {
		expect(page).toMatch(
			/loadedModel\.status === 'ready' \? loadedModel\.loadId/
		)
		expect(page).toContain('modelKey={modelKey}')
	})
})
