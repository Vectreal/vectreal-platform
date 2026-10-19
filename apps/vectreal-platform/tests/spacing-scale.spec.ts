/**
 * The app's named `--spacing-*` values, pinned between the stylesheet that
 * declares them and the `cn()` config that has to know their names. The same
 * two-file agreement `container-scale.spec.ts` pins, for the same silent
 * failure: an unregistered name survives a merge beside the class it should
 * replace, and the stylesheet's order decides which applies.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cn, SPACING_SCALE } from '@shared/utils'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const GLOBALS = readFileSync(
	join(REPO_ROOT, 'shared/components/src/styles/globals.css'),
	'utf8'
)

/** Only `@theme` declarations generate a utility; see container-scale.spec.ts. */
const declared = [
	...GLOBALS.matchAll(/@theme(?:[ \t]+[a-z]+)*[ \t]*\{([\s\S]*?)\n\}/g)
].flatMap(([, body]) =>
	[...body.matchAll(/^\t--spacing-([a-z0-9-]+):/gim)].map(([, name]) => name)
)

describe('spacing scale', () => {
	it('lists exactly the spacing names the stylesheet generates utilities for', () => {
		expect(declared.length).toBeGreaterThan(0)
		expect([...SPACING_SCALE].sort()).toEqual([...declared].sort())
	})

	it('lets a named offset replace a numeric one, and back', () => {
		expect(cn('top-20', 'top-below-nav')).toBe('top-below-nav')
		expect(cn('top-below-nav', 'top-0')).toBe('top-0')
		expect(cn('scroll-mt-24', 'scroll-mt-below-nav')).toBe(
			'scroll-mt-below-nav'
		)
	})

	it('gives the mobile nav its own offset', () => {
		/*
		  The two navs differ by 12px; one value would sit content under the
		  desktop nav or float it below the mobile one.
		*/
		expect(GLOBALS).toMatch(
			/@media \(width < 48rem\) \{\s*:root \{\s*--spacing-below-nav: 4\.25rem;/
		)
	})
})
