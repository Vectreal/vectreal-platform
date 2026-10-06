/**
 * `@vctrl/viewer`'s published stylesheet matches only inside a viewer.
 *
 * Its Tailwind utilities are unlayered, and an app that uses Tailwind emits
 * the same class names in its own `utilities` layer, which an unlayered rule
 * beats: the viewer's `.hidden` kept the app's `hidden md:flex` hidden, and
 * its theme's `:root` block rewrote the app's tokens. The build confines every
 * rule to the viewer (`scopeStylesheetRules` in `vite.library.mts`); the
 * packaging e2e checks the result in a browser.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { scopeStylesheetRules } from '../../../vite.library.mts'

const WHERE = ':where(.v, .v *)'
const scope = (css: string) => scopeStylesheetRules(css, '.v')

describe('scopeStylesheetRules', () => {
	it('confines a utility without adding specificity', () => {
		expect(scope('.border{border-width:1px}')).toBe(
			`${WHERE}.border{border-width:1px}`
		)
	})

	it('scopes every selector in a list, and rules inside at-rules', () => {
		expect(scope('@media (hover:hover){.a:hover,.b{color:red}}')).toBe(
			`@media (hover:hover){${WHERE}.a:hover,${WHERE}.b{color:red}}`
		)
	})

	it('scopes the first compound of a descendant selector', () => {
		expect(scope('.x a{color:inherit}')).toBe(`${WHERE}.x a{color:inherit}`)
	})

	it('keeps a type or universal selector first in its compound', () => {
		expect(scope('*,::backdrop,a{--x:0}')).toBe(
			`*${WHERE},${WHERE}::backdrop,a${WHERE}{--x:0}`
		)
	})

	it('moves the theme variables onto the scope', () => {
		expect(scope(':root,:host{--spacing:.25rem}')).toBe('.v{--spacing:.25rem}')
	})

	it('leaves keyframe selectors alone', () => {
		const keyframes = '@keyframes pulse{0%{opacity:0}to{opacity:1}}'
		expect(scope(keyframes)).toBe(keyframes)
	})
})

describe("the viewer's build", () => {
	const PACKAGES = join(import.meta.dirname, '..', '..', '..', 'packages')

	it('scopes the published stylesheet to the viewer root', async () => {
		const config = (await import(join(PACKAGES, 'viewer', 'vite.config.ts')))
			.default
		const names = [config.plugins ?? []]
			.flat(Infinity)
			.map((plugin: { name?: string } | null) => plugin?.name)
		expect(names).toContain('vctrl-scoped-stylesheet')

		const configSource = readFileSync(
			join(PACKAGES, 'viewer', 'vite.config.ts'),
			'utf8'
		)
		expect(configSource).toContain(
			"scopedStylesheet('style.css', '.vctrl-viewer')"
		)
	})

	it('puts the scope class on the element every viewer node sits under', () => {
		const viewer = readFileSync(
			join(PACKAGES, 'viewer', 'src', 'vectreal-viewer.tsx'),
			'utf8'
		)
		expect(viewer).toMatch(/'viewer vctrl-viewer /)
	})
})
