/**
 * Static plan entitlement and quota-limit configuration.
 *
 * This file is the source of truth for entitlement keys and numeric limits per
 * plan. It used to mirror a set of PRD documents; those were stale and have
 * been removed, so change plans here and nowhere else.
 *
 * Values are intentionally NOT hard-coded in guard logic - callers read them
 * through `hasEntitlement` and `getQuotaLimit` in `entitlement-service.server`.
 *
 * NOTE: Enterprise "Custom" / "Unlimited" values are expressed as
 *       `null` (= unlimited / set via org_limit_overrides).
 */

export type Plan = 'free' | 'pro' | 'business' | 'enterprise'

/**
 * The plans a customer can buy without talking to us.
 *
 * `enterprise` is a `Plan` and is deliberately absent: it is sales-led, and
 * checkout must refuse it.
 *
 * Fourteen places used to restate this pair, in six shapes - a Set, two arrays,
 * a return type, a `useState` parameter, five inline comparisons and a cast -
 * and three of them carried a comment saying they mirrored one of the others.
 * A mirror is not an owner. `enterprise` becoming self-serve had to be
 * remembered in fourteen places, and the cast in `pricing-cards-section` would
 * not have complained about being wrong.
 */
export type PaidPlan = Extract<Plan, 'pro' | 'business'>

/*
  Total by construction: a member added to `PaidPlan` and not listed here fails
  to compile, which is what keeps the type and the runtime list in step. This is
  the same device `DASHBOARD_OPERATION_ROLES` uses for the permission table.
*/
const PURCHASABLE: Record<PaidPlan, true> = {
	pro: true,
	business: true
}

export const PURCHASABLE_PLANS = Object.keys(PURCHASABLE) as readonly PaidPlan[]

/*
  A Set, not `in` and not the record itself.

  `in` and plain property access walk the prototype chain, so `'toString' in
  PURCHASABLE` is true. That is the exact hole #878 closed on the canceled page,
  where `?plan=toString` found a truthy label and rendered a function body. A
  Set has no prototype entries, so this stays a validator for untrusted input
  rather than becoming the same trap one layer down.
*/
const PURCHASABLE_LOOKUP: ReadonlySet<string> = new Set(PURCHASABLE_PLANS)

/**
 * Whether a value names a plan checkout sells.
 *
 * Takes `unknown` because most callers are validating something from outside
 * the app: a search parameter, a JSON body, Stripe price metadata.
 */
export function isPaidPlan(value: unknown): value is PaidPlan {
	return typeof value === 'string' && PURCHASABLE_LOOKUP.has(value)
}

export type BillingState =
	| 'none'
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'unpaid'
	| 'canceled'
	| 'paused'
	| 'incomplete'
	| 'incomplete_expired'

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

export type EntitlementKey =
	// Core Publishing
	| 'scene_upload'
	| 'scene_optimize'
	| 'scene_publish'
	| 'scene_embed'
	// Optimization
	| 'optimization_preset_low'
	| 'optimization_preset_high'
	| 'optimization_custom_params'
	// Embed & Viewer
	| 'embed_domain_allowlist'
	| 'embed_branding_removal'
	| 'embed_viewer_customisation'
	// Organisation & Collaboration
	| 'org_multi_member'
	| 'org_roles'
	| 'org_api_keys'
	// Support
	| 'support_community'
	| 'support_email'
	| 'support_priority'
	| 'support_dedicated'

/** Boolean entitlement matrix keyed by plan. */
export const PLAN_ENTITLEMENTS: Record<
	Plan,
	Record<EntitlementKey, boolean>
