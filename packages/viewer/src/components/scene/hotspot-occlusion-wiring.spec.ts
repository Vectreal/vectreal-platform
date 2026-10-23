/**
 * The occlusion pass asks `isRayBlocked`, loaded on demand, never the
 * brute-force raycast.
 *
 * A source guard: the pass runs inside the canvas, which this runner cannot
 * render, and the brute-force call gives the same answer, so putting it back
 * type-checks and fails nothing else while costing every triangle of the model
 * per marker, fifteen times a second. That was the frame-rate drop on scenes
 * with hotspots. The answer itself is covered as behavior in
 * `occlusion-raycast.spec.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const layer = readFileSync(
	join(import.meta.dirname, 'scene-hotspots.tsx'),
	'utf8'
)

const viewerSrc = join(import.meta.dirname, '..', '..')

/** Every viewer source module, specs and stories aside. */
const sources = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) return sources(path)
		return /\.tsx?$/.test(entry.name) &&
			!/\.(spec|stories)\.tsx?$/.test(entry.name)
			? [path]
			: []
	})

describe('the hotspot occlusion pass', () => {
	it('tests each marker with the bounds-tree query', () => {
		expect(layer).toContain(
			'if (isRayBlocked(model, raycaster)) next.add(marker.id)'
		)
	})

	it('loads the query on demand, never with the viewer', () => {
		// three-mesh-bvh comes with it, and most scenes cast no rays at all.
		expect(layer).toContain("import('./occlusion-raycast')")
	})

	it('is imported statically by no viewer module', () => {
		// One static import anywhere - the barrel re-exporting it, say - and the
		// bundler pulls the module, and three-mesh-bvh behind it, back into the
		// chunk every viewer loads. A type-only import is erased and costs
		// nothing. One statement per match: with no semicolons in this repo, a
		// pattern free to cross a line start would run from an unrelated import
		// into the type-only one.
		const staticImporters = sources(viewerSrc).filter((path) => {
			const source = readFileSync(path, 'utf8')
			return (
				/^(?:import|export)(?!\s+type\b)(?:(?!^(?:import|export)\b)[\s\S])*?from\s+['"][^'"]*occlusion-raycast['"]/m.test(
					source
				) ||
				// A side-effect import has no `from`, and loads the module all the same.
				/^import\s+['"][^'"]*occlusion-raycast['"]/m.test(source)
			)
		})

		expect(staticImporters).toEqual([])
	})

	it('never falls back to a brute-force raycast of the model', () => {
		expect(layer).not.toMatch(/\.intersectObjects?\(/)
	})
})
