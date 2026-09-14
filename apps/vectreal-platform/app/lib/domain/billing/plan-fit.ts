import { formatLimitValue } from '../../../constants/limit-format'
import {
	PLAN_LIMITS,
	type LimitKey,
	type Plan
} from '../../../constants/plan-config'
import {
	LIMIT_DISPLAY_LABELS,
	PLAN_DISPLAY_NAMES,
	STORAGE_USAGE_LABEL
} from '../../../constants/product-copy'

import type { OrgUsage } from '../dashboard/dashboard-types'

/**
 * Whether this plan still fits, and what the next one would change.
 *
 * The billing page's question is not "what am I paying" - for every
 * organization in production the answer is nothing, and they know. It is **am I
 * on the right plan**, and that cannot be answered by a plan name and a button.
 * It needs the reader's own numbers: what they are using, what this plan allows,
 * and what the next one allows.
 *
 * **Only the readings that are actually tight appear.** A page that lists all
 * five every time is a comparison grid, and a grid makes the reader do the
 * work of finding the one row that matters - the same job the public pricing
 * table already does badly, where sixteen of seventeen entitlement rows are
 * identical between Free and Pro. When nothing is tight the honest answer is
 * one sentence saying so, and the page should be short.
 *
 * This is deliberately not `describeUsageVerdict`, which answers a different
 * question on a different page. That one refuses to lead with a plan-shaped cap
 * - free allows one project and creates it at signup, so reporting it as
 * pressure would make the usage page cry wolf permanently for everybody. Here
 * the plan *is* the subject, so "Free includes one project and you are using
 * it" is the answer rather than an interruption, and it is phrased as what the
 * plans hold rather than as something the reader has let happen.
 */

/**
 * The plan that can be bought from inside the product.
 *
 * Enterprise is a conversation rather than a checkout, so nothing sits above
 * Business here. This replaced `plan === 'pro' ? 'business' : 'pro'`, a ladder
 * written as a ternary and wrong at the top of it: a Business organization was
 * offered `?plan=pro`, the app proposing a downgrade to its largest customers.
 */
export const NEXT_PLAN_UP: Partial<Record<Plan, Plan>> = {
	free: 'pro',
	pro: 'business'
}

/*
	At or above this share of a limit, a reading is worth a reader's attention.
	The same 80% the usage page uses - two pages disagreeing about what "nearly
	full" means would be worse than either number being wrong.
*/
const TIGHT_AT = 0.8

export interface PlanFitRow {
	key: LimitKey
	label: string
	/** What they are using, in the reading's own units. */
	usedLabel: string
	/** What this plan allows. */
	limitLabel: string
	/** What the next purchasable plan allows, when there is one. */
	nextLimitLabel: string | null
	/** Full, rather than merely close. */
	atLimit: boolean
}

export interface PlanFit {
	/** The plan a reader could move to, for the button and the copy. */
	nextPlan: Plan | null
	nextPlanLabel: string | null
	/** Only the readings under pressure. Empty is the common and good case. */
	rows: PlanFitRow[]
	/** Said when nothing is tight, so the page still answers its question. */
	headline: string | null
}

/*
	The dashboard's one spelling for a number, matching `billing-situation.ts`.
	Business allows 2,000 scenes and 5,000 folders, and digit grouping differs by
	locale - so an unpinned format is rendered one way by the container and
	another by the browser, which is a hydration mismatch on a server-rendered
	page.
*/
const DASHBOARD_LOCALE = 'en-US'

interface Reading {
	key: LimitKey
	label: string
	used: number
	limit: number | null
	/** Bytes are counted raw and formatted by `formatLimitValue`. */
	format: (value: number | null) => string
}

function buildReadings(usage: OrgUsage): Reading[] {
	const count =
		(key: LimitKey) =>
		(value: number | null): string =>
			formatLimitValue(key, value, DASHBOARD_LOCALE)

	return [
		{
			key: 'projects_total',
			label: LIMIT_DISPLAY_LABELS.projects_total,
			used: usage.projectsTotal,
			limit: usage.projectsLimit,
			format: count('projects_total')
		},
		{
			key: 'scenes_total',
			label: LIMIT_DISPLAY_LABELS.scenes_total,
			used: usage.scenesTotal,
			limit: usage.sceneLimit,
			format: count('scenes_total')
		},
		{
			key: 'scenes_published_concurrent',
			label: LIMIT_DISPLAY_LABELS.scenes_published_concurrent,
			used: usage.publishedScenes,
			limit: usage.publishedSceneLimit,
			format: count('scenes_published_concurrent')
		},
		{
			key: 'storage_bytes_total',
			label: STORAGE_USAGE_LABEL,
			used: usage.storageBytesTotal,
			limit: usage.storageLimit,
			format: count('storage_bytes_total')
		},
		{
			key: 'folders_total',
			label: LIMIT_DISPLAY_LABELS.folders_total,
			used: usage.foldersTotal,
			limit: usage.foldersLimit,
			format: count('folders_total')
		}
	]
}

export function describePlanFit(usage: OrgUsage, plan: Plan): PlanFit {
	const nextPlan = NEXT_PLAN_UP[plan] ?? null
	const nextPlanLabel = nextPlan ? PLAN_DISPLAY_NAMES[nextPlan] : null

	/*
	  The current limit comes from `loadOrgUsage`, which resolves overrides, and
	  the next plan's comes from `PLAN_LIMITS` directly. For an organization
	  holding an `org_limit_overrides` row the two would be measured differently
	  - but that table has no write path in the product and zero rows in every
	  environment, so the alternative is a branch nothing can reach. Noted rather
	  than guarded, because a guard here would be the unreachable code.
	*/
	const rows = buildReadings(usage)
		/*
		  An unlimited reading cannot be tight, and a limit of zero would divide
		  by it. Enterprise holds `null` for every limit, so its plan always fits
		  and the page says so in one line.
		*/
		.filter((reading) => reading.limit !== null && reading.limit > 0)
		.filter((reading) => reading.used / (reading.limit as number) >= TIGHT_AT)
		.map((reading) => ({
			key: reading.key,
			label: reading.label,
			usedLabel: reading.format(reading.used),
			limitLabel: reading.format(reading.limit),
			nextLimitLabel: nextPlan
				? reading.format(PLAN_LIMITS[nextPlan][reading.key])
				: null,
			atLimit: reading.used >= (reading.limit as number)
		}))

	return {
		nextPlan,
		nextPlanLabel,
		rows,
		/*
		  Only when there is nothing to show. With rows on screen a sentence
		  above them saying the plan fits would contradict them, and one saying
		  it does not would restate what the reader can already read.
		*/
		headline:
			rows.length === 0
				? `${PLAN_DISPLAY_NAMES[plan]} covers what you are using.`
				: null
	}
}
