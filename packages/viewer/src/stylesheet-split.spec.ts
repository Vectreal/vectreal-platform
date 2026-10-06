/**
 * Tailwind's utilities reach the viewer from exactly one place per consumer.
 *
 * `styles.css` once imported them itself, unlayered. A host that compiles the
 * viewer from source (the platform, Storybook) already generates them in its
 * own `utilities` layer, and the viewer's copy loaded later and beat every
 * layered utility in the app: `hidden md:flex` stayed hidden, `border
 * border-b-2` drew a 1px bottom edge. Only the published bundle, whose
 * consumers cannot scan the source, ships them.
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

	it('gives the published bundle the theme and utilities', () => {
		expect(importsOf(read('package.css'))).toEqual([
			'tailwindcss/theme',
			'tailwindcss/utilities'
		])
		expect(read('package.css')).toContain('--radius-*: initial;')
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
