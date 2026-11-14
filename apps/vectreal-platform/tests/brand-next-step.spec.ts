/**
 * Orange marks a page's next step, and a button says so itself.
 *
 * Until this spec existed, a `.primary-brand` scope on the public layout
 * remapped `--primary` to `--orange`, so every default button on the site was
 * orange: the nav's "Get started", "Run this code", a jump link, pricing's
 * "Talk to us", all competing with the one action the page was built for.
 * Nothing at a call site said which button was the brand action; the color
 * came from which layout the button happened to render under.
 *
 * Now `--primary` is ink everywhere, and a page opts its next step in with
 * `variant="brand"`. This spec keeps the remap from coming back: no stylesheet
 * may point `--primary` at the brand color, and the scope's name may not
 * reappear in source.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const SOURCE_DIRS = ['apps/vectreal-platform/app', 'shared/components/src']

function sourceFiles(dir: string, extensions: RegExp): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) return sourceFiles(path, extensions)
		return extensions.test(name) ? [path] : []
	})
}

const files = (extensions: RegExp) =>
	SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir), extensions))

/**
 * `--primary` and its pairs, such as `--primary-foreground`, in every way
 * source sets a custom property: a stylesheet declaration, a Tailwind theme
 * key (`--color-primary`), an arbitrary property in a class string
 * (`[--primary:var(--orange)]`), a style object key (`'--primary': …`) or
 * `setProperty('--primary', …)`.
 */
const PRIMARY_DECLARATION =
	/--(?:color-)?primary[\w-]*['"]?\s*[:,]\s*['"`]?([^;}\]"'`]+)/g
/**
 * The brand in any of its spellings in `theme.css`: the variables (`--orange`,
 * `--dark-orange`, `--orange-ink`, `--orange-rgb`), their hexes and the channel
 * triplet.
 */
const BRAND_VALUE = /orange|#fc6c18|#f54703|#c2410c|252\s+108\s+24/i

describe('the brand color stays on the actions that ask for it', () => {
	it('nothing points --primary at the brand color', () => {
		const remaps = files(/\.(css|tsx?)$/).flatMap((path) =>
			[...readFileSync(path, 'utf8').matchAll(PRIMARY_DECLARATION)]
				.filter(([, value]) => BRAND_VALUE.test(value))
				.map(([declaration]) => `${relative(ROOT, path)}: ${declaration}`)
		)
		expect(remaps).toEqual([])
	})

	it('the scope that did it is gone from source', () => {
		const mentions = files(/\.(css|tsx?)$/)
			.filter((path) => readFileSync(path, 'utf8').includes('primary-brand'))
			.map((path) => relative(ROOT, path))
		expect(mentions).toEqual([])
	})
})
