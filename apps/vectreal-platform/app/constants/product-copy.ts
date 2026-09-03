/**
 * Canonical marketing copy and product claims.
 *
 * Single source of truth for all user-facing business-side strings: plan names,
 * taglines, feature labels, pricing-page copy, and format claims. This file
 * used to mirror a PRD directory; those documents were stale and have been
 * removed, so this is now the only place these strings live.
 *
 * Rule: keep every claim here checkable against code. Plan and limit shapes come
 * from ./plan-config; supported formats come from the loader and the file-input
 * accept pattern. Do not inline any of these strings in components.
 *
 * Prices are intentionally absent: they are Stripe-managed and loaded
 * dynamically. Point users to /pricing for current rates.
 */

import type { EntitlementKey, LimitKey, Plan } from './plan-config'

// ---------------------------------------------------------------------------
// Platform description strings
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

// NOTE: `.usda` is in the file-input accept pattern but the loader's
// ModelFileTypes enum is gltf | glb | usdz only, so a .usda upload is rejected
// with "Unsupported model format". It is therefore not claimed here.
export const SUPPORTED_UPLOAD_FORMATS = [
	'GLB (.glb), the recommended single-file format',
	'glTF (.gltf + .bin + textures), a multi-file upload; all assets must be included',
	'USDZ (.usdz), the Apple AR QuickLook format'
] as const

// Short format names for use in prose (e.g. "GLB, glTF, USDZ")
export const SUPPORTED_FORMAT_NAMES = ['GLB', 'glTF', 'USDZ'] as const

// ---------------------------------------------------------------------------
// Open-source packages
// Source: packages/*/README.md
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
// ---------------------------------------------------------------------------

// Shipped features only. This list is emitted as schema.org
// WebApplication.featureList, so anything here is a public claim about what the
// product does today.
//
// This list used to be the only honest surface. ./plan-config carried keys for
// features with no implementation, and this comment named six of them so they
// would stay out of here. Those keys are gone, so the exception list is empty
// and every EntitlementKey names something that exists.
//
// Two rules came out of removing them, and they pull in opposite directions:
//
//   1. A key naming a feature that does not exist is deleted.
//   2. A key naming a feature that DOES exist stays, set to what is true.
//      Several were `false` on free while the feature shipped ungated to
//      everyone - the optimization presets, the advanced parameters panel,
//      viewer customization. There the lie was the `false`, not the key, so
//      the fix is the value and deleting them would have dropped a true row.
//
// `scene_preview_private` and `data_export` were deleted under rule 1, and both
// turn on which reading you take. An authenticated owner-only preview route
// exists and a per-scene model export exists, both ungated; a shareable secret
// preview link and an organization-wide compliance export do not. On a pricing
// page those labels read as the second thing, which is why they went.
//
// The four support_* keys are the exception neither rule can decide, and they
// are kept on that basis rather than because the code backs them. Support is
// delivered by people, so no plan-aware code path is expected or present:
// contact-submission.server.ts branches on inquiry type alone, and there is one
// queue for everyone. `support_email` is true on every plan because
// contact-page.tsx already promises anyone a reply within one business day.
// `support_priority` and `support_dedicated` are true only if the business
// honors them. That is a commitment to keep, not a claim this file can check -
// which is also why the SLA hours came out of the labels.
export const PLATFORM_FEATURE_LIST = [
	'Upload GLB, glTF, and USDZ 3D models',
	'Automated 3D model optimization with Draco compression',
	'Maximum quality, Balanced, and Smallest optimization presets',
	'Embeddable 3D viewer via iframe, with no WebGL framework required on the embedding page',
	'Viewer customization: environment lighting, shadows, and camera presets',
	'JavaScript embed SDK for camera control, scroll interactions, and events',
	'Domain allowlist for embed security',
	'API key authentication for external embeds',
	'Team collaboration with role-based access'
] as const

// ---------------------------------------------------------------------------
// Plan names and per-plan copy
// ---------------------------------------------------------------------------

// Canonical display names, used wherever a plan ID maps to a human label.
export const PLAN_DISPLAY_NAMES: Record<Plan, string> = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
}

