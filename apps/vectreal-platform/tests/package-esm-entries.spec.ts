/**
 * Every published `@vctrl/*` package is ES modules only.
 *
 * Until 2.0.0 the packages also shipped CommonJS copies, and those copies could
 * not work anywhere ESM could not: the viewer's `require()`d
 * `@react-three/postprocessing` and core's `require()`d `meshoptimizer`, both
 * ESM-only, so they ran only on a Node that loads ES modules through `require`
 * anyway. What a second format did add was a second copy of each package for
 * an app that loaded both, and two copies of three.js fail each other's
 * `instanceof` checks.
 *
 * So an export resolves through `default` alone. Bundlers, browsers and Node's
 * `import` all read it, and Node's `require()` reaches the same file on
 * Node.js 20.19, 22.12 and later. A `require` or `import` condition, or any
 * `.cjs` path, is the second format coming back.
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
	exports?: Record<string, string | Record<string, string>>
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

const published = manifests.filter((manifest) =>
	manifest.name.startsWith('@vctrl/')
)

describe('ES module entries', () => {
	it('finds the published packages', () => {
		expect(published.map((manifest) => manifest.name)).toEqual(
			expect.arrayContaining([
				'@vctrl/core',
				'@vctrl/hooks',
				'@vctrl/viewer',
				'@vctrl/embed'
			])
		)
	})

	it.each(published)('$name is an ES module package', (manifest) => {
		expect(manifest.type, manifest.name).toBe('module')
		expect(manifest.main ?? '', manifest.name).toMatch(/\.js$/)
	})

	it.each(published)(
		'$name resolves every export through default',
		(manifest) => {
			const entries = Object.entries(manifest.exports ?? {})
			expect(entries.length, manifest.name).toBeGreaterThan(0)

			for (const [subpath, entry] of entries) {
				// A bare string is an asset such as the viewer's stylesheet.
				if (typeof entry === 'string') continue

				// In this order: TypeScript takes the first condition it matches,
				// and `default` first would send it looking for a `.d.ts` beside
				// the `.js`, where the build emits none.
				expect(Object.keys(entry), `${manifest.name} ${subpath}`).toEqual([
					'types',
					'default'
				])
				expect(entry.default, `${manifest.name} ${subpath}`).toMatch(/\.js$/)
			}
		}
	)

	it.each(published)('$name names no CommonJS file', (manifest) => {
		// `.cjs` anywhere in a path, including `.cjs.js`: CommonJS under a
		// `.js` name in a `"type": "module"` package is what core and hooks
		// once shipped, and Node loads such a file as ESM.
		expect(JSON.stringify(manifest), manifest.name).not.toMatch(/\.cjs/)
	})
})
