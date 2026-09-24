/**
 * A published package's CommonJS entries are files Node reads as CommonJS.
 *
 * Every `@vctrl/*` package is `"type": "module"`, and Node decides a file's
 * module type by its extension, so a `.js` file is ESM whatever its name says.
 * `@vctrl/core` and `@vctrl/hooks` built their CommonJS output as `.cjs.js`:
 * `import()` of those files throws "exports is not defined", and on Node 22
 * `require()` returns an empty module with every export lost. The viewer and
 * the embed SDK were already `.cjs`.
 *
 * Read from the manifests rather than from a build, so it runs without one.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const PACKAGES = join(import.meta.dirname, '..', '..', '..', 'packages')

interface Manifest {
	name: string
	type?: string
	main?: string
	exports?: Record<string, string | { require?: string }>
}

const manifests: Manifest[] = readdirSync(PACKAGES, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => join(PACKAGES, entry.name, 'package.json'))
	.flatMap((file) => {
		try {
			return [JSON.parse(readFileSync(file, 'utf8')) as Manifest]
		} catch {
			return []
		}
	})

describe('CommonJS entries of ESM packages', () => {
	it('finds the published packages', () => {
		expect(manifests.map((manifest) => manifest.name)).toEqual(
			expect.arrayContaining([
				'@vctrl/core',
				'@vctrl/hooks',
				'@vctrl/viewer',
				'@vctrl/embed'
			])
		)
	})

	it.each(manifests.filter((manifest) => manifest.type === 'module'))(
		'$name points require at .cjs files',
		(manifest) => {
			const requires = Object.values(manifest.exports ?? {})
				.map((entry) => (typeof entry === 'object' ? entry.require : undefined))
				.filter((target): target is string => Boolean(target))

			expect(requires.length, manifest.name).toBeGreaterThan(0)
			for (const target of requires) {
				expect(target, `${manifest.name}: ${target}`).toMatch(/\.cjs$/)
			}
			/*
			  `main` may name the ESM build, as the viewer's does, which is right
			  in an ESM package; what it may not name is CommonJS in a `.js` file.
			*/
			expect(manifest.main ?? '', manifest.name).not.toMatch(/\.cjs\.js$/)
		}
	)
})
