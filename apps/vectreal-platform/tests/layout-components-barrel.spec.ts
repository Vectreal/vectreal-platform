/**
 * The layout-components barrel never reaches the news manifest.
 *
 * The manifest bundles every newsroom article body. While the article
 * components sat in the barrel, every page importing it shipped those bodies:
 * the home page, the converters, pricing, contact and the docs index each paid
 * 123 KB gzipped for articles they never render. The bundler keeps a barrel's
 * modules in one chunk, so importing one export from it is importing them all.
 *
 * Follows relative imports from each module the barrel exports, so a
 * component that reaches the manifest through another is caught as well.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const BARREL = resolve(
	import.meta.dirname,
	'../app/components/layout-components/index.ts'
)
const MANIFEST = resolve(import.meta.dirname, '../app/lib/news/news-manifest.ts')

function resolveModule(from: string, specifier: string): string | null {
	const base = resolve(dirname(from), specifier)
	for (const candidate of [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		join(base, 'index.ts'),
		join(base, 'index.tsx')
	]) {
		if (existsSync(candidate) && !candidate.endsWith('/')) {
			try {
				readFileSync(candidate)
				return candidate
			} catch {
				// A directory; try the next candidate.
			}
		}
	}
	return null
}

/** Type-only imports are erased at build, so they cannot pull the manifest in. */
function relativeImports(file: string): string[] {
	const source = readFileSync(file, 'utf8').replace(
		/^(?:import|export) type [^;]*?from '[^']+'/gm,
		''
	)
	return [...source.matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)]
		.map(([, specifier]) => resolveModule(file, specifier))
		.filter((path): path is string => path !== null)
}

function pathToManifest(entry: string): string[] | null {
	const seen = new Set<string>()
	const walk = (file: string, trail: string[]): string[] | null => {
		if (file === MANIFEST) return trail
		if (seen.has(file)) return null
		seen.add(file)
		for (const next of relativeImports(file)) {
			const found = walk(next, [...trail, next])
			if (found) return found
		}
		return null
	}
	return walk(entry, [entry])
}

describe('the layout-components barrel', () => {
	const exported = relativeImports(BARREL)

	it('finds the modules it exports', () => {
		expect(exported.length).toBeGreaterThan(10)
	})

	it.each(exported.map((file) => [file.split('/').pop(), file]))(
		'%s does not reach the news manifest',
		(_, file) => {
			expect(pathToManifest(file as string)).toBeNull()
		}
	)
})
