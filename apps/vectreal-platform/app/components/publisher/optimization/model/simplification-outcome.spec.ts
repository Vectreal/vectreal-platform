import { resolveSimplificationOutcome } from '.'
import {
	buildOptimizationReport,
	buildOptimizationStats
} from '../../../../../tests/fixtures/optimization-report'

/**
 * Only the vertex counts matter here; everything else is the shared fixture.
 *
 * This used to cast a two-field object through `as unknown as
 * OptimizationReport`, which hid it from the compiler entirely - renaming
 * `vertices` to `verticesCount` in `@vctrl/core` was not a type error here, and
 * only the suite caught it.
 */
const reportWith = (before: number, after: number) =>
	buildOptimizationReport({
		stats: buildOptimizationStats({ verticesCount: { before, after } })
	})

describe('resolveSimplificationOutcome', () => {
	it('measures what actually happened rather than projecting from the ratio', () => {
		const outcome = resolveSimplificationOutcome(
			reportWith(100_000, 40_000),
			0.5
		)

		expect(outcome?.verticesBefore).toBe(100_000)
		expect(outcome?.verticesAfter).toBe(40_000)
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

	// The shape a re-baselined report has: syncing the geometry worker's output
	// back onto the main-thread optimizer used to re-derive the baseline from the
	// already-optimized buffer, so `before` equalled `after` and every run was
	// reported as "stopped at 0%" no matter how well it did. The optimizer now
	// preserves the pristine baseline across that sync, so a report like this
	// means the simplifier genuinely changed nothing.
	it('reports a run that removed nothing as falling short, not as a success', () => {
		const outcome = resolveSimplificationOutcome(
			reportWith(77_987, 77_987),
			0.5
		)

		expect(outcome?.achievedKeepRatio).toBe(1)
		expect(outcome?.fellShort).toBe(true)
	})

	it('returns null when there is nothing to measure', () => {
		expect(resolveSimplificationOutcome(null, 0.5)).toBeNull()
		expect(resolveSimplificationOutcome(reportWith(0, 0), 0.5)).toBeNull()
		expect(
			resolveSimplificationOutcome(reportWith(100, 50), undefined)
		).toBeNull()
	})
})
