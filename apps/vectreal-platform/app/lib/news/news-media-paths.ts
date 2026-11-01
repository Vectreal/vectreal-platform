import { isValidElement } from 'react'

// A whole value that is a path, so a sentence that starts with one is not.
const NEWSROOM_MEDIA = /^\/media\/[^/\s]+\/newsroom\/\S+$/

/**
 * Every newsroom media path an article names, lowercased the way
 * `normalizeRequestPath` compares them.
 *
 * Read from the rendered body's props: an MDX image, video or component
 * keeps the URL it was written with there, before any component runs. A URL
 * a component computes itself (an example scene's model, say) is not seen.
 *
 * Only `/media/<kind>/newsroom/` counts. A body may name a file the rest of
 * the site uses, the logo say, and withholding that would break every page
 * that shows it until the article goes live.
 */
export function collectMediaPaths(
	value: unknown,
	into: Set<string>
): Set<string> {
	if (typeof value === 'string') {
		const path = value.split(/[?#]/)[0].toLowerCase()
		if (NEWSROOM_MEDIA.test(path)) into.add(path)
	} else if (Array.isArray(value)) {
		for (const item of value) collectMediaPaths(item, into)
	} else if (isValidElement(value)) {
		collectMediaPaths(value.props, into)
	} else if (value !== null && typeof value === 'object') {
		for (const item of Object.values(value)) collectMediaPaths(item, into)
	}
	return into
}

/**
 * Every media path an article uses: newsroom media its body names, plus the
 * images its frontmatter names wherever they live. Those are the article's
 * own (the og image has the title on it), so the newsroom-only scope above
 * does not apply to them.
 */
export function articleMediaPaths(
	body: unknown,
	frontmatterImages: (string | undefined)[]
): Set<string> {
	const paths = collectMediaPaths(body, new Set())
	for (const image of frontmatterImages) {
		if (image) paths.add(image.split(/[?#]/)[0].toLowerCase())
	}
	return paths
}
