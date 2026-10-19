/**
 * A hotspot's linked clip reaches the animation layer from every way a
 * hotspot is activated.
 *
 * A source guard, for the reason `hotspot-camera-wiring.spec.ts` gives: the
 * marker, the hotspot layer and the animation layer all mount inside the
 * canvas, which this runner cannot render, and deleting any one of these calls
 * type-checks and breaks nothing else. The decisions behind them are covered
 * as behavior: `hotspot-interaction.spec.ts` (when a click plays),
 * `animation-playback.spec.ts` (what playing once means) and
 * `use-animation-runtime.spec.tsx` (when the runtime mounts).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')

const viewer = read('..', '..', 'vectreal-viewer.tsx')
const layer = read('scene-hotspots.tsx')
const marker = read('hotspot-marker.tsx')
const animation = read('scene-animation.tsx')

/** The body of `name`'s `useCallback`, up to its dependency list. */
const callback = (source: string, name: string) => {
	const start = source.indexOf(`const ${name} = useCallback(`)
	expect(start).toBeGreaterThan(-1)
	return source.slice(start, source.indexOf('\n\t)', start))
}

describe('hotspot clips are wired into the viewer', () => {
	it('plays the clip on a marker click the interaction allows', () => {
		const click = callback(marker, 'handleClick')

		expect(click).toMatch(
			/if \(interaction\.playsClip && marker\.linkedAnimationClipId\) \{\s*onPlayClip\?\.\(marker\.linkedAnimationClipId\)/
		)
		expect(marker).toContain('canPlayClip: !!onPlayClip')
	})

	it('plays the clip when a host focuses the hotspot', () => {
		const focus = callback(layer, 'focusHotspot')

		expect(focus).toContain('onPlayClip?.(marker.linkedAnimationClipId)')
	})

	it('hands each marker the layer handler', () => {
		expect(layer).toContain('onPlayClip={onPlayClip}')
	})

	it('reads reduced motion at the click and sends the clip to the animation layer', () => {
		const play = callback(viewer, 'handlePlayHotspotClip')

		expect(play).toContain("type: 'play_hotspot_clip'")
		expect(play).toContain('jumpToEnd: prefersReducedMotion()')
		expect(viewer).toContain('onPlayClip={handlePlayHotspotClip}')
	})

	it('mounts the runtime for the clips of the markers this surface draws', () => {
		expect(viewer).toMatch(
			/linksHotspotClips: hotspotMarkers\.some\(\s*\(marker\) => marker\.linkedAnimationClipId !== null\s*\)/
		)
	})

	it('resolves the clip and plays it once in the animation layer', () => {
		const handler = animation.slice(
			animation.indexOf("case 'play_hotspot_clip':"),
			animation.indexOf("case 'set_animation_playing':")
		)

		expect(handler).toContain('resolveOneShotClip(')
		expect(handler).toContain("type: 'play_clip_once'")
		expect(handler).toContain('jumpToEnd: command.jumpToEnd')
	})
})
