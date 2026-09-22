import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { describePlanChange } from './plan-change-outcome'

/**
 * The defect: every completed plan change was announced as an upgrade.
 *
 * `business -> pro` is reachable from a Business customer's own billing page -
 * `billing-settings-section.tsx` links them to `?plan=pro`, and the upgrade
 * page defaults to Pro for anyone who did not ask for Business - and the
 * confirmation page rendered "Upgraded to Pro" over "All features are available
 * immediately." while three entitlements and all eight limits were being taken
 * away. Nothing on the page named the loss, because the only list it could
 * render was the empty set of things gained.
 */
describe('describePlanChange', () => {
	const directTo = (to: string, from: string) =>
		describePlanChange({
			planId: to,
			billingPeriod: 'monthly',
			fromPlan: from,
			isDirectUpdate: true
		})

	it('refuses to call a change that takes something away an upgrade', () => {
		for (const from of ['business', 'enterprise']) {
			const outcome = directTo('pro', from)

			expect(outcome.kind).toBe('reduction')
			expect(outcome.title).toBe('Switched to Pro')
			expect(outcome.title).not.toContain('Upgraded')
			expect(outcome.subtitle).not.toContain('All features are available')
		}
	})

	it('names every entitlement the change takes away', () => {
		expect(directTo('pro', 'business').lost).toEqual([
			'Multi-member workspace',
			'Role-based access',
			'Priority support'
		])
		// Nothing is gained, which is why the page had nothing to render before.
		expect(directTo('pro', 'business').gained).toEqual([])
	})

	it('names every limit the change lowers, with both of its values', () => {
		expect(directTo('pro', 'business').reducedLimits).toEqual([
			{
				key: 'storage_bytes_total',
				label: 'Storage',
				from: '100 GB',
				to: '10 GB'
			},
			{
				key: 'storage_bytes_per_scene',
				label: 'Max scene size',
				from: '500 MB',
				to: '200 MB'
			},
			{ key: 'scenes_total', label: 'Scenes', from: '2,000', to: '200' },
			{
				key: 'scenes_published_concurrent',
				label: 'Published scenes',
				from: '500',
				to: '50'
			},
			{ key: 'projects_total', label: 'Projects', from: '200', to: '20' },
			{ key: 'folders_total', label: 'Folders', from: '5,000', to: '500' },
			{ key: 'org_seats', label: 'Team seats', from: '10', to: '1' },
			{ key: 'api_keys_per_org', label: 'API keys', from: '50', to: '10' }
		])
	})

	/*
		`null` means unlimited, and `null < 200` is true in JavaScript, so a limit
		comparison that reads it as a number gets both halves of this backwards.
		Enterprise holds `null` for all eight.
	*/
	it('reads an unlimited limit as the top of the range, not as zero', () => {
		const fromEnterprise = directTo('pro', 'enterprise')

		expect(fromEnterprise.reducedLimits).toHaveLength(8)
		expect(fromEnterprise.reducedLimits.map((limit) => limit.from)).toEqual(
			Array(2).fill('Custom').concat(Array(6).fill('Unlimited'))
		)
		// The move that raises every limit reports none of them lowered.
		expect(directTo('business', 'pro').reducedLimits).toEqual([])
	})

	it('leaves every path that really is an upgrade exactly as it read', () => {
		const message =
			'These four strings are the copy this page shows after a completed checkout. ' +
			'This change was meant to add a case, not to reword the existing ones. ' +
			'If you are here because you edited the copy on purpose, update the literal.'

		expect(directTo('pro', 'free'), message).toMatchObject({
			kind: 'upgrade',
			title: 'Upgraded to Pro',
			subtitle: 'All features are available immediately.',
			gained: ['Remove Vectreal branding'],
			// Drives the transition pill, which nothing else here asserts.
			fromPlanLabel: 'Free'
		})
		expect(directTo('business', 'free'), message).toMatchObject({
			kind: 'upgrade',
			title: 'Upgraded to Business',
			subtitle: 'All features are available immediately.'
		})
		expect(
			describePlanChange({
				planId: 'pro',
				billingPeriod: 'monthly',
				fromPlan: null,
				isDirectUpdate: false
			}),
			message
		).toMatchObject({
			kind: 'new_subscription',
			title: 'Welcome to Pro!',
			subtitle:
				'Your plan is now active and all features are available immediately.'
		})
		expect(
			describePlanChange({
				planId: 'pro',
				billingPeriod: 'annual',
				fromPlan: 'pro',
				isDirectUpdate: true
			}),
			message
		).toMatchObject({
			kind: 'period_switch',
			title: 'Switched to annual billing',
			subtitle: 'Your Pro subscription is now billed once per year.',
			/*
				Nothing changed hands, so both lists must be empty. Without this the
				period-switch guard can be dropped from the comparison and a reader
				flipping to annual is told they just unlocked branding removal.
			*/
			gained: [],
			lost: [],
			reducedLimits: []
		})
	})

	/*
		The hosted-Checkout path is not "no prior plan". `checkout.ts` takes the
		in-place branch only when `planChangeAppliesImmediately` says so, which
		needs an `active` state and both Stripe ids; a `past_due` or
		`trialing` Business org falls through to hosted Checkout carrying
		`from_plan: 'business'`. Comparing on the code path instead of on the two
		plans greeted that reader with "Welcome to Pro!" and a list of what they
		had gained.
	*/
	it('reads a reduction that arrives through hosted checkout', () => {
		const outcome = describePlanChange({
			planId: 'pro',
			billingPeriod: 'monthly',
			fromPlan: 'business',
			isDirectUpdate: false
		})

		expect(outcome.kind).toBe('reduction')
		expect(outcome.title).toBe('Switched to Pro')
		expect(outcome.gained).toEqual([])
		expect(outcome.lost).toHaveLength(3)
		expect(outcome.reducedLimits).toHaveLength(8)
		// The arrow is a display and still belongs to the direct-update path.
		expect(outcome.fromPlan).toBeNull()
	})

	it('still welcomes a genuinely new subscriber, and says what they gained', () => {
		const outcome = describePlanChange({
			planId: 'business',
			billingPeriod: 'monthly',
			fromPlan: 'free',
			isDirectUpdate: false
		})

		expect(outcome.kind).toBe('new_subscription')
		expect(outcome.title).toBe('Welcome to Business!')
		expect(outcome.gained).toEqual([
			'Remove Vectreal branding',
			'Multi-member workspace',
			'Role-based access',
			'Priority support'
		])
		expect(outcome.lost).toEqual([])
	})

	/*
		`/dashboard/billing/upgrade-success` with no query string at all: both
		params are null, so `fromPlan === planId` and the raw period-switch test
		is true. It must not draw a billing-period arrow for a page that knows
		nothing.
	*/
	it('claims nothing for a bare visit with no parameters', () => {
		const outcome = describePlanChange({
			planId: null,
			billingPeriod: null,
			fromPlan: null,
			isDirectUpdate: true
		})

		expect(outcome.kind).toBe('unconfirmed')
		expect(outcome.fromPlan).toBeNull()
		expect(outcome.planLabel).toBeNull()
	})

	it('claims nothing when the parameters name no plan checkout sells', () => {
		for (const planId of [null, 'free', 'enterprise', 'Pro', '']) {
			const outcome = describePlanChange({
				planId,
				billingPeriod: 'monthly',
				fromPlan: 'free',
				isDirectUpdate: true
			})

			expect(outcome.kind, `planId ${JSON.stringify(planId)}`).toBe(
				'unconfirmed'
			)
			expect(outcome.planLabel).toBeNull()
		}
	})

	/*
		Both plan strings arrive from the query string. `'toString' in
		PLAN_ENTITLEMENTS` is true, so a membership test written with `in` would
		accept it and index the table with it.
	*/
	it('does not accept an inherited property name as a plan', () => {
		for (const from of ['toString', 'constructor', '__proto__']) {
			// Only `fromPlan` is worth asserting: an `in`-based membership test
			// indexes the table with the string and `Object.keys` of a function is
			// empty, so `lost` comes back `[]` under the bug as well.
			expect(directTo('pro', from).fromPlan, `fromPlan ${from}`).toBeNull()
		}
	})
})

/*
  The page cannot be imported here: it reaches `user-repository.server.ts`,
  which calls `getDbClient()` at module scope. Everything above holds with this
  module called by nobody, so the one thing a unit test cannot reach is asserted
  against source, the way the checkout gate's binding is.
*/
describe('the page that confirms a plan change', () => {
	const source = readFileSync(
		new URL(
			'../../../routes/dashboard-page/billing-upgrade-success.tsx',
			import.meta.url
		),
		'utf8'
	)

	it('asks this module rather than deciding for itself', () => {
		expect(source).toContain('describePlanChange({')
	})

	/*
		The page held its own `let title` / `let subtitle` chain, and that chain is
		where the defect lived. A second one would not be caught by anything above.
	*/
	it('holds no copy chain of its own', () => {
		expect(source).not.toContain('let title')
		expect(source).not.toContain('let subtitle')
	})
})
