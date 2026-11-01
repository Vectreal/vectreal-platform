/**
 * The viewer shows a bake preview in every tool unless the model can be
 * animated, and then only inside the Lighting tool while no clip plays. That it is
 * drawn as `displayedModel` is pinned in `compare-displayed-model.spec.ts`.
 *
 * A source guard: the route module cannot be imported by a test. Which preview
 * is shown, and when, is tested in `use-bake-preview.spec.tsx`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const publisher = readFileSync(
	join(import.meta.dirname, 'publisher.$sceneId.tsx'),
	'utf8'
)

describe('the publisher bake preview', () => {
	it('tells the preview which tool is open and what animation is doing', () => {
		const call = publisher.match(/useShownBake\(\{([^}]*)\}\)/)?.[1] ?? ''
		expect(call).toMatch(/isLightingOpen: openComposeTool === 'lighting'/)
		expect(call).toMatch(/\bcanAnimate,/)
		expect(call).toMatch(/isAnimating: animationStatus\.playing/)
	})

	it('counts a model as animatable when the viewer would mount its runtime', () => {
		expect(publisher).toMatch(
			/const canAnimate =\s*\(file\?\.animations\?\.length \?\? 0\) > 0 &&\s*\(Boolean\(animation\?\.enabled\) \|\|\s*Boolean\(hotspots\?\.some\(\(hotspot\) => hotspot\.linkedAnimationClipId\)\)\)/
		)
	})
})
