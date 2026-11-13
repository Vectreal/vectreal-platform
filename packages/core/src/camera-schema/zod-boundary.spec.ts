import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/*
  zod reaches a consumer only through the `@vctrl/core/camera-schema` subpath.
  If any other core module imported zod, or imported the schema module, every
  viewer bundle would carry zod. This reads the import specifiers rather than a
  built bundle so it runs with the unit tests.
*/
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA_MODULE = 'camera-schema/index.ts'

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return sourceFiles(path)
		return /\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)
			? [path]
			: []
	})
}

const importsOf = (file: string) =>
	[
		...readFileSync(file, 'utf8').matchAll(
			/(?:^|\n)\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g
		)
	].map(([, specifier]) => specifier)

describe('the zod boundary in @vctrl/core', () => {
	const files = sourceFiles(SRC).map((file) => ({
		file: relative(SRC, file),
		imports: importsOf(file)
	}))

	it('finds the source it guards', () => {
		const schema = files.find(({ file }) => file === SCHEMA_MODULE)
		expect(schema?.imports).toContain('zod')
	})

	it('lets only the camera-schema subpath import zod', () => {
		expect(
			files
				.filter(({ imports }) => imports.includes('zod'))
				.map(({ file }) => file)
		).toEqual([SCHEMA_MODULE])
	})

	it('has no other core module import the schema module', () => {
		const resolvesToSchema = (file: string, specifier: string) =>
			specifier.startsWith('.') &&
			['camera-schema', 'camera-schema/index'].includes(
				join(dirname(file), specifier)
			)
		expect(
			files
				.filter(({ file, imports }) =>
					imports.some((specifier) => resolvesToSchema(file, specifier))
				)
				.map(({ file }) => file)
		).toEqual([])
	})
})
