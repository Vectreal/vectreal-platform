/**
 * Canonical marketing copy and product claims.
 *
 * Single source of truth for all user-facing business-side strings: plan names,
 * taglines, feature labels, pricing-page copy, and format claims. This file
 * used to mirror a PRD directory; those documents were stale and have been
 * removed, so this is now the only place these strings live.
 *
 * Rule: keep every claim here checkable against code. Plan and limit shapes come
 * from ./plan-config, and the offer descriptions read its values rather than
 * restating them; the accepted format set comes from `@vctrl/core/model-formats`
 * and is read here rather than restated. Do not inline any of these strings in
 * components.
 *
 * Prices are intentionally absent: they are Stripe-managed and loaded
 * dynamically. Point users to /pricing for current rates.
 */

import { IMPORTABLE_FORMAT_LABELS } from '@vctrl/core/model-formats'

import {
	formatLimitCount,
	formatLimitValue,
	PUBLISHED_COPY_LOCALE
} from './limit-format'
import { ALL_PLANS, PLAN_ENTITLEMENTS, PLAN_LIMITS } from './plan-config'

import type { EntitlementKey, LimitKey, PaidPlan, Plan } from './plan-config'
import type {
	ModelIntakeFieldErrorCode,
	ModelIntakeFormErrorCode,
	ModelIntakeLocale,
	ModelIntakeProductType,
	ModelIntakeSizeField
} from '../lib/domain/model-intake/model-intake-shared'

// ---------------------------------------------------------------------------
// Platform description strings
// ---------------------------------------------------------------------------

/*
  The position these three carry, and the home page argues: companies that sell
  physical products, putting the 3D files they already have on their own site,
  with developers as the second reader. Configurators are not named here,
  because they are built per pilot rather than shipped.
*/
export const PLATFORM_TAGLINE =
	'Your products in 3D on your own website: prepare the files you have, embed them on any page, and manage every model in one place.'

export const PLATFORM_SHORT_DESCRIPTION =
	'Vectreal takes the 3D files a company already has, optimizes them for the browser, and publishes them as embeds on any website, with a dashboard for projects, scenes, team roles, API keys and allowed domains. The optimizer and format converters run in the browser with no account, and the viewer and embed SDK are open source on npm. The viewer needs no WebGL framework on the embedding page.'

/*
  The most-read string in the product: it is DEFAULT_DESCRIPTION and the home
  page's meta description. It used to stack two parallel triplets - "creating,
  sharing, and exploring" then "upload, optimize, and publish" - which is the
  rhythm rather than the content doing the work, and "exploring" named nothing
  the product does. One enumeration, of the pipeline that actually exists.
*/
export const PLATFORM_SOCIAL_DESCRIPTION =
	'Start from the 3D files you already have. Vectreal prepares them for the browser, embeds them on any page you own, and keeps track of every model. Open source.'

// ---------------------------------------------------------------------------
// Supported upload formats
// ---------------------------------------------------------------------------

/**
 * Short format names for use in prose, read from the owner.
 *
 * THIS WAS THE LAST HAND-MAINTAINED STATEMENT OF THE ACCEPTED SET, and the
 * warning that used to sit here pointed the wrong way. It said "do not claim
 * support for formats not listed here", written when the risk was
 * over-claiming; by the time STL, FBX and OBJ loaded, the risk was the
 * opposite, and this array still read `['GLB', 'glTF', 'USDZ']`. It feeds the
 * sitewide meta keywords, `/llms.txt`, the home page and a schema.org
 * `featureList`, so three formats the product reads were absent from every
 * machine-readable description of it - in the same sitemap as the converter
 * pages that read them.
 *
 * Adding a format to `MODEL_FORMATS` now moves all of that with no edit here.
 */
export const SUPPORTED_FORMAT_NAMES = IMPORTABLE_FORMAT_LABELS

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
			'Framework-agnostic JavaScript SDK for controlling Vectreal embedded 3D scenes from any web page. Includes a CDN script-tag build.',
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
	`Upload ${SUPPORTED_FORMAT_NAMES.join(', ')} 3D models`,
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

