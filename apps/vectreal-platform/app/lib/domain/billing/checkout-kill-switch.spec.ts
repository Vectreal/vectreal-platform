import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
	BILLING_CHECKOUT_FLAG,
	CHECKOUT_GATE_DENIAL,
	resolveCheckoutGate,
	type CheckoutFlagSource
} from './checkout-kill-switch'

/**
 * The defect these are aimed at is not "the flag was read wrong". It is that
 * failing to read it counted as permission.
 *
 * The guard sat inside `if (posthog)`, so on every production request where
 * `getPosthogClient()` returned `null` - which was every one of them until the
 * runtime secrets landed - the switch was skipped rather than consulted, and
 * checkout ran ungated while it was believed to be held shut.
 */
describe('resolveCheckoutGate', () => {
	const source = (
		impl: CheckoutFlagSource['isFeatureEnabled']
	): CheckoutFlagSource => ({ isFeatureEnabled: impl })

	it('allows checkout only when the flag is explicitly on', async () => {
		const gate = await resolveCheckoutGate(
			source(async () => true),
			'user-1'
		)

		expect(gate).toEqual({ allowed: true })
	})

	it('passes the flag key and the caller through to the client', async () => {
		const seen: Array<[string, string]> = []
		await resolveCheckoutGate(
			source(async (key, distinctId) => {
				seen.push([key, distinctId])
				return true
			}),
			'user-42'
		)

		expect(seen).toEqual([[BILLING_CHECKOUT_FLAG, 'user-42']])
	})

	// The branch that was the bug: no client meant no guard at all.
	it('denies when PostHog is not configured', async () => {
		const gate = await resolveCheckoutGate(undefined, 'user-1')

		expect(gate).toEqual({ allowed: false, reason: 'unconfigured' })
	})

	/*
	  One case, deliberately, because posthog-node gives us one value.
	  `isFeatureEnabled` answers `undefined` both for a flag the project does not
	  have and for a flag it could not fetch: `getFlags` catches its own network
	  failure and returns `{ success: false }`, which becomes `undefined` two
	  frames later. Asserting these three separately would be asserting a
	  distinction the client cannot make.
	*/
	it.each([
		['the flag is off', false],
		['the project has no such flag', undefined],
		['the fetch failed, which arrives as undefined', undefined]
	])('denies when %s', async (_case, answer) => {
		const gate = await resolveCheckoutGate(
			source(async () => answer),
			'user-1'
		)

		expect(gate).toEqual({ allowed: false, reason: 'not_enabled' })
	})

	it('denies rather than propagating when the client itself throws', async () => {
		const gate = await resolveCheckoutGate(
			source(async () => {
				throw new Error('client bug')
			}),
			'user-1'
		)

		expect(gate).toEqual({ allowed: false, reason: 'not_enabled' })
	})

	/*
	  A misconfigured deployment is not the same as a switch someone turned off,
	  and it is the one difference that survives posthog-node: we check for the
	  client ourselves. 503 says "this deployment is broken", 403 says "no".
	*/
	it('separates a broken deployment from a closed switch', () => {
		expect(CHECKOUT_GATE_DENIAL.unconfigured.status).toBe(503)
		expect(CHECKOUT_GATE_DENIAL.not_enabled.status).toBe(403)
	})

	/*
	  These reach a customer in a banner on the upgrade page. The diagnosis goes
	  to the server log instead, which is why no message may name PostHog, the
	  flag, or the deployment's configuration.
	*/
	it('keeps infrastructure out of what the reader is shown', () => {
		for (const { message } of Object.values(CHECKOUT_GATE_DENIAL)) {
			expect(message.toLowerCase()).not.toContain('posthog')
			expect(message.toLowerCase()).not.toContain('flag')
			expect(message.toLowerCase()).not.toContain('deployment')
		}
	})
})

/*
  Everything above holds with this module called by nothing at all, which is the
  state the change fixes: the rule was never wrong, it was skipped. Neither
  route can be imported here - both reach `asset-storage.server.ts`, which calls
  `getDbClient()` at module scope - so the binding is asserted against source,
  which is crude and is the only check that fails for the right reason without a
  running server.
*/
describe('the gate is the one both surfaces consult', () => {
	const source = (relativePath: string) =>
		readFileSync(new URL(relativePath, import.meta.url), 'utf8')

	const CHECKOUT = '../../../routes/api/billing/checkout.ts'
	const UPGRADE = '../../../routes/dashboard-page/billing-upgrade.tsx'

	it('is called by the action that enforces it', () => {
		expect(source(CHECKOUT)).toContain('resolveCheckoutGate(')
	})

	it('is called by the page that mirrors it', () => {
		expect(source(UPGRADE)).toContain('resolveCheckoutGate(')
	})

	/*
	  An `isFeatureEnabled` call outside this module is a second place deciding
	  the same thing, and the last two both decided it wrong. The component's
	  `useFeatureFlagEnabled` is a different symbol on a different layer and is
	  deliberately still there - it may close the button, never open it.
	*/
	it('leaves no surface reading the flag on its own', () => {
		expect(source(CHECKOUT)).not.toContain('isFeatureEnabled')
		expect(source(UPGRADE)).not.toContain('.isFeatureEnabled')
	})

	it('lets the client close the button but never open it', () => {
		expect(source(UPGRADE)).toContain(
			'serverCheckoutEnabled && (clientFlagEnabled ?? true)'
		)
	})
})
