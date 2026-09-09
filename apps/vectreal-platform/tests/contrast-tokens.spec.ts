/**
 * The semantic colour tokens, measured against the surfaces they are used on.
 *
 * Every one of these pairs was failing WCAG AA when this spec was written, and
 * none of them failed in a way anyone would notice by looking: muted text reads
 * 4.73:1 on a plain page and 3.49:1 inside a nested panel, so the same token
 * passed in a hero and failed in every card. A ratio is not something a reviewer
 * can eyeball, which is the whole argument for pinning it.
 *
 * The surfaces are computed rather than hardcoded, because `ds-raised` and
 * `ds-overlay` are `color-mix` of `--foreground` into `--background`. If the
 * ladder's percentages change, the expectations move with them.
 *
 * If one of these fails, the fix is the token, not the number. Lowering a
 * threshold here is lowering it for every reader.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const CSS = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		'../../../shared/components/src/styles/globals.css'
	),
	'utf8'
)

type Rgb = [number, number, number]

/** oklch -> OKLab -> linear sRGB -> gamma sRGB, the standard matrices. */
function oklchToRgb(L: number, C: number, hDeg: number): Rgb {
	const h = (hDeg * Math.PI) / 180
	const a = C * Math.cos(h)
	const b = C * Math.sin(h)
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
	const lin = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	]
	return lin.map((v) => {
		const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
		return Math.max(0, Math.min(255, Math.round(g * 255)))
	}) as Rgb
}

function relativeLuminance([r, g, b]: Rgb): number {
	const f = (v: number) => {
		const c = v / 255
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
	}
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: Rgb, b: Rgb): number {
	const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
		(x, y) => y - x
	)
	return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

/**
 * Reads a token out of `:root` or `.dark`.
 *
 * `.dark` is matched by slicing the file at its opening brace: the two blocks
 * declare the same names, so a whole-file regex silently returns the light
 * value for both themes and every dark assertion passes for the wrong reason.
 */
function token(name: string, theme: 'light' | 'dark'): Rgb {
	const scope = theme === 'dark' ? CSS.slice(CSS.indexOf('.dark {')) : CSS
	const match = scope.match(
		new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`)
	)
	if (!match) throw new Error(`--${name} not found for ${theme}`)
	return oklchToRgb(Number(match[1]), Number(match[2]), Number(match[3]))
}

/** A `ds-*` step: `color-mix(in oklch, --foreground N%, --background)`. */
function surface(theme: 'light' | 'dark', percent: number): Rgb {
	const fg = token('foreground', theme)
	const bg = token('background', theme)
	return fg.map((c, i) =>
		Math.round(c * percent + bg[i] * (1 - percent))
	) as Rgb
}

const AA_TEXT = 4.5
/** WCAG 1.4.11, for a focus indicator and other non-text affordances. */
const AA_NON_TEXT = 3

describe('semantic tokens clear WCAG AA on the surfaces they are used on', () => {
	describe.each(['light', 'dark'] as const)('%s', (theme) => {
		const surfaces = {
			background: token('background', theme),
			'ds-raised (4%)': surface(theme, 0.04),
			'ds-overlay (8%)': surface(theme, 0.08)
		}

		describe.each(Object.entries(surfaces))('on %s', (_label, bg) => {
			it(`muted-foreground reaches ${AA_TEXT}:1`, () => {
				expect(
					contrast(token('muted-foreground', theme), bg)
				).toBeGreaterThanOrEqual(AA_TEXT)
			})

			it(`destructive reaches ${AA_TEXT}:1`, () => {
				expect(
					contrast(token('destructive', theme), bg)
				).toBeGreaterThanOrEqual(AA_TEXT)
			})

			it(`ring reaches ${AA_NON_TEXT}:1`, () => {
				expect(contrast(token('ring', theme), bg)).toBeGreaterThanOrEqual(
					AA_NON_TEXT
				)
			})

			it(`foreground reaches ${AA_TEXT}:1`, () => {
				expect(contrast(token('foreground', theme), bg)).toBeGreaterThanOrEqual(
					AA_TEXT
				)
			})
		})
	})

	it('reads the dark block, not the light one twice', () => {
		// Guards `token()`: if the .dark slice broke, every dark case above would
		// assert the light value and pass for the wrong reason.
		expect(token('background', 'light')).not.toEqual(
			token('background', 'dark')
		)
		expect(token('muted-foreground', 'light')).not.toEqual(
			token('muted-foreground', 'dark')
		)
	})

	it('states the focus indicator once, globally, at full strength', () => {
		/*
		  The failure this replaces: `* { outline-ring/50 }` set the browser
		  outline to a half-alpha ring, and each control then suppressed it and
		  drew its own. Both were under 3:1, and links got neither.
		*/
		expect(CSS).toContain('outline: 2px solid var(--ring)')

		/*
		  Match the declaration, not the word. The comment above that rule
		  explains what it replaced and names `outline-ring/50`, so a bare
		  substring check fails on the explanation of its own fix.
		*/
		const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
		expect(declarations).not.toMatch(/@apply[^;]*outline-ring\/50/)
	})
})