// One-line value proposition per tier shown on pricing cards.
export const PLAN_TAGLINES: Record<Plan, string> = {
	free: 'For hobbyists and open-source projects',
	pro: 'For independent creators who need more room',
	business: 'For growing teams and agencies',
	enterprise: 'Custom limits and a dedicated support channel'
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
// ---------------------------------------------------------------------------

export const PLAN_OFFER_DESCRIPTIONS: Record<Plan, string> = {
	free: '10 scenes, 500 MB storage, 3 concurrent published scenes. API access and community support included. No credit card required.',
	pro: '200 scenes, 10 GB storage, 50 concurrent published scenes, 20 projects. More room to publish; the feature set matches Free.',
	business:
		'2,000 scenes, 100 GB storage, 500 concurrent published scenes. Adds team collaboration with role-based access (up to 10 seats) and priority support.',
	enterprise:
		'Unlimited scenes, published scenes, projects and seats, with storage sized to your needs. Adds a dedicated support channel. Custom pricing via sales.'
}

// ---------------------------------------------------------------------------
// Pricing page copy
// ---------------------------------------------------------------------------

export const PRICING_PAGE_COPY = {
	heading: 'Simple, transparent pricing for every workflow.',
	description:
		'Start for free. Upgrade when you need more. Every plan includes the core 3D publishing workflow - no hidden fees.',
	enterpriseHeading: 'Need a custom setup?',
	enterpriseDescription:
		'Enterprise plans set your limits to whatever you need and add a dedicated support channel. Talk to us.'
} as const

// ---------------------------------------------------------------------------
// Entitlement display labels
// Canonical human-readable label for each entitlement key.
// Used in: feature comparison grid, upgrade flow unlocked-features list,
//          upgrade success page, and any other entitlement-keyed UI.
// ---------------------------------------------------------------------------

export const ENTITLEMENT_DISPLAY_LABELS: Record<EntitlementKey, string> = {
	scene_upload: 'Scene upload',
	scene_optimize: 'Optimization pipeline',
	scene_publish: 'Publish to CDN',
	scene_embed: 'Embed snippet',
	optimization_preset_low: 'Balanced and Smallest presets',
	optimization_preset_high: 'Maximum quality preset',
	optimization_custom_params: 'Custom optimization parameters',
	embed_domain_allowlist: 'Domain allowlist',
	embed_viewer_customisation: 'Viewer customization',
	org_multi_member: 'Multi-member workspace',
	org_roles: 'Role-based access',
	org_api_keys: 'API keys',
	support_community: 'Community & Discord',
	support_email: 'Email support',
	support_priority: 'Priority support',
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
			{ key: 'scene_embed', label: ENTITLEMENT_DISPLAY_LABELS.scene_embed }
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
				key: 'embed_viewer_customisation',
				label: ENTITLEMENT_DISPLAY_LABELS.embed_viewer_customisation
			}
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
			{ key: 'org_api_keys', label: ENTITLEMENT_DISPLAY_LABELS.org_api_keys }
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
// Keys shown on plan cards, in display order.
// ---------------------------------------------------------------------------

export const PLAN_CARD_LIMIT_KEYS: readonly LimitKey[] = [
	'storage_bytes_total',
	'scenes_total',
	'scenes_published_concurrent',
	'projects_total',
	'folders_total',
	'storage_bytes_per_scene',
	'api_keys_per_org',
	'org_seats'
]

/*
  A total record, not a partial one. Six of the twelve limits had no label, for
  two different reasons: four were claims nothing measured, and two were real
  limits nobody had got around to showing. The four are deleted and the two are
  below, so every surviving limit is one a customer can be shown, and a limit
  added without a label is now a compile error rather than a blank row.

  `folders_total` and `api_keys_per_org` are new here. Both are enforced - the
  folder limit is the oldest working one in the codebase - and neither had ever
  appeared on a plan card, so an organization could be refused a folder or a key
  it was never told it was near.
*/
export const LIMIT_DISPLAY_LABELS: Record<LimitKey, string> = {
	storage_bytes_total: 'Storage',
	scenes_total: 'Scenes',
	scenes_published_concurrent: 'Published scenes',
	projects_total: 'Projects',
	folders_total: 'Folders',
	storage_bytes_per_scene: 'Max scene size',
	api_keys_per_org: 'API keys',
	org_seats: 'Team seats'
}

// ---------------------------------------------------------------------------
// Storage: what the quota actually measures.
// ---------------------------------------------------------------------------

/*
  The publisher reports a scene at ~4 MB while storage reports several times
  that for the same scene, and both figures are correct - they describe
  different files. Compression is applied at publish, so the editable copy a
  scene keeps is necessarily larger than the one that ships.

  Two screens describing one scene with that gap and no explanation reads as a
  bug, so the label and the tooltip below are shared by the dashboard and the
  billing page rather than written twice with different wording.
*/
export const STORAGE_USAGE_LABEL = 'Scene storage'

export const STORAGE_USAGE_HINT =
	'What your scenes keep, not what visitors download: the editable copy, the published file, its thumbnail, and any baked shadow.'

// ---------------------------------------------------------------------------
// Upgrade success page: entitlement keys to highlight post-upgrade, in priority
// order.
// ---------------------------------------------------------------------------

export const UPGRADE_FEATURE_HIGHLIGHT_KEYS: readonly EntitlementKey[] = [
	'org_multi_member',
	'org_roles',
	'support_priority'
]
