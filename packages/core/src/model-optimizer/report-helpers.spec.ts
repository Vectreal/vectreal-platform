/**
 * Two mesh numbers that are not the same number.
 *
 * `calculateMeshSize` sums the payload; `calculateMeshCount` counts the meshes.
 * Only the first existed, so everything downstream wanting a quantity took it -
 * and a shoe with twelve meshes was persisted, and rendered, as having
 * 2,902,308 of them.
 */

import { describe, expect, it } from 'vitest'

import { calculateMeshCount, calculateMeshSize } from './report-helpers'

import type { InspectReport } from '@gltf-transform/functions'

/*
  A size and a count that cannot be confused for one another. Real reports look
  exactly like this - a handful of meshes over megabytes of geometry - which is
  why swapping them produced a number nobody could read as a mistake.
*/
const REPORT = {
	meshes: {
		properties: [
			{ size: 2_000_000, vertices: 20_000, glPrimitives: 40_000 },
			{ size: 800_000, vertices: 15_000, glPrimitives: 30_000 },
			{ size: 102_308, vertices: 5_968, glPrimitives: 7_987 }
		]
	}
} as unknown as InspectReport

describe('mesh metrics', () => {
	it('counts meshes, and it is not their size', () => {
		expect(calculateMeshCount(REPORT)).toBe(3)
		expect(calculateMeshSize(REPORT)).toBe(2_902_308)
	})

	it('reports nothing rather than guessing when the document has no meshes', () => {
		const empty = {} as InspectReport

		expect(calculateMeshCount(empty)).toBe(0)
		expect(calculateMeshSize(empty)).toBe(0)
	})

	it('counts a mesh whose size is missing', () => {
		/*
		  A count must not be derived from the size field in any form. A mesh with
		  no recorded size still exists, and an implementation that filtered or
		  summed its way to a count would drop it.
		*/
		const partial = {
			meshes: { properties: [{ vertices: 10 }, { size: 500 }] }
		} as unknown as InspectReport

		expect(calculateMeshCount(partial)).toBe(2)
		expect(calculateMeshSize(partial)).toBe(500)
	})
})
