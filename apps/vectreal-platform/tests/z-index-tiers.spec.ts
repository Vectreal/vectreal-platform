/**
 * The stacking tiers, pinned between the stylesheet that defines them and the
 * `cn()` config that has to know their names.
 *
 * Two files have to agree and nothing else makes them: `globals.css` declares
 * `--z-index-*` and generates the utilities, while `styling.utils.ts` lists the
 * same names so tailwind-merge can resolve a conflict between two of them.
 * A tier added to one and not the other fails silently - the utility works, and
 * only an override stops taking effect, in whichever component happened to
 * accept a `className`.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cn, Z_INDEX_TIERS } from '@shared/utils'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const GLOBALS = join(REPO_ROOT, 'shared/components/src/styles/globals.css')

function tiersDeclaredInStylesheet() {
	const css = readFileSync(GLOBALS, 'utf8')
	return [...css.matchAll(/^\t--z-index-([a-z-]+):\s*(\d+);$/gm)].map(
		([, name, value]) => ({ name, value: Number(value) })
	)
}

describe('z-index tiers', () => {
	const declared = tiersDeclaredInStylesheet()

	it('finds the tier block in globals.css', () => {
		expect(declared.length).toBeGreaterThan(0)
	})

	it('lists exactly the tiers the stylesheet declares', () => {
		expect([...Z_INDEX_TIERS].sort()).toEqual(
			declared.map((tier) => tier.name).sort()
		)
	})

	it('lets a caller override a component default', () => {
		/*
		  The regression this pins. Without the tiers registered, both classes
		  survive and the stylesheet's alphabetical order decides, so `z-overlay`
		  beats the `z-above-nav` a caller asked for.
		*/
		expect(cn('z-overlay', 'z-above-nav')).toBe('z-above-nav')
		expect(cn('z-overlay', 'z-overlay-raised')).toBe('z-overlay-raised')
		expect(cn('z-page-chrome', 'z-nav')).toBe('z-nav')
	})

	it('resolves a tier against a bare number in both directions', () => {
		expect(cn('z-nav', 'z-10')).toBe('z-10')
		expect(cn('z-10', 'z-nav')).toBe('z-nav')
	})

	it('leaves other class groups alone', () => {
		expect(cn('translate-z-50', 'rotate-z-90')).toBe(
			'translate-z-50 rotate-z-90'
		)
		expect(cn('p-2', 'p-4')).toBe('p-4')
	})
})
