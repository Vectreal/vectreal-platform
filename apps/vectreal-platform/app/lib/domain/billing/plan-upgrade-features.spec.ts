import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
	getUnlockedEntitlementLabels,
	UPGRADE_FEATURE_DISPLAY_LIMIT
} from './plan-upgrade-features'
import {
	PLAN_ENTITLEMENTS,
	type EntitlementKey
} from '../../../constants/plan-config'
import {
	ENTITLEMENT_DISPLAY_LABELS,
	UPGRADE_FEATURE_HIGHLIGHT_KEYS
} from '../../../constants/product-copy'

/**
 * One owner for what an upgrade unlocks.
 *
 * Two routes answered this separately and could disagree: the upgrade page took
 * the whole delta, the success page took only the part named in
 * `UPGRADE_FEATURE_HIGHLIGHT_KEYS`. A buyer could be promised a feature before
 * paying and not told they had it afterwards.
 */

const KEYS = Object.keys(PLAN_ENTITLEMENTS.free) as EntitlementKey[]

const every = (value: boolean) =>
	Object.fromEntries(KEYS.map((key) => [key, value])) as Record<
		EntitlementKey,
		boolean
	>

describe('getUnlockedEntitlementLabels', () => {
	it('states what each upgrade gains today', () => {
		expect(getUnlockedEntitlementLabels('free', 'pro')).toEqual([
			'Remove Vectreal branding'
		])
		expect(getUnlockedEntitlementLabels('free', 'business')).toEqual([
			'Remove Vectreal branding',
			'Multi-member workspace',
			'Role-based access',
			'Priority support'
		])
		expect(getUnlockedEntitlementLabels('pro', 'business')).toEqual([
			'Multi-member workspace',
			'Role-based access',
			'Priority support'
		])

		// A downgrade and a move to the same plan both gain nothing.
		expect(getUnlockedEntitlementLabels('business', 'pro')).toEqual([])
		expect(getUnlockedEntitlementLabels('pro', 'pro')).toEqual([])
	})

	/*
		The defect, against the shipped config rather than a fixture.
		`support_dedicated` is the one gainable key the highlight list omits, so the
		old success page returned nothing here while the upgrade page named it.
		Neither page can reach this pair - both target a PaidPlan - which is why it
		went unnoticed rather than why it was harmless.
	*/
	it('returns a gained entitlement the highlight list does not name', () => {
		expect(
			(UPGRADE_FEATURE_HIGHLIGHT_KEYS as readonly string[]).includes(
				'support_dedicated'
			)
		).toBe(false)

		expect(getUnlockedEntitlementLabels('business', 'enterprise')).toEqual([
			'Dedicated support channel'
		])
	})

	/*
		The cap has to sit above the highlight list, or the list filters the answer
		again by arithmetic - a cap of four reproduces the old success page exactly.
		Asserted as a literal, because comparing the output length to the constant
		the implementation slices with passes for any value of it.
	*/
	it('caps at six, which is more than the highlight list can fill', () => {
		expect(UPGRADE_FEATURE_DISPLAY_LIMIT).toBe(6)
		expect(UPGRADE_FEATURE_DISPLAY_LIMIT).toBeGreaterThan(
			UPGRADE_FEATURE_HIGHLIGHT_KEYS.length
		)

		const table = { ...PLAN_ENTITLEMENTS, free: every(false), pro: every(true) }
		const labels = getUnlockedEntitlementLabels('free', 'pro', table)

		expect(labels).toHaveLength(6)
		expect(labels.slice(0, UPGRADE_FEATURE_HIGHLIGHT_KEYS.length)).toEqual(
			UPGRADE_FEATURE_HIGHLIGHT_KEYS.map(
				(key) => ENTITLEMENT_DISPLAY_LABELS[key]
			)
		)
	})
})

/*
	Everything above holds with this module called by nobody, which is half the
	state the change fixes: the rule was not wrong, it was written twice. Neither
	route can be imported here - `billing-upgrade-success.tsx` reaches
	`user-repository.server.ts`, which calls `getDbClient()` at module scope - so
	the binding is asserted against source, the way the checkout gate's is.
*/
describe('the answer both billing pages give', () => {
	const source = (relativePath: string) =>
		readFileSync(new URL(relativePath, import.meta.url), 'utf8')

	const UPGRADE = '../../../routes/dashboard-page/billing-upgrade.tsx'
	const SUCCESS = '../../../routes/dashboard-page/billing-upgrade-success.tsx'

	/*
		The trailing paren matters: the import alone satisfies the bare name, so
		without it this passes for a route that no longer calls anything.
	*/
	it('is asked for by the page that sells the upgrade', () => {
		expect(source(UPGRADE)).toContain('getUnlockedEntitlementLabels(')
	})

	it('is asked for by the page that confirms it', () => {
		expect(source(SUCCESS)).toContain('getUnlockedEntitlementLabels(')
	})

	/*
		A call site proves a call, not whose. A route that declared its own function
		of the same name would satisfy the two above - and a local re-implementation
		is precisely what both routes held before this change. Any second answer has
		to read the entitlements to compute a delta, so neither route may name them.
	*/
	it('leaves no page deriving the delta on its own', () => {
		expect(source(UPGRADE)).not.toContain('PLAN_ENTITLEMENTS')
		expect(source(SUCCESS)).not.toContain('PLAN_ENTITLEMENTS')
	})

	/*
		The argument order, pinned to the exact call. Both sites read `(from, to)`
		and reverse cleanly: swapped, every upgrade returns [] and both pages simply
		show nothing, which is the quietest regression available here. Brittle to a
		variable rename on purpose - that fails loudly and is fixed in a second.
	*/
	it('is asked in the direction the buyer is travelling', () => {
		expect(source(UPGRADE)).toContain(
			'getUnlockedEntitlementLabels(billing.plan, plan)'
		)
		expect(source(SUCCESS)).toContain(
			'getUnlockedEntitlementLabels(basePlan, plan)'
		)
	})

	it('is imported from this module by both', () => {
		const specifier = "from '../../lib/domain/billing/plan-upgrade-features'"

		expect(source(UPGRADE)).toContain(specifier)
		expect(source(SUCCESS)).toContain(specifier)
	})
})
