import { resolveSceneMetrics } from '.'
import { buildOptimizationReport } from '../../../../tests/fixtures/optimization-report'

/**
 * Regression cover for the worker boundary: the geometry worker's optimizer is
 * discarded once it posts back, so anything it recorded has to be transplanted
 * onto the main-thread instance. When that transplant was missing, an
 * geometry-only pass produced an empty `appliedOptimizations`, which silently
 * disabled every report-derived baseline below.
 */
const buildReport = buildOptimizationReport

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

	/*
	  Only a publish records the current size, so a scene saved but never
	  published has none, and reopening it hydrates no runtime result either.
	  It is then what it stores, which the runtime measured from its manifest,
	  not the original it was uploaded as.
	*/
	it('takes what a reopened, unpublished scene stores as its current size', () => {
		const metrics = resolveSceneMetrics({
			stats: {
				initialSceneBytes: 200_000_000,
				currentSceneBytes: null
			} as never,
			runtime: { initialSceneBytes: 20_000_000, currentSceneBytes: null }
		})

		expect(metrics.sceneBytes).toEqual({
			initial: 200_000_000,
			current: 20_000_000
		})
	})

	it('takes the published size over what a published scene stores', () => {
		const metrics = resolveSceneMetrics({
			stats: {
				initialSceneBytes: 200_000_000,
				currentSceneBytes: 3_000_000
			} as never,
			runtime: { initialSceneBytes: 12_000_000, currentSceneBytes: null }
		})

		expect(metrics.sceneBytes.current).toBe(3_000_000)
	})
})
