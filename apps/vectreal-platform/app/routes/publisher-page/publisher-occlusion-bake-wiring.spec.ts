/**
 * The viewer shows a bake preview only inside the Lighting tool. That it is
 * drawn as `displayedModel` is pinned in `compare-displayed-model.spec.ts`.
 *
 * A source guard: the route module cannot be imported by a test. Which preview
 * is shown, and when, is tested in `use-occlusion-bake-preview.spec.tsx`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const publisher = readFileSync(
	join(import.meta.dirname, 'publisher.$sceneId.tsx'),
	'utf8'
)

describe('the publisher bake preview', () => {
	it('asks for the preview only while the Lighting tool is open', () => {
		expect(publisher).toMatch(
			/useShownOcclusionBake\(\s*openComposeTool === 'lighting'\s*\)/
		)
	})
})
