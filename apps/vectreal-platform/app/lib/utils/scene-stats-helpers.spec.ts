/**
 * What gets persisted as a mesh count.
 *
 * `OptimizationStats` carries both a mesh payload size and a mesh count, and
 * their names do not both say which is which: `meshes` is bytes, `meshesCount`
 * is the quantity. This snapshot was built from the first and stored under the
 * second, so the scene detail page reported a shoe as having 2,902,308 meshes -
 * the byte size of its geometry buffer.
 *
 * Nothing held that. The two fields are both numbers, both plausible, and the
 * only place the difference is visible is a tile four layers downstream.
 */

import { describe, expect, it } from 'vitest'

import { createSceneStatsFromReport } from './scene-stats-helpers'

import type { OptimizationReport } from '@vctrl/core'

/*
  Deliberately far apart in magnitude. A fixture where the count and the byte
  size are close would let the two be swapped without the assertions moving,
  which is the whole failure being pinned.
*/
const REPORT = {
	originalSize: 8_000_000,
	optimizedSize: 5_000_000,
	compressionRatio: 1.6,
	appliedOptimizations: ['draco compression'],
	stats: {
		vertices: { before: 100_000, after: 60_000 },
		triangles: { before: 50_000, after: 30_000 },
		materials: { before: 3, after: 3 },
		textures: { before: 2_000_000, after: 1_000_000 },
		texturesCount: { before: 4, after: 4 },
		textureResolutions: { before: [], after: [] },
		/** Bytes. */
		meshes: { before: 6_000_000, after: 3_000_000 },
		/** Meshes. */
		meshesCount: { before: 12, after: 9 }
	}
} as unknown as OptimizationReport

describe('the persisted mesh count', () => {
	it('stores the count, not the payload size', () => {
		const stats = createSceneStatsFromReport(REPORT, 'scene-1', 'user-1')

		expect(stats.baseline?.meshesCount).toBe(12)
		expect(stats.optimized?.meshesCount).toBe(9)
	})

	it('never stores the byte size under that name', () => {
		/*
		  Stated as its own assertion because it is the bug, not a restatement of
		  the one above: a snapshot fed from `stats.meshes` produces 6,000,000 and
		  3,000,000, and both are perfectly valid numbers to a type checker and to
		  every screen that renders them.
		*/
		const stats = createSceneStatsFromReport(REPORT, 'scene-1', 'user-1')

		expect(stats.baseline?.meshesCount).not.toBe(6_000_000)
		expect(stats.optimized?.meshesCount).not.toBe(3_000_000)
	})

	it('keeps the counts that were already right', () => {
		/*
		  Anchored, so a snapshot that stopped writing this half of the shape
		  altogether cannot pass the two assertions above by rendering undefined.
		*/
		const stats = createSceneStatsFromReport(REPORT, 'scene-1', 'user-1')

		expect(stats.baseline?.verticesCount).toBe(100_000)
		expect(stats.baseline?.primitivesCount).toBe(50_000)
		expect(stats.optimized?.verticesCount).toBe(60_000)
		expect(stats.optimized?.texturesCount).toBe(4)
	})
})
