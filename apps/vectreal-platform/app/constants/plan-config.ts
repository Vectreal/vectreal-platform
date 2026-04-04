/**
 * Static plan entitlement and quota-limit configuration.
 *
 * These maps are the runtime counterparts of:
 *   - prd/03-entitlements.md (entitlement keys per plan)
 *   - prd/02-limits-and-quotas.md (numeric limits per plan)
 *
 * Values are intentionally NOT hard-coded in guard logic — callers should
 * use the entitlement-service or usage-service helpers instead.
 *
 * NOTE: Enterprise "Custom" / "Unlimited" values are expressed as
 *       `null` (= unlimited / set via org_limit_overrides).
 */

export type Plan = 'free' | 'pro' | 'business' | 'enterprise'

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
	| 'scene_preview_private'
	| 'scene_version_history'
	// Optimization
	| 'optimization_preset_low'
	| 'optimization_preset_medium'
	| 'optimization_preset_high'
	| 'optimization_custom_params'
	| 'optimization_priority_queue'
	// Embed & Viewer
	| 'embed_domain_allowlist'
	| 'embed_branding_removal'
	| 'embed_viewer_customisation'
	| 'embed_analytics'
	| 'embed_ar_mode'
	// Organisation & Collaboration
	| 'org_multi_member'
	| 'org_roles'
	| 'org_api_keys'
	| 'org_sso'
	| 'org_audit_log'
	// Data & Compliance
	| 'data_export'
	| 'data_residency_eu'
	| 'data_residency_custom'
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
		scene_preview_private: false,
		scene_version_history: false,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_medium: true,
		optimization_preset_high: false,
		optimization_custom_params: false,
		optimization_priority_queue: false,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: false,
		embed_viewer_customisation: false,
		embed_analytics: false,
		embed_ar_mode: false,
		// Organisation & Collaboration
		org_multi_member: false,
		org_roles: false,
		org_api_keys: true,
		org_sso: false,
		org_audit_log: false,
		// Data & Compliance
		data_export: false,
		data_residency_eu: false,
		data_residency_custom: false,
		// Support
		support_community: true,
		support_email: false,
		support_priority: false,
		support_dedicated: false
	},
	pro: {
		// Core Publishing
		scene_upload: true,
		scene_optimize: true,
		scene_publish: true,
		scene_embed: true,
		scene_preview_private: true,
		scene_version_history: true,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_medium: true,
		optimization_preset_high: true,
		optimization_custom_params: true,
		optimization_priority_queue: false,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: true,
		embed_viewer_customisation: true,
		embed_analytics: true,
		embed_ar_mode: true,
		// Organisation & Collaboration
		org_multi_member: false,
		org_roles: false,
		org_api_keys: true,
		org_sso: false,
		org_audit_log: false,
		// Data & Compliance
		data_export: true,
		data_residency_eu: false,
		data_residency_custom: false,
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
		scene_preview_private: true,
		scene_version_history: true,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_medium: true,
		optimization_preset_high: true,
		optimization_custom_params: true,
		optimization_priority_queue: true,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: true,
		embed_viewer_customisation: true,
		embed_analytics: true,
		embed_ar_mode: true,
		// Organisation & Collaboration
		org_multi_member: true,
		org_roles: true,
		org_api_keys: true,
		org_sso: false,
		org_audit_log: false,
		// Data & Compliance
		data_export: true,
		data_residency_eu: true,
		data_residency_custom: false,
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
		scene_preview_private: true,
		scene_version_history: true,
		// Optimization
		optimization_preset_low: true,
		optimization_preset_medium: true,
		optimization_preset_high: true,
		optimization_custom_params: true,
		optimization_priority_queue: true,
		// Embed & Viewer
		embed_domain_allowlist: true,
		embed_branding_removal: true,
		embed_viewer_customisation: true,
		embed_analytics: true,
		embed_ar_mode: true,
		// Organisation & Collaboration
		org_multi_member: true,
		org_roles: true,
		org_api_keys: true,
		org_sso: true,
		org_audit_log: true,
		// Data & Compliance
		data_export: true,
		data_residency_eu: true,
		data_residency_custom: true,
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
	| 'org_seats'
	| 'optimization_runs_per_month'
	| 'optimization_concurrent'
	| 'api_requests_per_minute'
	| 'api_requests_per_month'
	| 'api_keys_per_org'
	| 'embed_bandwidth_gb_per_month'
	| 'preview_loads_per_month'

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
		org_seats: 1,
		optimization_runs_per_month: 20,
		optimization_concurrent: 1,
		api_requests_per_minute: 30,
		api_requests_per_month: 5_000,
		api_keys_per_org: 2,
		embed_bandwidth_gb_per_month: 5,
		preview_loads_per_month: 10_000
	},
	pro: {
		storage_bytes_total: 10_240 * 1024 * 1024, // 10 GB
		storage_bytes_per_scene: 200 * 1024 * 1024, // 200 MB
		scenes_total: 200,
		scenes_published_concurrent: 50,
		projects_total: 20,
		org_seats: 1,
		optimization_runs_per_month: 500,
		optimization_concurrent: 3,
		api_requests_per_minute: 300,
		api_requests_per_month: 100_000,
		api_keys_per_org: 10,
		embed_bandwidth_gb_per_month: 100,
		preview_loads_per_month: 500_000
	},
	business: {
		storage_bytes_total: 102_400 * 1024 * 1024, // 100 GB
		storage_bytes_per_scene: 500 * 1024 * 1024, // 500 MB
		scenes_total: 2_000,
		scenes_published_concurrent: 500,
		projects_total: 200,
		org_seats: 10,
		optimization_runs_per_month: 5_000,
		optimization_concurrent: 10,
		api_requests_per_minute: 1_000,
		api_requests_per_month: 1_000_000,
		api_keys_per_org: 50,
		embed_bandwidth_gb_per_month: 1_000,
		preview_loads_per_month: null // Unlimited
	},
	enterprise: {
		storage_bytes_total: null, // Custom
		storage_bytes_per_scene: null, // Custom
		scenes_total: null, // Unlimited
		scenes_published_concurrent: null, // Unlimited
		projects_total: null, // Unlimited
		org_seats: null, // Custom
		optimization_runs_per_month: null, // Unlimited
		optimization_concurrent: null, // Custom
		api_requests_per_minute: null, // Custom
		api_requests_per_month: null, // Custom
		api_keys_per_org: null, // Unlimited
		embed_bandwidth_gb_per_month: null, // Custom
		preview_loads_per_month: null // Unlimited
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
