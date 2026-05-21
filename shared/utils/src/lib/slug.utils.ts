/**
 * Converts a human-readable name into a URL/code-safe slug.
 * e.g. "Front Detail" → "front-detail", "Camera 1" → "camera-1"
 */
export function slugify(name: string, fallback = 'item'): string {
	return (
		name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || fallback
	)
}

/**
 * Derives a unique slug from a name by appending a counter when the base
 * slug already exists in `existingIds`. Pass `excludeId` to ignore the
 * current entry's own ID (for rename operations).
 */
export function deriveUniqueSlug(
	name: string,
	existingIds: string[],
	options: { excludeId?: string; fallback?: string } = {}
): string {
	const base = slugify(name, options.fallback)
	const others = options.excludeId
		? existingIds.filter((id) => id !== options.excludeId)
		: existingIds
	if (!others.includes(base)) return base
	let n = 2
	while (others.includes(`${base}-${n}`)) n++
	return `${base}-${n}`
}
