/**
 * Canonical marketing copy and product claims.
 *
 * Single source of truth for all user-facing business-side strings: plan names,
 * taglines, feature labels, pricing-page copy, and format claims. Mirrors the
 * PRD directory — see prd/00-product-overview.md, prd/01-plans-and-tiers.md,
 * prd/02-limits-and-quotas.md, and prd/03-entitlements.md.
 *
 * Rule: every change here must be reflected in the corresponding PRD file, and
 * vice versa. Do not inline any of these strings in components.
 *
 * Prices are intentionally absent: they are Stripe-managed and loaded
 * dynamically. Point users to /pricing for current rates.
 */

import type { EntitlementKey, LimitKey, Plan } from './plan-config'

// ---------------------------------------------------------------------------
// Platform description strings
// Source: prd/00-product-overview.md § "Platform Description Strings"
// ---------------------------------------------------------------------------

export const PLATFORM_TAGLINE =
	'Web platform for uploading, optimizing, and publishing 3D models as embeddable scenes.'

export const PLATFORM_SHORT_DESCRIPTION =
	'Vectreal lets developers and teams upload 3D models, run automated optimization pipelines, compose scenes, and publish them as embeddable iframes or via REST API. The viewer requires no WebGL framework on the embedding page.'

export const PLATFORM_SOCIAL_DESCRIPTION =
	'Vectreal is your platform for creating, sharing, and exploring 3D scenes. Upload, optimize, and publish 3D content in seconds.'

// ---------------------------------------------------------------------------
// Supported upload formats
// Source: shared/components/src/hooks/use-accept-pattern.ts
//         packages/core/src/model-loader/model-loader.ts
// Do not claim support for formats not listed here.
// ---------------------------------------------------------------------------

export const SUPPORTED_UPLOAD_FORMATS = [
	'GLB (.glb) — recommended single-file format',
	'glTF (.gltf + .bin + textures) — multi-file upload; all assets must be included',
	'USDZ (.usdz) — Apple AR QuickLook format',
	'USDA (.usda) — USD ASCII format'
] as const

// Short format names for use in prose (e.g. "GLB, glTF, USDZ, USDA")
export const SUPPORTED_FORMAT_NAMES = ['GLB', 'glTF', 'USDZ', 'USDA'] as const

// ---------------------------------------------------------------------------
// Open-source packages
// Source: packages/*/README.md, prd/00-product-overview.md
// ---------------------------------------------------------------------------

export const OPEN_SOURCE_PACKAGES = [
	{
		name: '@vctrl/viewer',
		description:
			'Ready-to-use React component for rendering 3D models. Built on Three.js and React Three Fiber.',
		npm: 'https://www.npmjs.com/package/@vctrl/viewer',
		docs: 'https://vectreal.com/docs/packages/viewer'
	},
	{
		name: '@vctrl/hooks',
		description:
			'Browser-side React hooks for loading, optimizing, and exporting 3D models.',
		npm: 'https://www.npmjs.com/package/@vctrl/hooks',
		docs: 'https://vectreal.com/docs/packages/hooks'
	},
	{
		name: '@vctrl/core',
		description:
			'Isomorphic 3D model processing for Node.js and browser/Web Worker environments.',
		npm: 'https://www.npmjs.com/package/@vctrl/core',
		docs: 'https://vectreal.com/docs/packages/core'
	},
	{
		name: '@vctrl/embed',
		description:
			'Framework-agnostic JavaScript SDK for controlling Vectreal embedded 3D scenes from any web page. Includes CDN UMD build.',
		npm: 'https://www.npmjs.com/package/@vctrl/embed',
		docs: 'https://vectreal.com/docs/guides/embed-sdk'
	}
] as const

// ---------------------------------------------------------------------------
// Feature list for schema.org WebApplication.featureList
// Source: prd/03-entitlements.md
// ---------------------------------------------------------------------------

export const PLATFORM_FEATURE_LIST = [
	'Upload GLB, glTF, USDZ, and USDA 3D models',
	'Automated 3D model optimization with Draco compression',
	'Low, medium, and high optimization presets',
	'Embeddable 3D viewer via iframe — no WebGL framework required on embedding page',
	'Scene version history',
	'Viewer customization: colors, lighting, camera presets, and branding removal',
	'Per-embed analytics',
	'AR mode (iOS USDZ / Android WebXR)',
	'Domain allowlist for embed security',
	'REST API with API key authentication',
	'Team collaboration with role-based access',
	'Priority optimization queue',
	'EU data residency',
	'SAML/OIDC single sign-on',
	'Audit log export'
] as const

// ---------------------------------------------------------------------------
// Plan names and per-plan copy
// Source: prd/01-plans-and-tiers.md
// ---------------------------------------------------------------------------

// Canonical display names — used wherever a plan ID maps to a human label.
export const PLAN_DISPLAY_NAMES: Record<Plan, string> = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
}

// One-line value proposition per tier shown on pricing cards.
export const PLAN_TAGLINES: Record<Plan, string> = {
	free: 'For hobbyists and open-source projects',
	pro: 'For independent creators and small studios',
	business: 'For growing teams and agencies',
	enterprise: 'Custom SLA and dedicated support'
}

