/**
 * The viewer's accumulative shadow bake owns its lifecycle.
 *
 * A source guard, like `shadow-bake-measure-wiring.spec.ts`: the component
 * needs a WebGL context this runner does not have. `shadow-light-jitter.spec.ts`
 * and `shadow-cutoff-calibration.spec.ts` prove the pure rules; this proves the
 * bake reaches them. drei's `AccumulativeShadows`, which this replaced, gave
 * no settle signal in its static mode, so a re-bake kept the uncalibrated
 * cutoff (#980), and drew its jitter from `Math.random`, so no two bakes
 * matched (#983).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (file: string) =>
	readFileSync(join(import.meta.dirname, file), 'utf8')

const bake = read('accumulative-shadow-bake.tsx')
const lightMap = read('progressive-light-map.ts')
const shadows = read('scene-shadows.tsx')

const between = (source: string, start: string, end: string) => {
	const from = source.indexOf(start)
	expect(from).toBeGreaterThan(-1)
	const to = source.indexOf(end, from)
	expect(to).toBeGreaterThan(from)
	return source.slice(from, to)
}

describe('the accumulative shadow bake', () => {
	it('calibrates as the last step of a static bake', () => {
		const restart = between(bake, 'const restart = () => {', 'const step = ')
		expect(restart).toMatch(
			/if \(!current\.temporal\) \{\s*accumulate\(current\.frames\)\s*calibrate\(\)/
		)
	})

	it('calibrates as the last step of a temporal bake', () => {
		const step = between(bake, 'const step = () => {', 'const retune = ')
		expect(step).toContain('if (state.count >= current.frames) calibrate()')
	})

	it('reseeds the jitter on every restart and draws only from that seed', () => {
		const restart = between(bake, 'const restart = () => {', 'const step = ')
		expect(restart).toContain('state.random = createSeededRandom(BAKE_SEED)')
		expect(bake).toContain('jitterLightPositions(state.random, current.light)')
		expect(bake).not.toContain('Math.random')
	})

	it('bakes again when any bake input changes', () => {
		const deps = between(bake, 'bake.restart()', '])')
		for (const input of [
			'lightMap',
			'temporal',
			'frames',
			'scale',
			'light.amount',
			'light.radius',
			'light.ambient',
			'light.intensity',
			'px',
			'py',
			'pz',
			'light.bias',
			'light.size',
			'light.near',
			'light.far',
			'light.mapSize'
		]) {
			expect(deps).toMatch(new RegExp(`\\b${input.replace('.', '\\.')},?\\n`))
		}
	})

	it('frees its render targets and material on unmount', () => {
		expect(bake).toContain(
			'useEffect(() => () => lightMap.dispose(), [lightMap])'
		)
		expect(bake).toContain(
			'useEffect(() => () => material.dispose(), [material])'
		)
		const dispose = between(lightMap, 'dispose() {', '\n\t}')
		expect(dispose).toContain(
			'for (const buffer of this.buffers) buffer.dispose()'
		)
	})

	it('keeps its own lights lit while it silences the scene', () => {
		expect(lightMap).toContain(
			'(object as Light).isLight && object.parent !== bakeLights'
		)
		expect(bake).toContain('map.clear(lights)')
	})
})

describe('scene shadows', () => {
	it('render the owned bake, not drei’s', () => {
		expect(shadows).toContain('<AccumulativeShadowBake')
		expect(shadows).not.toMatch(/\bAccumulativeShadows\b/)
		expect(shadows).not.toMatch(/\bRandomizedLight\b/)
	})

	it('persist a live bake only once it has settled', () => {
		expect(shadows).toContain('if (!api?.settled) return null')
	})
})
