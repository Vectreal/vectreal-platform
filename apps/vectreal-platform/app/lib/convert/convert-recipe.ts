import type { ConvertOption, ConvertPair } from './convert-pairs'

/**
 * The identity of a conversion: what produced it, and what it applied first.
 *
 * `scope` is the pair for a stored result, so a result only ever appears on the
 * page that ran it. Keying by target alone made the target the whole identity,
 * and the model outlives a move along the rail - so a GLB converted on one page
 * was presented on another as that page's own source, with its title, its note
 * and a reduction measured against the wrong file.
 *
 * THE RULE THIS EXISTS TO STATE. A result is valid only for the exact page and
 * option set that produced it - and that was previously enforced by hand in
 * three different places, each clearing state on a different event: a toggle
 * cleared the result, a pair change cleared it through an effect, and a separate
 * boolean tracked which pass the live document had been given. Three
 * approximations of one rule, so the case reached by none of them - switching
 * pair with a result on screen - left a USDZ offered for download from the glTF
 * page.
 *
 * Stamping the result instead makes validity something to read rather than
 * something to remember: the result on screen is the one whose key matches the
 * page you are on and the boxes you have ticked, and every event that used to
 * need its own handler is just a key that stops matching.
 *
 * Sorted, because the order the boxes were ticked is not part of the recipe.
 */
export function convertRecipeKey(
	scope: string,
	options: readonly ConvertOption[]
): string {
	return `${scope}:${[...options].sort().join(',')}`
}

/**
 * The key a page's own result is stored and found under.
 *
 * Here rather than in the surface because it is the identity rule, and the
 * surface had half of it: it keyed a result by the format being written, while
 * the thing that decides whether a result describes what the page claims is the
 * *page*. Both the loaded model and the surface survive a move along the rail,
 * so the two are not interchangeable, and the difference is only visible on a
 * page the visitor reached second.
 */
export function conversionKeyFor(
	pair: ConvertPair,
	options: readonly ConvertOption[]
): string {
	return convertRecipeKey(pair.slug, options)
}

/**
 * The ticked options this target can actually honour.
 *
 * `selected` deliberately survives a pair change, so a box stays ticked across a
 * detour to another format and back. That only works if a tick the current
 * target has no pass for is dropped here rather than remembered, because
 * otherwise carrying `draco` onto a glTF page would describe a conversion that
 * never ran.
 */
export function activeConvertOptions(
	selected: readonly ConvertOption[],
	offered: readonly ConvertOption[]
): ConvertOption[] {
	return selected.filter((one) => offered.includes(one))
}

/**
 * Stores a conversion, keeping at most `limit` of the most recently stored.
 *
 * More than one because the rail invites converting a model to several formats
 * in one sitting, and a result that survives a detour is the difference between
 * "switch back and it is still there" and "switch back and do it again". Not
 * many, because each entry holds the whole encoded file and a USDZ of a 13 MB
 * model is around 40 MB.
 *
 * The arithmetic is the whole reason this is not inline in the component. It was
 * written there as `keys.slice(0, keys.length - limit)`, which reads as "the
 * ones past the cap" and is that only while the cap is exceeded: with two
 * entries and a limit of three it is `slice(0, -1)`, which is every key but the
 * last. So the second conversion evicted the first, and the cache the cap exists
 * to bound never held more than one thing.
 */
export function storeConversion<T>(
	current: Readonly<Record<string, T>>,
	key: string,
	value: T,
	limit: number
): Record<string, T> {
	// Re-inserting rather than spreading over the old entry, so a re-run of an
	// existing recipe counts as recent and is not the next one evicted.
	const next: Record<string, T> = { ...current }
	delete next[key]
	next[key] = value

	const keys = Object.keys(next)

	for (const stale of keys.slice(0, Math.max(0, keys.length - limit))) {
		delete next[stale]
	}

	return next
}