// Primary CTA button text for each plan on the public pricing page.
export const PLAN_CTA: Record<Plan, string> = {
	free: 'Get started free',
	pro: 'Start with Pro',
	business: 'Start with Business',
	enterprise: 'Contact sales'
}

// CTA link destination. null = computed checkout URL.
export const PLAN_CTA_HREF: Record<Plan, string | null> = {
	free: '/sign-up',
	pro: null,
	business: null,
	enterprise: '/contact'
}

// Which plan card to visually highlight as "Most popular".
export const PLAN_HIGHLIGHTED: Record<Plan, boolean> = {
	free: false,
	pro: true,
	business: false,
	enterprise: false
}

// ---------------------------------------------------------------------------
// Fallback prices (USD) displayed when Stripe is unreachable.
// Keep in sync with the Stripe product configuration.
// Source: prd/01-plans-and-tiers.md § "Pricing anchors"
// ---------------------------------------------------------------------------

export const PLAN_FALLBACK_PRICES: Partial<
	Record<Plan, { monthly: number; annualMonthly: number }>
> = {
	pro: { monthly: 29, annualMonthly: 23 },
	business: { monthly: 79, annualMonthly: 63 }
}

// Annual billing toggle badge copy.
export const ANNUAL_DISCOUNT_CLAIM = 'Save up to 20%'

// Trust copy displayed near checkout CTAs.
export const PAYMENT_TRUST_COPY = 'Secured by Stripe · Cancel anytime'

// ---------------------------------------------------------------------------
// Plan offer descriptions for schema.org WebApplication.offers and llms.txt
// Source: prd/01-plans-and-tiers.md, prd/02-limits-and-quotas.md
// ---------------------------------------------------------------------------

export const PLAN_OFFER_DESCRIPTIONS: Record<Plan, string> = {
	free: '10 scenes, 500 MB storage, 3 concurrent published scenes. API access and community support included. No credit card required.',
	pro: '200 scenes, 10 GB storage, 50 concurrent published scenes. Adds analytics, AR mode, branding removal, version history, and email support.',
	business:
		'2,000 scenes, 100 GB storage, 500 concurrent published scenes. Adds team collaboration (up to 10 seats), priority optimization queue, EU data residency, and priority support.',
	enterprise:
		'Unlimited scenes and storage, custom seats, SSO, audit log, custom data residency, and dedicated support. Custom pricing via sales.'
}

// ---------------------------------------------------------------------------
// Pricing page copy
// Source: prd/01-plans-and-tiers.md
// ---------------------------------------------------------------------------

export const PRICING_PAGE_COPY = {
	heading: 'Simple, transparent pricing for every workflow.',
	description:
		'Start for free. Upgrade when you need more. Every plan includes the core 3D publishing workflow - no hidden fees.',
	enterpriseHeading: 'Need a custom setup?',
	enterpriseDescription:
		'Enterprise plans include custom data residency, dedicated support, audit log export, and bespoke SLA agreements. Talk to us.'
} as const

// ---------------------------------------------------------------------------
// Entitlement display labels
// Source: prd/03-entitlements.md
// Canonical human-readable label for each entitlement key.
// Used in: feature comparison grid, upgrade flow unlocked-features list,
//          upgrade success page, and any other entitlement-keyed UI.
// ---------------------------------------------------------------------------

export const ENTITLEMENT_DISPLAY_LABELS: Record<EntitlementKey, string> = {
	scene_upload: 'Scene upload',
	scene_optimize: 'Optimization pipeline',
	scene_publish: 'Publish to CDN',
	scene_embed: 'Embed snippet',
	scene_preview_private: 'Private preview link',
	scene_version_history: 'Version history',
	optimization_preset_low: 'Low / medium presets',
	optimization_preset_medium: 'Low / medium presets',
	optimization_preset_high: 'High-quality optimization preset',
	optimization_custom_params: 'Custom optimization parameters',
	optimization_priority_queue: 'Priority optimization queue',
	embed_domain_allowlist: 'Domain allowlist',
	embed_branding_removal: 'Remove Vectreal branding',
	embed_viewer_customisation: 'Viewer customization',
	embed_analytics: 'Embed analytics',
	embed_ar_mode: 'AR / WebXR mode',
	org_multi_member: 'Multi-member workspace',
	org_roles: 'Role-based access',
	org_api_keys: 'API keys',
	org_sso: 'SAML / OIDC SSO',
	org_audit_log: 'Audit log export',
	data_export: 'Data export',
	data_residency_eu: 'EU data residency',
	data_residency_custom: 'Custom data residency',
	support_community: 'Community & Discord',
	support_email: 'Email support (48 h SLA)',
	support_priority: 'Priority support (8 h SLA)',
	support_dedicated: 'Dedicated support channel'
}

