/**
 * The optimization report, checked before it is believed.
 *
 * It arrives from the browser and is persisted into `scene_stats` verbatim. It
 * used to be accepted on `typeof value === 'object'` alone and cast to
 * `OptimizationReport` - a promise to the compiler that it may stop checking,
 * made about a shape nothing had verified.
 *
 * Two consequences, and the second is the one that bites without an attacker:
 * every metric on the scene detail page was client-controlled rather than
 * server-derived, and a payload merely *missing* a field crashed the endpoint,
 * because `createSceneStatsFromReport` dereferences two levels deep. `{}` was a
 * 500 anyone could trigger on their own scene.
 */

import { describe, expect, it } from 'vitest'

import { parseOptimizationReport } from './optimization-report-guard'
import { buildOptimizationReport } from '../../../../tests/fixtures/optimization-report'

/** The report a real client sends, as JSON would deliver it. */
const valid = () => JSON.parse(JSON.stringify(buildOptimizationReport()))

describe('a report the server can trust', () => {
	it('accepts what the optimizer actually produces', () => {
		/*
		  Round-tripped through JSON on purpose: the payload arrives parsed from a
		  request body, not as the in-memory object, and a guard that only accepts
		  the latter would reject every real save.
		*/
		expect(parseOptimizationReport(valid())).not.toBeNull()
	})

	it('keeps extra properties rather than rejecting them', () => {
		/*
		  `@vctrl/core` gains metrics over time, and an older client posting a
		  smaller report is a real case. This checks that everything the
		  persistence path reads is present and sane, not that nothing else is.
		*/
		const withExtra = { ...valid(), somethingNew: { before: 1, after: 2 } }

		expect(parseOptimizationReport(withExtra)).not.toBeNull()
	})
})

describe('what it refuses', () => {
	it('refuses a body with no stats at all', () => {
		/*
		  The crash, not the attack. `createSceneStatsFromReport` reads
		  `report.stats.verticesCount.before`, so this was a `TypeError` and a 500.
		*/
		expect(parseOptimizationReport({})).toBeNull()
	})

	it.each([
		'verticesCount',
		'primitivesCount',
		'materialsCount',
		'textureBytes',
		'texturesCount',
		'meshBytes',
		'meshesCount'
	])('refuses a report missing %s', (field) => {
		/*
		  Every one, not a representative sample. Each is dereferenced two levels
		  deep on the persistence path, so any single omission is its own 500 - and
		  a guard checking six of seven reads exactly like one checking all seven.
		*/
		const report = valid()
		delete report.stats[field]

		expect(parseOptimizationReport(report)).toBeNull()
	})

	it('refuses a metric that is half a number', () => {
		const report = valid()
		report.stats.meshesCount = { before: 12 }

		expect(parseOptimizationReport(report)).toBeNull()
	})

	it.each([Number.NaN, Number.POSITIVE_INFINITY])(
		'refuses %s, which typeof calls a number',
		(value) => {
			/*
			  Both pass a bare `typeof x === 'number'`, and both reach an integer
			  column and a metrics tile. This is the case a schema check written as
			  "is it a number" still lets through.
			*/
			const report = valid()
			report.stats.verticesCount = { before: value, after: 10 }

			expect(parseOptimizationReport(report)).toBeNull()
		}
	)

	it('refuses a string where a metric belongs', () => {
		const report = valid()
		report.originalSize = '8000000'

		expect(parseOptimizationReport(report)).toBeNull()
	})

	it('refuses an array, which is also typeof object', () => {
		/*
		  Behaviour, not the line that produces it: an array has no `originalSize`
		  either, so it would fall at the field checks even without the explicit
		  `Array.isArray`. Asserted because the answer matters, not because it
		  pins one branch.
		*/
		expect(parseOptimizationReport([])).toBeNull()
	})

	it.each([null, undefined, 'a string', 42])('refuses %s', (value) => {
		expect(parseOptimizationReport(value)).toBeNull()
	})

	it('refuses applied optimizations that are not strings', () => {
		const report = valid()
		report.appliedOptimizations = [{ name: 'draco' }]

		expect(parseOptimizationReport(report)).toBeNull()
	})
})
