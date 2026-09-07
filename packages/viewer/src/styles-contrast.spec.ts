import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The viewer's own text has to be readable on the viewer's own surface, in
 * every theme it declares.
 *
 * This is not a style preference dressed up as a test. `--vctrl-text` shipped
 * at #959595 on a #141414 surface, which is dimmer than the host design
 * system's *muted* foreground and was carrying primary text at 11px. It cleared
 * AA and looked wrong anyway, because the same roles in light mode ran at more
 * than double the contrast. Nothing caught it: a colour token has no types, and
 * the two stories that render dark viewer chrome had no baseline to diff
 * against when it was introduced.
 *
 * Computed from the stylesheet rather than asserted as a literal, so the guard
 * is about the relationship between the two values and not about either of them
 * staying a particular string.
 */

const styles = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8')

/** WCAG 2.1 relative luminance. */
const channel = (value: number) => {
	const c = value / 255
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string) => {
	const n = parseInt(hex.slice(1), 16)
	return (
		0.2126 * channel((n >> 16) & 255) +
		0.7152 * channel((n >> 8) & 255) +
		0.0722 * channel(n & 255)
	)
}

const contrast = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (hi + 0.05) / (lo + 0.05)
}

/** What a colour at `alpha` actually looks like once composited on `over`. */
const flatten = (hex: string, over: string, alpha: number) => {
	const fg = parseInt(hex.slice(1), 16)
	const bg = parseInt(over.slice(1), 16)
	const mix = (shift: number) =>
		Math.round(
			alpha * ((fg >> shift) & 255) + (1 - alpha) * ((bg >> shift) & 255)
		)
	return `#${[mix(16), mix(8), mix(0)]
		.map((v) => v.toString(16).padStart(2, '0'))
		.join('')}`
}

/**
 * Every block that sets both tokens, including the one inside the
 * `prefers-color-scheme` media query - which is a second, separately
 * maintained copy of the dark values and the one most likely to be forgotten.
 */
const themedBlocks = () => {
	const found: { selector: string; bg: string; text: string }[] = []
	const blocks = styles.matchAll(/(\.viewer[^{]*)\{([^}]*--vctrl-text[^}]*)\}/g)

	for (const [, selector, body] of blocks) {
		const bg = /--vctrl-bg:\s*(#[0-9a-fA-F]{6})/.exec(body)?.[1]
		const text = /--vctrl-text:\s*(#[0-9a-fA-F]{6})/.exec(body)?.[1]
		if (bg && text) found.push({ selector: selector.trim(), bg, text })
	}

	return found
}

describe('the viewer reads on its own surfaces', () => {
	const blocks = themedBlocks()

	it('found every themed block, not just the first', () => {
		// Four: the base, the two explicit themes, and `system` - which appears
		// twice, once per colour scheme.
		expect(blocks.length).toBeGreaterThanOrEqual(5)
		expect(blocks.some(({ text }) => text.toLowerCase() === '#141414')).toBe(
			false
		)
	})

	it.each(themedBlocks())(
		'$selector clears AAA for body copy at 90% opacity',
		({ bg, text }) => {
			/*
			  AAA rather than AA, and measured at the opacity the surfaces actually
			  use. The smallest text in this package is 11px - the popover body and
			  the marker's hover label - which is well under the 18.66px that would
			  let a lower floor apply. AA's 4.5 is calibrated for ordinary body
			  copy and was what the old value technically satisfied.
			*/
			expect(contrast(flatten(text, bg, 0.9), bg)).toBeGreaterThanOrEqual(7)
		}
	)

	it('does not read far worse in one theme than the other', () => {
		/*
		  The complaint that surfaced this was never "dark fails a threshold", it
		  was "dark looks wrong next to light". A theme at half its counterpart's
		  contrast reads as a mistake even while passing, so the relationship is
		  worth pinning and not only the floor.
		*/
		const ratios = blocks.map(({ bg, text }) => contrast(text, bg))
		const worst = Math.min(...ratios)
		const best = Math.max(...ratios)

		expect(worst / best).toBeGreaterThan(0.6)
	})
})