// Entitlement keys grouped for the feature comparison grid, in display order.
export const ENTITLEMENT_FEATURE_GROUPS: Array<{
	label: string
	features: Array<{ key: EntitlementKey; label: string }>
}> = [
	{
		label: 'Publishing',
		features: [
			{ key: 'scene_upload', label: ENTITLEMENT_DISPLAY_LABELS.scene_upload },
			{
				key: 'scene_optimize',
				label: ENTITLEMENT_DISPLAY_LABELS.scene_optimize
			},
			{ key: 'scene_publish', label: ENTITLEMENT_DISPLAY_LABELS.scene_publish },
			{ key: 'scene_embed', label: ENTITLEMENT_DISPLAY_LABELS.scene_embed },
			{
				key: 'scene_preview_private',
				label: ENTITLEMENT_DISPLAY_LABELS.scene_preview_private
			},
			{
				key: 'scene_version_history',
				label: ENTITLEMENT_DISPLAY_LABELS.scene_version_history
			}
		]
	},
	{
		label: 'Optimization',
		features: [
			{
				key: 'optimization_preset_low',
				label: ENTITLEMENT_DISPLAY_LABELS.optimization_preset_low
			},
			{
				key: 'optimization_preset_high',
				label: ENTITLEMENT_DISPLAY_LABELS.optimization_preset_high
			},
			{
				key: 'optimization_custom_params',
				label: ENTITLEMENT_DISPLAY_LABELS.optimization_custom_params
			},
			{
				key: 'optimization_priority_queue',
				label: ENTITLEMENT_DISPLAY_LABELS.optimization_priority_queue
			}
		]
	},
	{
		label: 'Embed & Viewer',
		features: [
			{
				key: 'embed_domain_allowlist',
				label: ENTITLEMENT_DISPLAY_LABELS.embed_domain_allowlist
			},
			{
				key: 'embed_branding_removal',
				label: ENTITLEMENT_DISPLAY_LABELS.embed_branding_removal
			},
			{
				key: 'embed_viewer_customisation',
				label: ENTITLEMENT_DISPLAY_LABELS.embed_viewer_customisation
			},
			{
				key: 'embed_analytics',
				label: ENTITLEMENT_DISPLAY_LABELS.embed_analytics
			},
			{ key: 'embed_ar_mode', label: ENTITLEMENT_DISPLAY_LABELS.embed_ar_mode }
		]
	},
	{
		label: 'Organisation',
		features: [
			{
				key: 'org_multi_member',
				label: ENTITLEMENT_DISPLAY_LABELS.org_multi_member
			},
			{ key: 'org_roles', label: ENTITLEMENT_DISPLAY_LABELS.org_roles },
			{ key: 'org_api_keys', label: ENTITLEMENT_DISPLAY_LABELS.org_api_keys },
			{ key: 'org_sso', label: ENTITLEMENT_DISPLAY_LABELS.org_sso },
			{ key: 'org_audit_log', label: ENTITLEMENT_DISPLAY_LABELS.org_audit_log }
		]
	},
	{
		label: 'Data & Compliance',
		features: [
			{ key: 'data_export', label: ENTITLEMENT_DISPLAY_LABELS.data_export },
			{
				key: 'data_residency_eu',
				label: ENTITLEMENT_DISPLAY_LABELS.data_residency_eu
			},
			{
				key: 'data_residency_custom',
				label: ENTITLEMENT_DISPLAY_LABELS.data_residency_custom
			}
		]
	},
	{
		label: 'Support',
		features: [
			{
				key: 'support_community',
				label: ENTITLEMENT_DISPLAY_LABELS.support_community
			},
			{
				key: 'support_email',
				label: ENTITLEMENT_DISPLAY_LABELS.support_email
			},
			{
				key: 'support_priority',
				label: ENTITLEMENT_DISPLAY_LABELS.support_priority
			},
			{
				key: 'support_dedicated',
				label: ENTITLEMENT_DISPLAY_LABELS.support_dedicated
			}
		]
	}
]

// ---------------------------------------------------------------------------
// Limit display config
// Source: prd/02-limits-and-quotas.md
// Keys shown on plan cards, in display order.
// ---------------------------------------------------------------------------

export const PLAN_CARD_LIMIT_KEYS = [
	'storage_bytes_total',
	'scenes_total',
	'scenes_published_concurrent',
	'projects_total',
	'storage_bytes_per_scene',
	'org_seats'
] as const

export const LIMIT_DISPLAY_LABELS: Partial<Record<LimitKey, string>> = {
	storage_bytes_total: 'Storage',
	scenes_total: 'Scenes',
	scenes_published_concurrent: 'Published scenes',
	projects_total: 'Projects',
	storage_bytes_per_scene: 'Max scene size',
	org_seats: 'Team seats'
}

// ---------------------------------------------------------------------------
// Upgrade success page: entitlement keys to highlight post-upgrade, in priority
// order. Source: prd/03-entitlements.md § "Upgrade highlights"
// ---------------------------------------------------------------------------

export const UPGRADE_FEATURE_HIGHLIGHT_KEYS = [
	'scene_preview_private',
	'scene_version_history',
	'optimization_preset_high',
	'optimization_custom_params',
	'optimization_priority_queue',
	'embed_branding_removal',
	'embed_viewer_customisation',
	'embed_analytics',
	'embed_ar_mode',
	'org_multi_member',
	'org_roles',
	'support_email',
	'support_priority'
] as const
