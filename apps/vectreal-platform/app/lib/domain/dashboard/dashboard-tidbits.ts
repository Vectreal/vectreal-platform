import { formatFileSize } from '@shared/utils'
import { IMPORTABLE_FORMAT_LABELS } from '@vctrl/core/model-formats'

import { DASHBOARD_LOCALE } from '../../../constants/limit-format'

/**
 * What the dashboard knows about someone's work, summed across every
 * organization they belong to: the same reach as the recent-scenes list beside
 * it, so the figure and the cards never describe two different sets.
 */
export interface DashboardFacts {
	sceneCount: number
	/** Projects holding at least one of those scenes. */
	projectCount: number
	publishedCount: number
	/** Summed over scenes with both sizes on record, and only those. */
	initialBytes: number
	currentBytes: number
	measuredSceneCount: number
	/** Summed over scenes with both vertex counts on record. */
	verticesBefore: number
	verticesAfter: number
	/** The scene whose optimization took the largest share of its weight. */
	biggestCut: {
		sceneName: string
		initialBytes: number
		currentBytes: number
	} | null
}

export type TidbitId =
	| 'bytes-saved'
	| 'biggest-cut'
	| 'vertices-removed'
	| 'published'
	| 'library'
	| 'formats'

/** One fact, set as a large figure over the sentence that explains it. */
export interface Tidbit {
	id: TidbitId
	figure: string
	caption: string
}

/*
  Below these a figure is true but not worth the space: "12 KB lighter" reads
  as a rounding error, not as something the optimizer did for you.
*/
const MIN_SAVED_SHARE = 0.05
const MIN_CUT_SHARE = 0.1
const MIN_VERTICES_REMOVED = 1_000
const MIN_LIBRARY_SCENES = 5

const compact = new Intl.NumberFormat(DASHBOARD_LOCALE, {
	notation: 'compact',
	maximumFractionDigits: 1
})
const whole = new Intl.NumberFormat(DASHBOARD_LOCALE)

const plural = (count: number, one: string, many: string) =>
	count === 1 ? one : many

const listFormat = new Intl.ListFormat(DASHBOARD_LOCALE, {
	type: 'conjunction'
})

/**
 * Every fact that holds for this person's work, in no particular order.
 *
 * Each one is computed from rows, never estimated: a figure on the page someone
 * opens every day is a claim, and one that is off once is never believed again.
 * A fact that does not apply is left out rather than shown as a zero. The list
 * is never empty: with no scenes there is the formats fact, and with any scene
 * the library count stands in when nothing else applies.
 */
export function buildTidbits(facts: DashboardFacts): Tidbit[] {
	if (facts.sceneCount === 0) {
		return [
			{
				id: 'formats',
				figure: whole.format(IMPORTABLE_FORMAT_LABELS.length),
				caption: `formats go in: ${listFormat.format(IMPORTABLE_FORMAT_LABELS)}. What comes out is one optimized scene with a link and an embed.`
			}
		]
	}

	const tidbits: Tidbit[] = []

	const saved = facts.initialBytes - facts.currentBytes
	if (facts.initialBytes > 0 && saved / facts.initialBytes >= MIN_SAVED_SHARE) {
		tidbits.push({
			id: 'bytes-saved',
			figure: formatFileSize(saved),
			caption: `lighter than the original uploads, across ${whole.format(facts.measuredSceneCount)} ${plural(facts.measuredSceneCount, 'scene', 'scenes')}.`
		})
	}

	const cut = facts.biggestCut
	if (cut && cut.initialBytes > 0) {
		const share = 1 - cut.currentBytes / cut.initialBytes
		if (share >= MIN_CUT_SHARE) {
			tidbits.push({
				id: 'biggest-cut',
				figure: `${Math.floor(share * 100)}%`,
				caption: `of ${cut.sceneName} is gone: ${formatFileSize(cut.initialBytes)} down to ${formatFileSize(cut.currentBytes)}.`
			})
		}
	}

	const removed = facts.verticesBefore - facts.verticesAfter
	if (removed >= MIN_VERTICES_REMOVED) {
		tidbits.push({
			id: 'vertices-removed',
			figure: compact.format(removed),
			caption: `fewer vertices for your visitors' devices to draw.`
		})
	}

	if (facts.publishedCount > 0) {
		tidbits.push({
			id: 'published',
			figure: whole.format(facts.publishedCount),
			caption: `${plural(facts.publishedCount, 'scene', 'scenes')} live on the web right now.`
		})
	}

	/*
	  The count is a fact about anyone with a scene, so it is the fallback, and
	  only competes with the rest once it is worth reading: "1 scene across 1
	  project" said nothing the card beside it did not.
	*/
	if (tidbits.length === 0 || facts.sceneCount >= MIN_LIBRARY_SCENES) {
		tidbits.push({
			id: 'library',
			figure: whole.format(facts.sceneCount),
			caption: `${plural(facts.sceneCount, 'scene', 'scenes')} across ${whole.format(facts.projectCount)} ${plural(facts.projectCount, 'project', 'projects')}, all in one place.`
		})
	}

	return tidbits
}

/**
 * One fact per visit. Picked in the loader, so the server's HTML and the
 * hydrated page agree on it without a seed.
 */
export function pickTidbit(
	tidbits: readonly Tidbit[],
	random: () => number = Math.random
): Tidbit {
	return tidbits[
		Math.min(Math.floor(random() * tidbits.length), tidbits.length - 1)
	]
}
