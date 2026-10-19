/**
 * The viewer's classes carry Tailwind's `vv:` prefix, so a class a host passes
 * in is never also one of the viewer's own rules.
 *
 * The viewer's stylesheet is unlayered, and an unlayered rule beats every
 * layered one, which is where a Tailwind host's utilities live. While the
 * viewer shipped plain `hidden`, a host's `hidden md:block` on it stayed
 * hidden: the viewer's `.hidden` won over the host's `md:block`. With the
 * prefix the viewer only ever emits `.vv\:hidden`, and the host's classes are
 * styled by the host's own stylesheet alone.
 *
 * One collision is left, on an element that wears both: the viewer's root, and
 * the root of each exported control. There `withHostClasses` drops every viewer
 * class a host class touches, so the host's is the only rule left for that
 * property.
 */
import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge, twMerge } from 'tailwind-merge'

const PREFIX = 'vv:'

const mergeOwn = extendTailwindMerge({ prefix: 'vv' })

/** Joins the viewer's own classes, a later one overriding an earlier one. */
export function cn(...inputs: ClassValue[]) {
	return mergeOwn(clsx(inputs))
}

const tokensOf = (classes: string) => classes.split(/\s+/).filter(Boolean)

/** A class split into its variants and its utility: `md:h-96` is `md`, `h-96`. */
function partsOf(token: string) {
	const parts: string[] = []
	let depth = 0
	let start = 0
	for (let index = 0; index < token.length; index++) {
		const char = token[index]
		if (char === '[' || char === '(') depth++
		else if (char === ']' || char === ')') depth--
		else if (char === ':' && depth === 0) {
			parts.push(token.slice(start, index))
			start = index + 1
		}
	}
	return { variants: parts, utility: token.slice(start) }
}

/*
  Variants that move a class onto other elements or boxes: an arbitrary
  selector (`[&_p]:m-0` styles the paragraphs inside), the child variants and
  the pseudo-elements. Such a class never meets one on the element itself.
*/
const ELSEWHERE = new Set([
	'*',
	'**',
	'before',
	'after',
	'placeholder',
	'file',
	'marker',
	'selection',
	'backdrop',
	'first-letter',
	'first-line'
])

/**
 * The utility a class sets on the element it is written on, or `null` when it
 * styles something else.
 */
function ownUtility(token: string) {
	const { variants, utility } = partsOf(token)
	return variants.some(
		(variant) => variant.startsWith('[') || ELSEWHERE.has(variant)
	)
		? null
		: utility
}

/**
 * The viewer's classes for an element with a host's `className` added.
 *
 * A viewer class is dropped when it and a host class set any property in
 * common, in either direction: `h-96` drops `vv:h-full`, and `px-2` drops
 * `vv:p-1` too. In Tailwind's own order `p-1 px-2` keeps the vertical padding,
 * but that relies on both rules sharing a layer, and the viewer's sits above
 * the host's, so `vv:p-1` would win the horizontal padding as well.
 *
 * Variants are ignored on both sides, for the same reason: the viewer's
 * unlayered `vv:h-full` beats a host's `md:h-96` at every width, so a host
 * class under any variant takes the property from the viewer altogether.
 * The host passes the base as well (`h-full md:h-96`) to keep one. A class
 * that styles other elements (`[&_p]:m-0`) is left out of the comparison on
 * either side.
 */
export function withHostClasses(own: string, host: string | undefined) {
	const hostTokens = tokensOf(host ?? '')
	if (hostTokens.length === 0) return own
	const hostClasses = hostTokens
		.map(ownUtility)
		.filter((utility) => utility !== null)
		.join(' ')
	// What the host's classes leave of themselves, so a conflict among them is
	// not read as one with the viewer's.
	const hostKept = tokensOf(twMerge(hostClasses)).length
	const kept = tokensOf(own).filter((token) => {
		const bare = ownUtility(
			token.startsWith(PREFIX) ? token.slice(PREFIX.length) : token
		)
		if (bare === null || hostClasses === '') return true
		const hostAfter = tokensOf(twMerge(`${bare} ${hostClasses}`))
		const hostBefore = tokensOf(twMerge(`${hostClasses} ${bare}`))
		return hostAfter.includes(bare) && hostBefore.length === hostKept + 1
	})
	return [...kept, ...hostTokens].join(' ')
}
