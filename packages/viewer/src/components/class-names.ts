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

/**
 * The viewer's classes for an element with a host's `className` added.
 *
 * A viewer class is dropped when it and a host class set any property in
 * common, in either direction: `h-96` drops `vv:h-full`, and `px-2` drops
 * `vv:p-1` too. In Tailwind's own order `p-1 px-2` keeps the vertical padding,
 * but that relies on both rules sharing a layer, and the viewer's sits above
 * the host's, so `vv:p-1` would win the horizontal padding as well.
 */
export function withHostClasses(own: string, host: string | undefined) {
	const hostTokens = tokensOf(host ?? '')
	if (hostTokens.length === 0) return own
	const hostClasses = hostTokens.join(' ')
	// What the host's classes leave of themselves, so a conflict among them is
	// not read as one with the viewer's.
	const hostKept = tokensOf(twMerge(hostClasses)).length
	const kept = tokensOf(own).filter((token) => {
		const bare = token.startsWith(PREFIX) ? token.slice(PREFIX.length) : token
		const hostAfter = tokensOf(twMerge(`${bare} ${hostClasses}`))
		const hostBefore = tokensOf(twMerge(`${hostClasses} ${bare}`))
		return hostAfter.includes(bare) && hostBefore.length === hostKept + 1
	})
	return [...kept, ...hostTokens].join(' ')
}