/*
  Which plan card carries the recommendation.

  Labelled "Recommended", not "Most popular". Popularity is a claim about other
  customers that nothing here measures; a recommendation is a statement Vectreal
  can actually stand behind.
*/
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

/*
  Keyed by `PaidPlan`, not `Partial<Record<Plan, ...>>`.

  "Which plans have a self-serve price" is the same fact as "which plans
  checkout sells": Free is absent because it costs nothing and Enterprise
  because it is sales-led, which are exactly the owner's two exclusions.

  `Partial` also made the values optional, so `ANNUAL_DISCOUNT_CLAIM` below
  destructures `monthly` and `annualMonthly` off something the type says may be
  undefined. A total Record makes both halves true.
*/
export const PLAN_FALLBACK_PRICES: Record<
	PaidPlan,
	{ monthly: number; annualMonthly: number }
> = {
	pro: { monthly: 29, annualMonthly: 23 },
	business: { monthly: 79, annualMonthly: 63 }
}

/*
  Annual billing toggle badge copy, derived rather than written.

  It was the string 'Save up to 20%', and the same screen computed 21% from the
  same numbers: `pricing-cards-section` derives each plan's real discount and
  renders it on the card, so Pro could read "Save 21%" beside a toggle claiming
  "up to 20%". Pro saves 21% and Business 20%, so "up to" was understating its
  own best case.

  Computed from the fallback prices, which are the documented reference for what
  a plan costs. `product-copy.spec.ts` pins the two together, so changing a price
  without the claim following fails rather than quietly contradicting a card.
*/
export const ANNUAL_DISCOUNT_CLAIM = `Save up to ${Math.max(
	...Object.values(PLAN_FALLBACK_PRICES).map(({ monthly, annualMonthly }) =>
		Math.round((1 - annualMonthly / monthly) * 100)
	)
)}%`

// Trust copy displayed near checkout CTAs.
export const PAYMENT_TRUST_COPY = 'Secured by Stripe · Cancel anytime'

// ---------------------------------------------------------------------------
// Plan offer descriptions for schema.org WebApplication.offers and llms.txt
// ---------------------------------------------------------------------------

/*
  These sentences are English prose that reaches machine readers: `/llms.txt`
  renders them verbatim and they are the `description` of every schema.org
  `Offer`. Both follow `PUBLISHED_COPY_LOCALE`, which is where the reasoning
  lives. Only one interpolated number groups its digits today (Business's 2,000
  scenes), but every one of them would change numbering system outside a
  Latin-digit locale.
*/

/**
 * A plan limit, written the way published copy writes it.
 *
 * Exported because two published pages state these numbers in prose and used to
 * type them by hand: `docs/guides/upload.mdx` and the `api-keys-101` article.
 * Both are prerendered, so a plan change left them stating a number nobody
 * served, and the claims blocks that guarded them could only pin that a literal
 * existed somewhere in `plan-config.ts`, never which plan owned it.
 */
export const publishedLimit = (plan: Plan, key: LimitKey) =>
	formatLimitValue(key, PLAN_LIMITS[plan][key], PUBLISHED_COPY_LOCALE)

const count = (plan: Plan, key: LimitKey, noun: string) =>
	formatLimitCount(key, PLAN_LIMITS[plan][key], noun, PUBLISHED_COPY_LOCALE)

