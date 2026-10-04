/**
 * Showing another rendition for a moment changes only what is drawn.
 *
 * A source guard rather than a behavioral test, like
 * `model-frame-wiring.spec.ts`: this package's runner has no WebGL context.
 *
 * The publisher's hold-to-compare first swapped `model` itself. Shadows
 * re-measured the swapped object, so the persisted bake was replaced by a live
 * one and snapped back on release, and the animation runtime built a new mixer,
 * resetting playback both ways.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')

const sceneModel = read('scene-model.tsx')
const viewer = read('..', '..', 'vectreal-viewer.tsx')
const sceneShadows = read('scene-shadows.tsx')

const between = (source: string, start: string, end: string) =>
	source.slice(
		source.indexOf(start),
		source.indexOf(end, source.indexOf(start))
	)

describe('a displayed model only changes what is drawn', () => {
	it('keeps the model mounted, hidden, and draws the displayed object', () => {
		const drawn = between(sceneModel, 'name="focus-target"', '</group>\n\t)')
		expect(drawn).toContain('<group visible={!displayedObject}>')
		expect(drawn).toContain('<primitive object={object} />')
		expect(drawn).toContain(
			'{displayedObject && <primitive object={displayedObject} />}'
		)
		expect(sceneModel).toContain('useModelFrame(object, modelKey)')
	})

	it('prepares every drawn object for shadows and texture filtering', () => {
		expect(sceneModel).toContain(
			'(displayedObject ? [object, displayedObject] : [object])'
		)
		expect(sceneModel).toContain('}, [enableShadows, drawnObjects])')
		expect(sceneModel).toContain('}, [gl, drawnObjects])')
		const shadows = between(
			sceneModel,
			'for (const drawn of drawnObjects)',
			'}, [enableShadows'
		)
		expect(shadows).toContain('child.castShadow = enableShadows')
		const anisotropy = between(
			sceneModel,
			'const anisotropy',
			'}, [gl, drawnObjects])'
		)
		expect(anisotropy).toContain('for (const drawn of drawnObjects)')
	})

	it('hands the displayed model only to what draws or bakes it', () => {
		expect(viewer).toContain('displayedObject={displayedModel}')
		expect(between(viewer, '<SceneShadows', '/>')).toContain(
			'displayedModel={displayedModel}'
		)
		for (const consumer of [
			'<SceneAnimation',
			'<SceneShadows',
			'<ScenePostProcessing',
			'<SceneHotspots'
		]) {
			expect(between(viewer, consumer, '/>')).toContain('model={model}')
		}
		for (const consumer of [
			'<SceneAnimation',
			'<ScenePostProcessing',
			'<SceneHotspots'
		]) {
			expect(between(viewer, consumer, '/>')).not.toContain('displayedModel')
		}
	})

	it('restarts the live shadow passes on whatever is drawn', () => {
		const hold = between(
			sceneShadows,
			'const [shadowGeneration, setShadowGeneration]',
			'}, [displayedModel])'
		)
		expect(hold).toContain('useLayoutEffect(() => {')
		expect(hold).toContain('const settled = api === null || isBakeSettled(api)')
		expect(hold).toContain('holdRef.current ??= {')
		expect(hold).toContain('settledBake: settled ? api : null')
		expect(hold).toContain('if (api && !settled) api.reset()')
		const passes = between(
			sceneShadows,
			'}, [displayedModel])',
			'if (!options.enabled) return null'
		)
		expect(passes).toContain(
			'if (holdRef.current) holdRef.current.passesChanged = true'
		)
		expect(passes).toContain('contactShadow')
		expect(hold).toContain('passesChanged: false')
		expect(hold).toMatch(
			/if \(hold\.passesChanged\)\s+setShadowGeneration\(\(generation\) => generation \+ 1\)/
		)
		expect(hold).toContain(
			'else if (api && api !== hold.settledBake) api.reset()'
		)
		expect(sceneShadows).toContain('!api.temporal || api.count >= api.frames')
		const live = between(
			sceneShadows,
			'<Fragment key={shadowGeneration}>',
			'</Fragment>'
		)
		expect(live).toContain('{sized && contactShadow}')
		expect(live).toContain('{bake}')
		expect(live).toContain('<ShadowAutoCutoff')
	})
})
