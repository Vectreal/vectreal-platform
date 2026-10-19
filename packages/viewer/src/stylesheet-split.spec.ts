/**
 * The viewer's utilities come from one stylesheet, `utilities.css`, under the
 * `vv` prefix, for the published bundle and for a host that compiles the
 * viewer from source alike.
 *
 * Unprefixed, they collided with the host's own: the platform once got a
 * second, unlayered copy that beat every layered utility in the app (`hidden
 * md:flex` stayed hidden), and on npm a host's class on the viewer lost to the
 * viewer's copy of it. A `vv:` class is one no host generates.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...segments: string[]) =>
	readFileSync(join(import.meta.dirname, ...segments), 'utf8')

const importsOf = (css: string) =>
	[...css.matchAll(/^@import\s+'([^']+)'/gm)].map((match) => match[1])

describe('the viewer stylesheet split', () => {
	it('keeps Tailwind out of the source stylesheet', () => {
		// Any form of import, quoted either way or through `url()`.
		expect(read('styles.css')).not.toMatch(/@import|@theme|tailwindcss/)
	})

	it('reaches package.css only from the published entry', () => {
		const sources = readdirSync(import.meta.dirname, {
			recursive: true,
			encoding: 'utf8'
		}).filter(
			(file) =>
				/\.(ts|tsx)$/.test(file) &&
				!/\.spec\./.test(file) &&
				file !== 'index.package.ts'
		)
		expect(sources.length).toBeGreaterThan(20)
		// Static and dynamic import specifiers, not prose that names the file.
		const specifiers = (source: string) =>
			[
				...source.matchAll(
					/(?:^\s*import\s+(?:[^'"]*?\s+from\s+)?|\bimport\(\s*)['"]([^'"]+)['"]/gm
				)
			].map((match) => match[1])
		const importers = sources.filter((file) =>
			specifiers(read(file)).some((specifier) =>
				/package\.css|tailwindcss/.test(specifier)
			)
		)
		expect(importers).toEqual([])
	})

	it('generates every utility under the vv prefix, for every consumer', () => {
		const utilities = read('utilities.css')
		expect(importsOf(utilities)).toEqual([
			'tailwindcss/theme',
			'tailwindcss/utilities',
			'../../../shared/components/src/styles/theme.css'
		])
		// The prefix keeps a host's class from ever being one of the viewer's
		// rules; `inline` keeps the theme's variables off the viewer root.
		expect(utilities).toContain(
			"@import 'tailwindcss/theme' prefix(vv) theme(inline);"
		)
		expect(utilities).toContain("@import 'tailwindcss/utilities' source(none);")
		// Rules from the shared palette arrive once, from `globals.css` in the
		// app and from `package.css` in the bundle.
		expect(utilities).toContain(
			"@import '../../../shared/components/src/styles/theme.css' reference;"
		)
		expect(utilities).toContain('--radius-*: initial;')
		expect(read('index.ts')).toContain("import './utilities.css'")
	})

	it('gives the published bundle the app palette and generates nothing else', () => {
		expect(importsOf(read('package.css'))).toEqual([
			'tailwindcss/utilities',
			// The shared palette and shell recipe, so the controls the viewer
			// draws can look like the Publisher's on a page we do not own.
			'../../../shared/components/src/styles/theme.css'
		])
		expect(read('package.css')).toContain(
			"@import 'tailwindcss/utilities' source(none);"
		)
		expect(read('package.css')).not.toContain('@source')
	})

	it('builds the published entry from the source entry plus package.css', () => {
		const entry = read('index.package.ts')
		expect(entry).toContain("import './package.css'")
		expect(entry).toContain("export * from './index'")
		expect(read('index.ts')).toContain("import './styles.css'")
		expect(read('..', 'vite.config.ts')).toContain(
			"index: path.resolve(import.meta.dirname, 'src/index.package.ts')"
		)
	})
})