/*
  The sentences stay hand-written. What moves into an interpolation is a number,
  its unit, and the noun it counts, so a copy edit is still an ordinary string
  edit - #828 changed the badge line here and would change it the same way today
  - though a noun is now an argument to `count` rather than plain text.

  Enterprise is left alone deliberately. Every limit it holds is null, which
  formats as "Unlimited" or "Custom", and "Custom storage" is not a sentence -
  which is why that entry was already written differently by hand.
*/
export const PLAN_OFFER_DESCRIPTIONS: Record<Plan, string> = {
	free: `${count('free', 'scenes_total', 'scene')}, ${publishedLimit('free', 'storage_bytes_total')} storage, ${count('free', 'scenes_published_concurrent', 'concurrent published scene')}. Embed API keys and community support included. Embedded scenes carry a small Vectreal badge. No credit card required.`,
	pro: `${count('pro', 'scenes_total', 'scene')}, ${publishedLimit('pro', 'storage_bytes_total')} storage, ${count('pro', 'scenes_published_concurrent', 'concurrent published scene')}, ${count('pro', 'projects_total', 'project')}. Removes the Vectreal badge from embedded scenes; otherwise the feature set matches Free.`,
	business: `${count('business', 'scenes_total', 'scene')}, ${publishedLimit('business', 'storage_bytes_total')} storage, ${count('business', 'scenes_published_concurrent', 'concurrent published scene')}. Adds team collaboration with role-based access (up to ${count('business', 'org_seats', 'seat')}) and priority support.`,
	enterprise:
		'Unlimited scenes, published scenes, projects and seats, with storage sized to your needs. Adds a dedicated support channel. Custom pricing via sales.'
}

// ---------------------------------------------------------------------------
// Pricing page copy
// ---------------------------------------------------------------------------

export const PRICING_PAGE_COPY = {
	heading: 'Start free. Pay when your scenes go live.',
	description:
		'Start for free and upgrade when you need more. Every plan includes the core 3D publishing workflow without hidden fees.',
	comparisonHeading: 'What each plan includes',
	comparisonDescription:
		'Every entitlement, across all four plans. Limits are per organization.',
	// The "every entitlement" claim above is pinned by product-copy.spec.ts,
	// which fails when an entitlement key is added without a row in the grid.
	enterpriseHeading: 'Enterprise',
	enterpriseDescription:
		'Custom limits and a direct line to the team. Tell us what you need and we will price it.'
} as const

// ---------------------------------------------------------------------------
// Docs landing page
// The page's structure is derived from `lib/docs/docs-manifest.ts`, which is
// what the sidebar reads too, so only the page's own prose lives here.
// ---------------------------------------------------------------------------

export const DOCS_PAGE_COPY = {
	heading: 'Docs',
	description:
		'Try the publisher with a sample model, with nothing to install and no account. Or build on the open-source packages underneath.',
	publisherCta: 'Open the publisher',
	rocketSampleCta: 'Open the rocket sample',
	quickLinksLabel: 'Elsewhere'
} as const

// ---------------------------------------------------------------------------
// Home page
//
// Written for two readers: a company that sells physical products and wants
// them in 3D on its own site, and a developer who wants the open-source
// pieces. Every capability named here ships today. Configurators do not, which
// is why they appear only inside the pilot offer, as something built per
// project.
// ---------------------------------------------------------------------------

/** The contact page's `topic` for a pilot: it preselects a sales inquiry and asks the pilot's questions. */
export const PILOT_CONTACT_TOPIC = 'pilot'

/** Where every pilot call to action on the site points. */
export const PILOT_CONTACT_HREF = `/contact?topic=${PILOT_CONTACT_TOPIC}`

/** What the contact form asks when it was opened from a pilot call to action. */
export const PILOT_CONTACT_PROMPT =
	'About your project: tell us what you sell, which 3D or CAD files you have, and where the product views should live.'

/*
  The lowest plan that lets a whole team in with roles (`ALL_PLANS` is in
  ladder order), read from the entitlements rather than named, so the home page stops naming the wrong plan
  the day that moves.
*/
const TEAM_PLAN =
	ALL_PLANS.find(
		(plan) =>
			PLAN_ENTITLEMENTS[plan].org_multi_member &&
			PLAN_ENTITLEMENTS[plan].org_roles
	) ?? 'enterprise'

