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

const STYLES = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../shared/components/src/styles'
)
/** The palette, which lives in its own file so the published viewer can import it. */
const CSS = readFileSync(join(STYLES, 'theme.css'), 'utf8')
/** Everything else, including the global focus indicator. */
const GLOBALS = readFileSync(join(STYLES, 'globals.css'), 'utf8')

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
 * Reads a token out of the light block (`:root, .light`) or `.dark`, both in
 * `theme.css`, where the palette lives apart from the rest of `globals.css`.
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

/**
 * `--shell-surface` as drawn: translucent over the 3D canvas, so composited
 * on the backdrop that costs it most contrast, black under the light panel and
 * white under the dark one. The Publisher's panels and the viewer's built-in
 * controls both sit on it, over a scene nobody here controls.
 */
function shellSurface(theme: 'light' | 'dark'): Rgb {
	const scope = theme === 'dark' ? CSS.slice(CSS.indexOf('.dark {')) : CSS
	const alpha = scope.match(
		/--shell-surface:\s*oklch\([\d.]+\s+[\d.]+\s+[\d.]+\s*\/\s*([\d.]+)\)/
	)
	if (!alpha) throw new Error(`--shell-surface alpha not found for ${theme}`)
	const a = Number(alpha[1])
	const backdrop = theme === 'dark' ? 255 : 0
	return token('shell-surface', theme).map((c) =>
		Math.round(c * a + backdrop * (1 - a))
	) as Rgb
}

/**
 * The body of one utility rule in `theme.css`, so a step's percentage and its
 * foreground are read from the stylesheet rather than restated here.
 */
function rule(selector: string): string {
	const body = CSS.match(
		new RegExp(`\\n\\s*${selector.replace(/[.:]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
	)
	if (!body) throw new Error(`${selector} not found`)
	return body[1]
}

/** The `--foreground` percentage a shell-nested rule mixes over transparent. */
function nestedPercent(selector: string): number {
	const match = rule(selector).match(
		/color-mix\(in oklch, var\(--foreground\) ([\d.]+)%, transparent\)/
	)
	if (!match) throw new Error(`${selector} has no foreground tint`)
	return Number(match[1]) / 100
}

/** `--foreground` at `alpha` over `base`, the way a translucent tint composites. */
function tint(theme: 'light' | 'dark', base: Rgb, alpha: number): Rgb {
	return token('foreground', theme).map((c, i) =>
		Math.round(c * alpha + base[i] * (1 - alpha))
	) as Rgb
}

const AA_TEXT = 4.5
/** WCAG 1.4.11, for a focus indicator and other non-text affordances. */
const AA_NON_TEXT = 3

describe('the shell panel carries its text over any canvas', () => {
	describe.each(['light', 'dark'] as const)('%s', (theme) => {
		const panel = shellSurface(theme)

		it.each(['foreground', 'muted-foreground'])(
			`%s reaches ${AA_TEXT}:1`,
			(name) => {
				expect(contrast(token(name, theme), panel)).toBeGreaterThanOrEqual(
					AA_TEXT
				)
			}
		)
	})
})

describe('a nested shell block carries its own secondary text', () => {
	/*
	  `--muted-foreground` is solved for the page and the `ds-*` ladder, and on
	  the shell's tints it fell to 3.8:1 in light and 4.3:1 in dark. The nested
	  rules redefine it for their subtree, so the measurement only means
	  something if they still do.
	*/
	it('maps muted text through `@theme inline`, so a subtree can redefine it', () => {
		/*
		  In a plain `@theme`, `text-muted-foreground` would compile to
		  `var(--color-muted-foreground)`, resolved once at `:root`, and the
		  redefinitions below would reach nothing while every ratio still passed.
		*/
		const inline = CSS.match(/@theme inline \{([^}]*)\}/)
		expect(inline?.[1]).toContain(
			'--color-muted-foreground: var(--muted-foreground)'
		)
	})

	it.each(['.shell-nested', '.shell-nested-interactive'])(
		'%s points muted text at the shell rung',
		(selector) => {
			expect(rule(selector)).toContain(
				'--muted-foreground: var(--shell-muted-foreground)'
			)
		}
	)

	describe.each(['light', 'dark'] as const)('%s', (theme) => {
		const panel = shellSurface(theme)
		const nested = tint(theme, panel, nestedPercent('.shell-nested'))
		const steps = {
			nested,
			'hovered interactive': tint(
				theme,
				panel,
				nestedPercent('.shell-nested-interactive:hover')
			),
			/*
			  The deepest step that carries text today: an EmptyState tile on its
			  well. A hovered interactive block inside a nested one would be
			  deeper (about 4.3:1) and nothing builds one; nesting one needs this
			  token solved again first.
			*/
			'nested inside nested': tint(
				theme,
				nested,
				nestedPercent('.shell-nested')
			)
		}

		it.each(Object.entries(steps))(
			`shell-muted-foreground reaches ${AA_TEXT}:1 on %s`,
			(_label, bg) => {
				expect(
					contrast(token('shell-muted-foreground', theme), bg)
				).toBeGreaterThanOrEqual(AA_TEXT)
			}
		)
	})
})

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
		expect(GLOBALS).toContain('outline: 2px solid var(--ring)')

		/*
		  Match the declaration, not the word. The comment above that rule
		  explains what it replaced and names `outline-ring/50`, so a bare
		  substring check fails on the explanation of its own fix.
		*/
		const declarations = GLOBALS.replace(/\/\*[\s\S]*?\*\//g, '')
		expect(declarations).not.toMatch(/@apply[^;]*outline-ring\/50/)
	})
})
