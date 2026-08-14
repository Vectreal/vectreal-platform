/**
 * Reduces a clip name to a stable, url-safe token.
 *
 * Anything outside `[a-z0-9]` collapses to a single dash, so a name made up
 * entirely of punctuation or non-latin script reduces to an empty string. That
 * is deliberate: such a name carries no usable identity, and the caller falls
 * back to a positional id rather than inventing one.
 */
function slugifyClipName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

/**
 * Produces a stable id for one animation clip.
 *
 * glTF clip names are optional and are not required to be unique, so identity
 * has to be derived from the only thing a fresh parse and a persisted config
 * can both agree on: the name and the clip's ordinal among identically-named
 * clips. Name-derived ids survive clips being reordered inside the source file;
 * unnamed clips fall back to their position, which is all they have.
 *
 * `seen` accumulates across one pass over a clip list and must be shared by
 * every call in that pass. Callers should prefer `describeAnimationClips`,
 * which manages it for them.
 *
 * @param name Raw clip name, or undefined for an unnamed clip.
 * @param index Zero-based position of the clip in its source list.
 * @param seen Mutable tally of base ids already issued in this pass.
 */
export function deriveAnimationClipId(
	name: string | undefined,
	index: number,
	seen: Map<string, number>
): string {
	const slug = name ? slugifyClipName(name) : ''
	const base = slug || `clip-${index}`

	// Disambiguate positional ids too, not just slugs: a clip literally named
	// "clip 3" slugifies onto the same base as the unnamed clip at index 3.
	const previous = seen.get(base) ?? 0
	seen.set(base, previous + 1)

	return previous === 0 ? base : `${base}~${previous}`
}
