import type { LimitKey } from '../../../constants/plan-config'

/**
 * Whether this organization needs to do anything, and what.
 *
 * The usage page's job is not to show five numbers. It is to answer "do I need
 * to act", and the numbers are the evidence. That answer differs by state in
 * ways a grid of meters cannot express:
 *
 * - A new account has nothing stored and nothing to do. Leading it with an
 *   alarm is worse than saying nothing.
 * - An account with no limits at all - Enterprise - has no verdict to give, and
 *   five rails reading "No limit" are furniture.
 * - An account that is blocked needs the remedy first, because it arrived here
 *   from a refusal.
 * - An account whose only full reading is a plan-shaped cap needs to be told
 *   nothing. That is the state of every free organization from signup, and a
 *   headline about it is a permanent announcement of a fact that never changes.
 * - An account near a limit needs to know *which*, because the remedy differs:
 *   storage is optimized, scenes are deleted, published slots are freed, and
 *   projects cannot be fixed at all except by changing plan.
 *
 * That last one is why this exists as a module rather than a ternary in the
 * page. On free, `projects_total` is 1 and a project is created at signup, so
 * `readUsage(1, 1)` scores critical for every free organization from the moment
 * it exists. Reported as pressure it makes the page cry wolf permanently, which
 * is the same defect the dashboard band had.
 *
 * It first got its own `plan` tone, which was the same mistake in a quieter
 * voice: "Free includes one project" led the page for every free organization
 * forever, whatever the other four readings said, and its remedy - "more
 * projects need a larger plan" - is an upsell wearing a remedy's clothes on a
 * page where nothing is wrong. A plan-shaped cap is not a verdict. It is
 * reported by its own row, which reads "At the limit - 1 / 1" without an alarm,
 * and it is kept out of the ranking so it cannot outrank a reading that does
 * need action.
 */

export type UsageVerdictTone =
	'empty' | 'unlimited' | 'blocked' | 'near' | 'clear'

export interface UsageReadingInput {
	key: LimitKey
	label: string
	current: number
	limit: number | null
}

export interface UsageVerdict {
	tone: UsageVerdictTone
	headline: string
	/** What to do about it, when there is something to do. */
	remedy: string | null
	/** The reading the headline is about, so the page can lead with it. */
	bindingKey: LimitKey | null
}

/** At or above this share of a limit, a reading is worth naming. */
const NEAR_AT = 0.8

/*
	The remedy is per limit because the action is. Storage is the only one you
	can optimize your way out of; scenes and folders are deleted; a published
	slot is freed by unpublishing. Projects has no local remedy at all, which is
	exactly why it needs to be said rather than implied by a red bar.
*/
const REMEDIES: Partial<Record<LimitKey, string>> = {
	storage_bytes_total:
		'Optimize the heaviest scene below, or delete what you no longer need.',
	scenes_total: 'Delete a scene you have finished with, or move up a plan.',
	scenes_published_concurrent:
		'Unpublish a scene to free a slot. Unpublishing keeps the scene.',
	folders_total: 'Delete a folder you no longer need.',
	projects_total: 'More projects need a larger plan; nothing here frees one.'
}

function share(reading: UsageReadingInput): number | null {
	if (reading.limit === null || reading.limit <= 0) return null
	return reading.current / reading.limit
}

/**
 * A limit of one, occupied, is the plan rather than a warning.
 *
 * Free allows a single project and creates it at signup, so this state is
 * universal rather than exceptional. It still blocks a second project, so it is
 * reported - just not as something the reader has let happen.
 */
function isPlanShapedCap(reading: UsageReadingInput): boolean {
	return reading.limit === 1 && reading.current >= 1
}

export function describeUsageVerdict(
	readings: UsageReadingInput[],
	planLabel: string
): UsageVerdict {
	const limited = readings.filter((reading) => share(reading) !== null)

	if (limited.length === 0) {
		return {
			tone: 'unlimited',
			headline: `${planLabel} sets no limits on any of this.`,
			remedy: null,
			bindingKey: null
		}
	}

	/*
		"Nothing yet" has to ignore the project every account is born with.

		`initializeUserDefaults` creates "My Project" at signup, so `projects_total`
		is never 0 and a plain `every(current === 0)` was false for every
		organization that has ever existed - making this branch unreachable and
		hiding the one message written for a first visit. The spec passed because
		its fixture used `projects_total: 0`, contradicting the comment directly
		above it.
	*/
	if (
		readings.every(
			(reading) => reading.current === 0 || isPlanShapedCap(reading)
		)
	) {
		return {
			tone: 'empty',
			headline: 'Nothing stored yet.',
			remedy: 'Upload a model and this fills in as you publish.',
			bindingKey: null
		}
	}

	/*
		Actionable pressure first, and a plan-shaped cap only when nothing else is
		wrong. A free organization is permanently at 1 of 1 projects; letting that
		outrank storage at 96% would bury the finding that matters under the one
		that never changes.
	*/
	const actionable = limited
		.filter((reading) => !isPlanShapedCap(reading))
		.map((reading) => ({ reading, ratio: share(reading) as number }))
		.filter(({ ratio }) => ratio >= NEAR_AT)
		.sort((a, b) => b.ratio - a.ratio)

	const worst = actionable[0]

	if (worst) {
		const atLimit = worst.ratio >= 1
		return {
			tone: atLimit ? 'blocked' : 'near',
			headline: atLimit
				? `${worst.reading.label} is full.`
				: `${worst.reading.label} is close to its limit.`,
			remedy: REMEDIES[worst.reading.key] ?? null,
			bindingKey: worst.reading.key
		}
	}

	/*
		"Nothing needs your attention" rather than "nothing is close to a limit".

		A free organization sits at 1 of 1 projects permanently, so the second
		sentence would contradict a row on the same screen reading "At the limit".
		The first is true in both cases and is the answer the page exists to give:
		a cap you cannot act on needs no attention.
	*/
	return {
		tone: 'clear',
		headline: 'Nothing needs your attention.',
		remedy: null,
		bindingKey: null
	}
}