> = {
	free: {
		// Core Publishing
		scene_upload: true,
		scene_optimize: true,
		scene_publish: true,
		scene_embed: true,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_high: true,
		optimization_custom_params: true,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: false,
		embed_viewer_customisation: true,
		// Organisation & Collaboration
		org_multi_member: false,
		org_roles: false,
		org_api_keys: true,
		// Support
		support_community: true,
		support_email: true,
		support_priority: false,
		support_dedicated: false
	},
	pro: {
		// Core Publishing
		scene_upload: true,
		scene_optimize: true,
		scene_publish: true,
		scene_embed: true,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_high: true,
		optimization_custom_params: true,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: true,
		embed_viewer_customisation: true,
		// Organisation & Collaboration
		org_multi_member: false,
		org_roles: false,
		org_api_keys: true,
		// Support
		support_community: true,
		support_email: true,
		support_priority: false,
		support_dedicated: false
	},
	business: {
		// Core Publishing
		scene_upload: true,
		scene_optimize: true,
		scene_publish: true,
		scene_embed: true,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_high: true,
		optimization_custom_params: true,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: true,
		embed_viewer_customisation: true,
		// Organisation & Collaboration
		org_multi_member: true,
		org_roles: true,
		org_api_keys: true,
		// Support
		support_community: true,
		support_email: true,
		support_priority: true,
		support_dedicated: false
	},
	enterprise: {
		// Core Publishing
		scene_upload: true,
		scene_optimize: true,
		scene_publish: true,
		scene_embed: true,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_high: true,
		optimization_custom_params: true,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: true,
		embed_viewer_customisation: true,
		// Organisation & Collaboration
		org_multi_member: true,
		org_roles: true,
		org_api_keys: true,
		// Support
		support_community: true,
		support_email: true,
		support_priority: true,
		support_dedicated: true
	}
}

// ---------------------------------------------------------------------------
// Quota limits
// ---------------------------------------------------------------------------

export type LimitKey =
	| 'storage_bytes_total'
	| 'storage_bytes_per_scene'
	| 'scenes_total'
	| 'scenes_published_concurrent'
	| 'projects_total'
	| 'folders_total'
	| 'org_seats'
	| 'api_keys_per_org'

/**
 * Numeric quota limits per plan.
 * `null` = unlimited (enterprise custom; read from org_limit_overrides).
 */
export const PLAN_LIMITS: Record<Plan, Record<LimitKey, number | null>> = {
	free: {
		storage_bytes_total: 500 * 1024 * 1024, // 500 MB
		storage_bytes_per_scene: 50 * 1024 * 1024, // 50 MB
		scenes_total: 10,
		scenes_published_concurrent: 3,
		projects_total: 1,
		folders_total: 25,
		org_seats: 1,
		api_keys_per_org: 2
	},
	pro: {
		storage_bytes_total: 10_240 * 1024 * 1024, // 10 GB
		storage_bytes_per_scene: 200 * 1024 * 1024, // 200 MB
		scenes_total: 200,
		scenes_published_concurrent: 50,
		projects_total: 20,
		folders_total: 500,
		org_seats: 1,
		api_keys_per_org: 10
	},
	business: {
		storage_bytes_total: 102_400 * 1024 * 1024, // 100 GB
		storage_bytes_per_scene: 500 * 1024 * 1024, // 500 MB
		scenes_total: 2_000,
		scenes_published_concurrent: 500,
		projects_total: 200,
		folders_total: 5_000,
		org_seats: 10,
		api_keys_per_org: 50
	},
	enterprise: {
		storage_bytes_total: null, // Custom
		storage_bytes_per_scene: null, // Custom
		scenes_total: null, // Unlimited
		scenes_published_concurrent: null, // Unlimited
		projects_total: null, // Unlimited
		folders_total: null, // Unlimited
		org_seats: null, // Custom
		api_keys_per_org: null // Unlimited
	}
}

/** Billing states that downgrade effective access to free-tier plan baselines. */
export const BILLING_STATES_DOWNGRADED_TO_FREE: ReadonlySet<BillingState> =
	new Set(['canceled', 'incomplete', 'incomplete_expired'])

/**
 * Billing states with read-only access semantics.
 * These states keep the subscribed plan context but block mutation actions.
 */
export const READ_ONLY_BILLING_STATES: ReadonlySet<BillingState> = new Set([
	'unpaid',
	'paused'
])

/** Billing states that do not grant full plan access. */
export const BLOCKING_BILLING_STATES: ReadonlySet<BillingState> = new Set([
	...BILLING_STATES_DOWNGRADED_TO_FREE,
	...READ_ONLY_BILLING_STATES
])

/**
 * Returns true if the billing state allows full plan access.
 * States not in the blocking set grant full entitlements for the subscribed plan.
 */
export function isBillingStateActive(state: BillingState): boolean {
	return !BLOCKING_BILLING_STATES.has(state)
}

/** Returns true when the billing state should be treated as free-tier. */
export function isBillingStateDowngradedToFree(state: BillingState): boolean {
	return BILLING_STATES_DOWNGRADED_TO_FREE.has(state)
}

/** Returns true when the billing state should be treated as read-only. */
export function isBillingStateReadOnly(state: BillingState): boolean {
	return READ_ONLY_BILLING_STATES.has(state)
}
