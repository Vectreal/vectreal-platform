import { resolveSimplificationOutcome } from '../app/components/publisher/optimization/model'

import type { OptimizationReport } from '@vctrl/core'

const reportWith = (before: number, after: number) =>
	({
		stats: { triangles: { before, after } }
	}) as unknown as OptimizationReport

describe('resolveSimplificationOutcome', () => {
	it('measures what actually happened rather than projecting from the ratio', () => {
		const outcome = resolveSimplificationOutcome(
			reportWith(100_000, 40_000),
			0.5
		)

		expect(outcome?.trianglesBefore).toBe(100_000)
		expect(outcome?.trianglesAfter).toBe(40_000)
		expect(outcome?.achievedKeepRatio).toBeCloseTo(0.4)
	})

	it('accepts a run that lands near the target', () => {
		// Asked to drop 50%, dropped 45%. Simplifiers rarely hit a ratio exactly.
		expect(
			resolveSimplificationOutcome(reportWith(100_000, 55_000), 0.5)?.fellShort
		).toBe(false)
	})

	// `error` is a hard stop: meshoptimizer quits once further collapses would
	// exceed the allowed deviation. A green tick here would imply the target was
	// met when it was not.
	it('flags a run the deviation limit cut short', () => {
		const outcome = resolveSimplificationOutcome(
			reportWith(100_000, 92_000),
			0.5
		)

		expect(outcome?.fellShort).toBe(true)
	})

	it('does not flag a run that overshot the target', () => {
		expect(
			resolveSimplificationOutcome(reportWith(100_000, 20_000), 0.5)?.fellShort
		).toBe(false)
	})

	it('never flags a target of "keep everything"', () => {
		expect(
			resolveSimplificationOutcome(reportWith(100_000, 100_000), 1)?.fellShort
		).toBe(false)
	})

	it('returns null when there is nothing to measure', () => {
		expect(resolveSimplificationOutcome(null, 0.5)).toBeNull()
		expect(resolveSimplificationOutcome(reportWith(0, 0), 0.5)).toBeNull()
		expect(
			resolveSimplificationOutcome(reportWith(100, 50), undefined)
		).toBeNull()
	})
})
