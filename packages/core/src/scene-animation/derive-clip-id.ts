/**
 * Reduces a clip name to a stable, url-safe token.
 *
 * Anything outside `[a-z0-9]` collapses to a single dash, so a name made up
 * entirely of punctuation or non-latin script reduces to an empty string. That
 * is deliberate: such a name carries no usable identity, and the caller falls
 * back to a positional id rather than inventing one.
 *
 * Written as a single pass rather than with `replace` and a trimming pattern.
 * Clip names arrive from an uploaded file, so they are untrusted, and a
 * trailing-run pattern like `-+$` backtracks quadratically. Emitting the
 * separator lazily is linear by construction and needs no such argument.
 */
function slugifyClipName(name: string): string {
	let slug = ''
	let separatorPending = false

	for (const character of name.toLowerCase()) {
		const isSlugCharacter =
			(character >= 'a' && character <= 'z') ||
			(character >= '0' && character <= '9')

		if (!isSlugCharacter) {
			// Held back rather than appended, so a run of separators collapses and
			// neither a leading nor a trailing dash can ever be emitted.
			separatorPending = true
			continue
		}

		if (separatorPending && slug) slug += '-'
		separatorPending = false
		slug += character
	}

	return slug
}

/**
 * FNV-1a over the raw name, rendered as fixed-width hex.
 *
 * The slug alone is not an identity: it is lossy, so two different names can
 * reduce to the same token, and any name outside the latin alphanumerics
 * reduces to nothing at all. Folding a digest of the untouched name into the
 * id keeps distinct names distinct, which is what makes the id independent of
 * position. Collision resistance is not a security property here, only a
 * convenience, so a short non-cryptographic digest is the right size.
 */
function hashClipName(name: string): string {
	let hash = 0x811c9dc5

	for (let index = 0; index < name.length; index += 1) {
		hash ^= name.charCodeAt(index)
		// The classic FNV prime multiply, written as shifts so the whole thing
		// stays inside 32-bit integer math in JS.
		hash = Math.imul(hash, 0x01000193) >>> 0
	}

	return hash.toString(16).padStart(8, '0')
}

/**
 * Produces a stable id for one animation clip.
 *
 * glTF clip names are optional and are not required to be unique, so identity
 * has to be derived from the only things a fresh parse and a persisted config
 * can both agree on: the name, and the clip's ordinal among clips carrying the
 * *same* name.
 *
 * The id is a readable slug plus a digest of the raw name. The slug alone was
 * not enough, and both failures were silent:
 *
 * - `take_001` and `Take 001` slugify identically, so their ids differed only
 *   by an ordinal assigned in file order. Re-exporting with those two swapped
 *   moved each saved config onto the other clip, and because both ids still
 *   existed, reconciliation reported an exact match rather than a remap.
 * - A name in any non-latin script slugifies to nothing, so every clip in, say,
 *   a Japanese-authored file was identified purely by position. Inserting one
 *   clip shifted every saved config onto its neighbour.
 *
 * With the digest, only genuinely identical names share a base, and for those
 * an ordinal is the only thing left to tell them apart.
 *
 * `seen` accumulates across one pass over a clip list and must be shared by
 * every call in that pass. Callers should prefer `describeAnimationClips`,
 * which manages it for them.
 *
 * @param name Raw clip name, or undefined for an unnamed clip.
 * @param seen Mutable tally of base ids already issued in this pass.
 */
export function deriveAnimationClipId(
	name: string | undefined,
	seen: Map<string, number>
): string {
	const rawName = name ?? ''
	const slug = slugifyClipName(rawName)
	const digest = hashClipName(rawName)
	const base = slug ? `${slug}-${digest}` : `clip-${digest}`

	const previous = seen.get(base) ?? 0
	seen.set(base, previous + 1)

	// Only reachable when two clips carry byte-identical names, which leaves
	// nothing but order of appearance to separate them. Position is deliberately
	// absent from the base, so adding or removing a clip cannot renumber the
	// clips around it.
	return previous === 0 ? base : `${base}~${previous}`
}
