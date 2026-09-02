/**
 * What gets persisted as a mesh count.
 *
 * `OptimizationStats` carries both a mesh payload size and a mesh count. This
 * snapshot was built from the size and stored under the count, so the scene
 * detail page reported a shoe as having 2,902,308 meshes - the byte size of its
 * geometry buffer. Both fields say their unit in their name now
 * (`meshBytes` / `meshesCount`), which is what makes the swap below a mistake
 * someone would see rather than one they would make.
 *
 * Nothing held that. The two fields are both numbers, both plausible, and the
 * only place the difference is visible is a tile four layers downstream.
 */

import { describe, expect, it } from 'vitest'

import { createSceneStatsFromReport } from './scene-stats-helpers'
import { buildOptimizationReport } from '../../../tests/fixtures/optimization-report'

/*
  The shared fixture, which keeps every size far from every count on purpose: a
  fixture where the two were close would let them be swapped with the assertions
  below still passing, and that is the exact defect this file pins.
*/
const REPORT = buildOptimizationReport()

describe('the persisted mesh count', () => {
	it('stores the count, not the payload size', () => {
		const stats = createSceneStatsFromReport(REPORT, 'scene-1', 'user-1')

		expect(stats.baseline?.meshesCount).toBe(12)
		expect(stats.optimized?.meshesCount).toBe(9)
	})

	it('never stores the byte size under that name', () => {
		/*
		  Stated as its own assertion because it is the bug, not a restatement of
		  the one above: a snapshot fed from `stats.meshBytes` produces 6,000,000 and
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
