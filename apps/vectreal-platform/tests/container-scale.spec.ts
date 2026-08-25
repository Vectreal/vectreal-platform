/**
 * The app's own `--container-*` widths, pinned between the stylesheet that
 * declares them and the `cn()` config that has to know their names.
 *
 * The same two-file agreement `z-index-tiers.spec.ts` pins, and the same silent
 * failure: tailwind-merge validates a width as a number, a fraction or an
 * arbitrary value, so a container name is invisible to it. Both classes survive
 * the merge, the stylesheet's order decides which applies, and a caller's
 * override stops taking effect in whichever component accepts a `className`.
 *
 * That component is real. `DynamicSidebar` defaults its panel to
 * `w-detail-panel` and the publisher's tool sidebar passes `w-[21rem]`.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cn, CONTAINER_SCALE } from '@shared/utils'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const GLOBALS = join(REPO_ROOT, 'shared/components/src/styles/globals.css')

/**
 * Only the `@theme` declarations, which are the ones that generate a utility.
 * `--container-max` is a plain `:root` custom property read by hand in a
 * `max-width`, so it has no class for `cn()` to merge.
 */
function containersDeclaredInTheme() {
	const css = readFileSync(GLOBALS, 'utf8')
	const themeBlocks = [...css.matchAll(/@theme\s*\{([\s\S]*?)\n\}/g)].map(
		([, body]) => body
	)

	return themeBlocks.flatMap((body) =>
		/*
		  `[a-z0-9-]`, not `[a-z-]`: Tailwind generates `w-toolbar-2` from a
		  `--container-toolbar-2` just as readily, and a name shape this scrape
		  cannot see is a name `cn()` stays blind to while these tests pass.
		*/
		[...body.matchAll(/^\t--container-([a-z0-9-]+):/gim)].map(
			([, name]) => name
		)
	)
}

describe('container scale', () => {
	const declared = containersDeclaredInTheme()

	it('finds the container declarations in globals.css', () => {
		expect(declared.length).toBeGreaterThan(0)
	})

	it('lists exactly the containers the stylesheet generates utilities for', () => {
		expect([...CONTAINER_SCALE].sort()).toEqual([...declared].sort())
	})

	it('lets a caller override a component default', () => {
		/*
		  The regression this pins, in the direction it actually happens: the
		  component supplies the token and the consumer overrides it.
		*/
		expect(cn('w-detail-panel', 'w-[21rem]')).toBe('w-[21rem]')
		expect(cn('w-[21rem]', 'w-detail-panel')).toBe('w-detail-panel')
		expect(cn('max-w-xl', 'max-w-detail-panel')).toBe('max-w-detail-panel')
		expect(cn('min-w-detail-panel', 'min-w-0')).toBe('min-w-0')
	})

	it('leaves Tailwind’s own container names alone', () => {
		expect(cn('max-w-lg', 'max-w-xl')).toBe('max-w-xl')
		expect(cn('w-full', 'w-detail-panel')).toBe('w-detail-panel')
	})

	it('does not merge across width properties', () => {
		expect(cn('w-detail-panel', 'max-w-detail-panel')).toBe(
			'w-detail-panel max-w-detail-panel'
		)
	})
})
