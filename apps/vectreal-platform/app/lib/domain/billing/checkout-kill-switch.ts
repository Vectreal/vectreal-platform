/**
 * Whether checkout may proceed, and why not when it may not.
 *
 * `billing-checkout` is a kill switch, and a switch that only closes while an
 * unrelated analytics client happens to be reachable is not one. The guard used
 * to sit inside `if (posthog)`, which made "the switch could not be consulted"
 * indistinguishable from "the switch said yes" - so while `getPosthogClient()`
 * returned `null` on every production request, checkout was not gated at all.
 * The switch believed to be holding it shut had never been read.
 *
 * Only an explicit `true` opens it. Everything else denies.
 *
 * There are two denials rather than the three the shape invites, because
 * posthog-node cannot tell an outage from an off switch. `getFlags` catches its
 * own network failure and returns `{ success: false }`
 * (`@posthog/core/dist/posthog-core-stateless.mjs:384`), the caller turns that
 * into `undefined` (`:478`), and `isFeatureEnabled` passes `undefined` through
 * (`posthog-node/dist/client.mjs:544`) - the same `undefined` it returns for a
 * flag the project does not have. A 5xx, a timeout and a deleted flag are one
 * value by the time they arrive here, so claiming to distinguish them would be
 * a comment that reads well and is false.
 *
 * What is knowable is whether there was a client at all, and that is worth
 * keeping separate: no client means this deployment is misconfigured, which is
 * a 503 and somebody's problem, while a switch that did not say yes is a 403
 * and may well be deliberate.
 *
 * Pure, and deliberately not `.server`: the route module that enforces this
 * cannot be loaded by a test - its import graph reaches
 * `asset-storage.server.ts`, which calls `getDbClient()` at module scope - so
 * the decision lives here, where it can be.
 */

export const BILLING_CHECKOUT_FLAG = 'billing-checkout'

/**
 * The one method this needs from a PostHog client, so a test can supply it
 * without a network or a real client.
 *
 * `isFeatureEnabled` is deprecated in posthog-node 5.48.1 in favour of
 * `evaluateFlags`. Kept because it is what both call sites already used and
 * migrating the API is its own change; the deprecation warning is emitted once
 * per process.
 */
export interface CheckoutFlagSource {
	isFeatureEnabled(
		key: string,
		distinctId: string
	): Promise<boolean | undefined>
}

export type CheckoutGateDenial = 'unconfigured' | 'not_enabled'

export type CheckoutGate =
	{ allowed: true } | { allowed: false; reason: CheckoutGateDenial }

/**
 * Total, so a new denial reason cannot be added without deciding what it says.
 *
 * The messages are deliberately plain. A denial reaches a customer in a banner
 * on the upgrade page, so it is not the place to name PostHog or the
 * deployment's configuration; the diagnosis belongs in the server log, and the
 * action reports it there.
 */
export const CHECKOUT_GATE_DENIAL: Record<
	CheckoutGateDenial,
	{ status: number; message: string }
> = {
	unconfigured: {
		status: 503,
		message: 'Billing checkout is temporarily unavailable.'
	},
	not_enabled: {
		status: 403,
		message: 'Billing checkout is currently disabled.'
	}
}

export async function resolveCheckoutGate(
	flags: CheckoutFlagSource | undefined,
	distinctId: string
): Promise<CheckoutGate> {
	if (!flags) {
		return { allowed: false, reason: 'unconfigured' }
	}

	try {
		const enabled = await flags.isFeatureEnabled(
			BILLING_CHECKOUT_FLAG,
			distinctId
		)

		return enabled === true
			? { allowed: true }
			: { allowed: false, reason: 'not_enabled' }
	} catch {
		/*
		  Not reachable through a flag fetch, which swallows its own failures -
		  see the note above. This covers a programming error inside the client
		  and exists so that one cannot take the checkout route down with it.
		*/
		return { allowed: false, reason: 'not_enabled' }
	}
}
