import { resolveSceneMetrics } from '.'

import type { OptimizationReport } from '@vctrl/core'

/**
 * Regression cover for the worker boundary: the geometry worker's optimizer is
 * discarded once it posts back, so anything it recorded has to be transplanted
 * onto the main-thread instance. When that transplant was missing, an
 * geometry-only pass produced an empty `appliedOptimizations`, which silently
 * disabled every report-derived baseline below.
 */
const buildReport = (
	overrides: Partial<OptimizationReport> = {}
): OptimizationReport => ({
	originalSize: 8_000_000,
	optimizedSize: 5_000_000,
	compressionRatio: 1.6,
	appliedOptimizations: ['simplification', 'draco compression'],
	stats: {
		verticesCount: { before: 100_000, after: 60_000 },
		primitivesCount: { before: 50_000, after: 30_000 },
		materialsCount: { before: 3, after: 3 },
		textureBytes: { before: 2_000_000, after: 2_000_000 },
		texturesCount: { before: 4, after: 4 },
		textureResolutions: { before: [], after: [] },
		meshBytes: { before: 6_000_000, after: 3_000_000 },
		meshesCount: { before: 12, after: 12 }
	},
	...overrides
})

describe('resolveSceneMetrics with worker-sourced optimizations', () => {
	it('uses report baselines once the worker result carries applied steps', () => {
		const metrics = resolveSceneMetrics({ report: buildReport() })

		expect(metrics.vertices.initial).toBe(100_000)
		expect(metrics.vertices.current).toBe(60_000)
		expect(metrics.sceneBytes.initial).toBe(8_000_000)
		expect(metrics.hasImproved).toBe(true)
	})

	it('ignores report baselines when no step was applied', () => {
		const metrics = resolveSceneMetrics({
			report: buildReport({ appliedOptimizations: [] })
		})

		expect(metrics.vertices.initial).toBeNull()
		expect(metrics.sceneBytes.initial).toBeNull()
	})

	it('keeps report baselines for a Draco-only pass', () => {
		// Draco is measured rather than applied, so it does not go through the
		// mutate-and-record path the other steps share. It has to record itself,
		// or a pass with every other technique off reports nothing at all.
		const metrics = resolveSceneMetrics({
			report: buildReport({ appliedOptimizations: ['draco compression'] })
		})

		expect(metrics.sceneBytes.initial).toBe(8_000_000)
		expect(metrics.vertices.initial).toBe(100_000)
	})

	it('prefers the projected Draco size over the uncompressed export', () => {
		// What the runtime does when Draco is on: the working document stays
		// uncompressed, so `currentSceneBytes` carries the measured projection.
		const metrics = resolveSceneMetrics({
			report: buildReport(),
			runtime: {
				initialSceneBytes: 8_000_000,
				currentSceneBytes: 1_800_000
			}
		})

		expect(metrics.sceneBytes.current).toBe(1_800_000)
		expect(metrics.hasImproved).toBe(true)
	})
})