export const HOME_PAGE_COPY = {
	hero: {
		/** One sentence per line, set as written: the breaks are part of the headline. */
		heading: ['Publish your vision.'],
		/** What Vectreal does, then who it is for. */
		lead: 'Convert, optimize, manage and embed your 3D models. Vectreal helps creators, developers and businesses create interactive 3D experiences on their own sites, with one platform to manage them.',
		/** Into the publisher; once the stage is live it takes the visitor's own file instead. */
		primaryCta: 'Try it out',
		secondaryCta: 'Get in touch',
		/** For a visitor with no model at hand: the camera on the page, untouched, in the publisher. */
		sampleCta: 'No file at hand? Open this camera in the publisher',
		/** The fold's cue, a link to the first section below. */
		foldCue: 'Scroll'
	},
	stage: {
		figure: 'Fig 01',
		/** The label once the drawing has turned into the object. */
		liveView: 'Live view',
		/** A dropped file's face is not known, so it is only ever an elevation. */
		droppedView: 'Elevation',
		readouts: {
			file: 'File',
			original: 'Original',
			size: 'Size',
			status: 'Status'
		},
		status: {
			loading: 'Loading',
			drawn: 'Drawn from the file',
			rendering: 'Rendering',
			live: 'Live. Drag to turn',
			dragging: 'Release to draw your file',
			optimizing: 'Optimizing your file',
			unsupported: 'That file type cannot be drawn here',
			failed: 'That file could not be drawn'
		},
		openInPublisher: 'Open in the publisher'
	},
	product: {
		/**
		  The steps themselves are the tabs below it, so the heading names where
		  they go rather than listing them a second time.
		*/
		heading: 'From your file to your product page, in three steps.',
		/** The chain's accessible name: the heading is a sentence, this names the control. */
		stepsLabel: 'The three steps',
		views: {
			prepare: {
				label: 'Prepare',
				summary:
					'Drop in your file and keep the lightest version that still looks right.',
				body: `Upload ${SUPPORTED_FORMAT_NAMES.join(', ')}. Pick a preset, compare before and after, and download the result without an account.`,
				link: 'Open the optimizer'
			},
			manage: {
				label: 'Manage',
				summary: 'Every scene, project and API key in one place.',
				body: `Projects, folders and scenes in one place, with API keys and allowed domains for every embed. From the ${PLAN_DISPLAY_NAMES[TEAM_PLAN]} plan up, your whole team works in it, and owners, admins and members each get the actions their role allows.`,
				link: 'Compare plans'
			},
			embed: {
				label: 'Publish',
				summary: 'One snippet puts it on your page.',
				body: 'One snippet puts a scene on your site. Allow only the domains you own, and drive the camera from your page with the JavaScript SDK.',
				link: 'See the embed guide',
				/** The address bar of the product page the view shows the camera on: anyone's shop, not one we name. */
				pageAddress: 'your-store.example/products/camera'
			}
		}
	},
	mission: {
		label: 'Why we build this',
		/** One paragraph, in parts: the `key` ones light up in turn as it scrolls through the screen; the `highlight` one is in full ink throughout. */
		statement: [
			'Most companies that make physical products ',
			{ key: 'already have 3D files' },
			'. ',
			{ highlight: 'Very few can put them on their own website' },
			' ',
			{
				key: 'without an agency, an enterprise platform or a plugin that keeps their data'
			},
			'. Vectreal is ',
			{
				key: 'the open path from the file you have to a product page that loads fast'
			},
			', and ',
			{ key: 'we build it in public' },
			'.'
		],
		signature: 'Moritz Becker, founder',
		/** The figure beside the statement: one file, pulled apart into the path it takes. Back to front. */
		layers: {
			file: 'The file you have',
			prepared: 'Prepared for the web',
			page: 'On your product page'
		}
	},
	pilot: {
		heading: 'Start a project with us',
		lead: 'We help you every step of the way, starting from your files and ending with an interactive 3D web experience.',
		blocks: [
			{
				title: 'Who it is for',
				body: 'Companies with physical products, and web developers and designers, looking to visualize their products and ideas with interactive 3D.'
			},
			{
				title: 'What we do',
				body: 'We prepare your files and embed the product viewer or configurator into your site. You optimize and manage them in Vectreal.'
			}
		],
		team: 'A small team in Germany. You work directly with the people who build the product.',
		cta: 'Talk to us'
	},
	openSource: {
		heading: 'Open source, down to the viewer',
		lead: 'The platform and every package are published under AGPL-3.0. Read the code, run it yourself, or send a pull request.',
		repositoryUrl: 'https://github.com/Vectreal/vectreal-platform',
		discordUrl: 'https://discord.gg/A9a3nPkZw7',
		repositoryCta: 'View on GitHub',
		discordCta: 'Join the Discord',
		contributingCta: 'How to contribute',
		packagesLabel: 'Packages',
		/** The second reader's door, kept to one line under the section. */
		developers: {
			lead: 'Developer or 3D artist? The packages behind the publisher are on npm.',
			cta: 'Read the docs'
		},
		/** The pane under the snippet, which runs it. */
		result: {
			label: 'Result',
			run: 'Run this code',
			failed: 'It would not run in this browser. Try again'
		}
	}
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
	embed_branding_removal: 'Remove Vectreal branding',
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
				key: 'embed_branding_removal',
				label: ENTITLEMENT_DISPLAY_LABELS.embed_branding_removal
			},
			{
				key: 'embed_viewer_customisation',
				label: ENTITLEMENT_DISPLAY_LABELS.embed_viewer_customisation
			}
		]
	},
	{
		label: 'Organization',
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
	'Counts the editable copy, the published file, its thumbnail, and any baked shadow. Visitor downloads do not count against it.'

// ---------------------------------------------------------------------------
// The entitlements worth leading with when an upgrade is described, in priority
// order. Both billing pages show the same list, through
// `getUnlockedEntitlementLabels`, and this orders it. It used to filter the
// success page's copy of that list, which is how the two pages came to promise
// different things: a key omitted here was sold before payment and absent after.
// ---------------------------------------------------------------------------

export const UPGRADE_FEATURE_HIGHLIGHT_KEYS: readonly EntitlementKey[] = [
	'embed_branding_removal',
	'org_multi_member',
	'org_roles',
	'support_priority'
]

// ---------------------------------------------------------------------------
// Free-model intake (`/free-model`)
//
// The single intake for the pilot sales test: a brand sends three photos of
// one product and gets one 3D model back. It describes a service we perform,
// "we make the model from your photos", never a product feature, and says
// "Shopify's own 3D slot", never "integration". German because the letters go
// to German brands; `?lang=de` picks it. Approved by Moritz before shipping;
// a German-law check of the consent and privacy lines is advised before the
// letters go out.
// ---------------------------------------------------------------------------

/** One copy per locale, so a string missing from either is a compile error. */
interface ModelIntakeCopy {
	meta: { title: string; description: string }
	hero: { heading: string; description: string }
	/** Switches to the other language; the batch code is kept. */
	languageLink: string
	fields: {
		name: { label: string; placeholder: string }
		email: { label: string; placeholder: string }
		company: { label: string }
		productType: {
			label: string
			placeholder: string
			options: Record<ModelIntakeProductType, string>
			otherHint: string
		}
		photos: {
			label: string
			help: string
			slot: (n: number) => string
			add: string
			remove: (n: number) => string
		}
		size: {
			label: string
			parts: Record<ModelIntakeSizeField, string>
			help: string
		}
		message: { label: string; placeholder: string }
		consentFollowUp: string
		consentPhotos: string
	}
	privacyNote: string
	privacyLink: string
	/** Shown when bot verification cannot load; the address follows it as a link. */
	turnstileFailed: string
	submit: string
	submitting: string
	next: { heading: string; steps: readonly string[]; note: string }
	fieldErrors: Record<ModelIntakeFieldErrorCode, (n?: number) => string>
	formErrors: Record<ModelIntakeFormErrorCode, string>
	success: {
		heading: string
		body: (code: string) => string
		confirmationFailed: string
		again: string
	}
	confirmationEmail: {
		subject: (code: string) => string
		preview: string
		greeting: (name: string) => string
		body: string
		reference: string
		deletion: string
		signature: string
	}
}

export const MODEL_INTAKE_COPY: Record<ModelIntakeLocale, ModelIntakeCopy> = {
	en: {
		meta: {
			title: 'A free 3D model of your product - Vectreal',
			description:
				"Send three photos of one product. We make a 3D model from them and send it back, ready for Shopify's own 3D slot."
		},
		hero: {
			heading: 'A free 3D model of one of your products',
			description:
				"Send us three photos of one product. We make the 3D model from your photos and send it back within 48 hours, as GLB and USDZ files for Shopify's own 3D slot."
		},
		languageLink: 'Deutsch',
		fields: {
			name: { label: 'Your name', placeholder: 'Jane Doe' },
			email: { label: 'Work email', placeholder: 'you@company.com' },
			company: { label: 'Company or brand' },
			productType: {
				label: 'What kind of product?',
				placeholder: 'Choose a product type',
				options: {
					furniture: 'Furniture and lamps',
					shoes: 'Shoes',
					bags: 'Bags and accessories',
					electronics: 'Small electronics',
					ceramics: 'Ceramics and kitchenware (no glass, enamel or cast iron)',
					other: 'Something else'
				},
				otherHint: "We'll look at it first and tell you whether we can make it."
			},
			photos: {
				label: 'Three photos of the product',
				help: 'Front, side and back work best, on a plain background. JPEG, PNG, WebP or HEIC, up to 15 MB each.',
				slot: (n) => `Photo ${n}`,
				add: 'Add photo',
				remove: (n) => `Remove photo ${n}`
			},
			size: {
				label: 'Approximate size in cm (optional)',
				parts: { height: 'Height', width: 'Width', depth: 'Depth' },
				help: "So the model has your product's real size."
			},
			message: {
				label: 'Anything we should know? (optional)',
				placeholder: 'Colors, materials, or a link to the product page.'
			},
			consentFollowUp:
				'Vectreal may email me about this model and about a paid pilot offer. I can withdraw this at any time.',
			consentPhotos:
				"I'm allowed to share these photos, and Vectreal may use them to make this model."
		},
		privacyNote:
			'We store your details and photos to make your model, and delete them 90 days after we deliver it unless you book a pilot. The model stays private unless you agree otherwise. To have everything deleted sooner, email info@vectreal.com with your reference code.',
		privacyLink: 'Privacy policy',
		turnstileFailed:
			'Verification could not load, which is usually an extension or a network blocking it. Reload to try again, or email the photos to',
		submit: 'Send photos',
		submitting: 'Sending',
		next: {
			heading: 'What happens next',
			steps: [
				'We make the model from your photos and check it by hand.',
				'Within 48 hours you get GLB and USDZ files by email.',
				"You upload them to your product's own 3D slot in Shopify. Nothing to install.",
				'If you like it, we can make five products as a paid pilot.'
			],
			note: 'A model made from photos approximates your product. You see it before anything goes live.'
		},
		fieldErrors: {
			name: () => 'Please enter your name.',
			email: () => 'Please enter a valid email address.',
			company: () => 'Please enter your company or brand.',
			productType: () => 'Please choose a product type.',
			photosCount: () => 'Please add exactly three photos.',
			photoType: (n) => `Photo ${n} isn't a JPEG, PNG, WebP or HEIC image.`,
			photoSize: (n) => `Photo ${n} is larger than 15 MB.`,
			size: () =>
				'Please enter a size between 1 and 500 cm, or leave it empty.',
			message: () => 'Please keep the message under 2,000 characters.',
			consent: () => 'Please confirm this to send your photos.'
		},
		formErrors: {
			validation: 'Please fix the highlighted fields.',
			bot: 'Bot verification failed. Please try again.',
			rateLimit:
				'Too many requests from this address. Please wait a few minutes and try again.',
			server:
				"We couldn't receive your photos right now. Please email them to info@vectreal.com."
		},
		success: {
			heading: 'Photos received',
			body: (code) =>
				`We'll email you within 48 hours. Your reference code is ${code}.`,
			confirmationFailed:
				"We received your photos but couldn't send the confirmation email. Keep your reference code.",
			again: 'Send another product'
		},
		confirmationEmail: {
			subject: (code) => `We received your photos (${code})`,
			preview: 'We are making the 3D model from your photos.',
			greeting: (name) => `Hi ${name},`,
			body: "Thanks for sending three photos of your product. We're making the 3D model from your photos and will email you the GLB and USDZ files within 48 hours.",
			reference: 'Your reference code',
			deletion:
				'To have your photos and details deleted, reply to this email with your reference code.',
			signature: 'Moritz Becker, Vectreal, Hamburg'
		}
	},
	de: {
		meta: {
			title: 'Ein kostenloses 3D-Modell Ihres Produkts - Vectreal',
			description:
				'Senden Sie drei Fotos eines Produkts. Wir erstellen daraus ein 3D-Modell und schicken es Ihnen zurück, bereit für den 3D-Platz in Shopify.'
		},
		hero: {
			heading: 'Ein kostenloses 3D-Modell eines Ihrer Produkte',
			description:
				'Schicken Sie uns drei Fotos eines Produkts. Wir erstellen das 3D-Modell aus Ihren Fotos und senden es Ihnen innerhalb von 48 Stunden zurück, als GLB- und USDZ-Datei für den 3D-Platz in Shopify.'
		},
		languageLink: 'English',
		fields: {
			name: { label: 'Ihr Name', placeholder: 'Erika Mustermann' },
			email: { label: 'Geschäftliche E-Mail', placeholder: 'sie@firma.de' },
			company: { label: 'Firma oder Marke' },
			productType: {
				label: 'Welche Art von Produkt?',
				placeholder: 'Produktart wählen',
				options: {
					furniture: 'Möbel und Leuchten',
					shoes: 'Schuhe',
					bags: 'Taschen und Accessoires',
					electronics: 'Kleine Elektronik',
					ceramics:
						'Keramik und Küchenware (kein Glas, Emaille oder Gusseisen)',
					other: 'Etwas anderes'
				},
				otherHint:
					'Wir sehen es uns zuerst an und sagen Ihnen, ob wir es umsetzen können.'
			},
			photos: {
				label: 'Drei Fotos des Produkts',
				help: 'Am besten von vorne, von der Seite und von hinten, vor einem ruhigen Hintergrund. JPEG, PNG, WebP oder HEIC, bis zu 15 MB pro Foto.',
				slot: (n) => `Foto ${n}`,
				add: 'Foto hinzufügen',
				remove: (n) => `Foto ${n} entfernen`
			},
			size: {
				label: 'Ungefähre Maße in cm (optional)',
				parts: { height: 'Höhe', width: 'Breite', depth: 'Tiefe' },
				help: 'Damit das Modell die echte Größe Ihres Produkts hat.'
			},
			message: {
				label: 'Was sollten wir wissen? (optional)',
				placeholder: 'Farben, Materialien oder ein Link zur Produktseite.'
			},
			consentFollowUp:
				'Vectreal darf mir zu diesem Modell und zu einem kostenpflichtigen Pilotangebot E-Mails senden. Ich kann das jederzeit widerrufen.',
			consentPhotos:
				'Ich darf diese Fotos weitergeben, und Vectreal darf sie verwenden, um dieses Modell zu erstellen.'
		},
		privacyNote:
			'Wir speichern Ihre Angaben und Fotos, um Ihr Modell zu erstellen, und löschen sie 90 Tage nach der Lieferung, sofern Sie keinen Pilot buchen. Das Modell bleibt privat, wenn Sie nichts anderes vereinbaren. Für eine frühere Löschung schreiben Sie mit Ihrer Referenznummer an info@vectreal.com.',
		privacyLink: 'Datenschutzerklärung',
		turnstileFailed:
			'Die Prüfung konnte nicht geladen werden, meist weil eine Erweiterung oder das Netzwerk sie blockiert. Laden Sie die Seite neu oder senden Sie die Fotos an',
		submit: 'Fotos senden',
		submitting: 'Wird gesendet',
		next: {
			heading: 'So geht es weiter',
			steps: [
				'Wir erstellen das Modell aus Ihren Fotos und prüfen es von Hand.',
				'Innerhalb von 48 Stunden erhalten Sie GLB- und USDZ-Dateien per E-Mail.',
				'Sie laden sie in den 3D-Platz Ihres Produkts in Shopify hoch. Nichts zu installieren.',
				'Wenn es Ihnen gefällt, setzen wir fünf Produkte als bezahlten Pilot um.'
			],
			note: 'Ein Modell aus Fotos bildet Ihr Produkt näherungsweise ab. Sie sehen es, bevor etwas live geht.'
		},
		fieldErrors: {
			name: () => 'Bitte geben Sie Ihren Namen ein.',
			email: () => 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
			company: () => 'Bitte geben Sie Ihre Firma oder Marke ein.',
			productType: () => 'Bitte wählen Sie eine Produktart.',
			photosCount: () => 'Bitte fügen Sie genau drei Fotos hinzu.',
			photoType: (n) => `Foto ${n} ist kein JPEG-, PNG-, WebP- oder HEIC-Bild.`,
			photoSize: (n) => `Foto ${n} ist größer als 15 MB.`,
			size: () =>
				'Bitte geben Sie eine Größe zwischen 1 und 500 cm ein oder lassen Sie das Feld leer.',
			message: () => 'Bitte halten Sie die Nachricht unter 2.000 Zeichen.',
			consent: () => 'Bitte bestätigen Sie dies, um Ihre Fotos zu senden.'
		},
		formErrors: {
			validation: 'Bitte korrigieren Sie die markierten Felder.',
			bot: 'Die Bot-Prüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
			rateLimit:
				'Zu viele Anfragen von dieser Adresse. Bitte warten Sie einige Minuten und versuchen Sie es erneut.',
			server:
				'Wir konnten Ihre Fotos gerade nicht empfangen. Bitte senden Sie sie an info@vectreal.com.'
		},
		success: {
			heading: 'Fotos erhalten',
			body: (code) =>
				`Wir melden uns innerhalb von 48 Stunden per E-Mail. Ihre Referenznummer lautet ${code}.`,
			confirmationFailed:
				'Wir haben Ihre Fotos erhalten, konnten aber keine Bestätigung per E-Mail senden. Bitte notieren Sie Ihre Referenznummer.',
			again: 'Weiteres Produkt senden'
		},
		confirmationEmail: {
			subject: (code) => `Wir haben Ihre Fotos erhalten (${code})`,
			preview: 'Wir erstellen das 3D-Modell aus Ihren Fotos.',
			greeting: (name) => `Guten Tag ${name},`,
			body: 'vielen Dank für Ihre drei Produktfotos. Wir erstellen das 3D-Modell aus Ihren Fotos und senden Ihnen die GLB- und USDZ-Dateien innerhalb von 48 Stunden per E-Mail.',
			reference: 'Ihre Referenznummer',
			deletion:
				'Wenn Sie möchten, dass wir Ihre Fotos und Angaben löschen, antworten Sie auf diese E-Mail mit Ihrer Referenznummer.',
			signature: 'Moritz Becker, Vectreal, Hamburg'
		}
	}
}
