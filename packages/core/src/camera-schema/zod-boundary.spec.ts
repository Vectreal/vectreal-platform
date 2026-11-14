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

// Every module reference a file makes: static, side-effect and dynamic
// imports, re-exports and requires. It matches only the `from '...'` /
// `import('...')` tail, so nothing earlier in a clause can hide one; a match
// inside a comment only makes the guard stricter.
const referencesIn = (source: string) =>
	[
		...source.matchAll(/\b(?:from|import|require)\s*\(?\s*['"`]([^'"`]+)['"`]/g)
	].map(([, specifier]) => specifier)

const isZod = (specifier: string) =>
	specifier === 'zod' || specifier.startsWith('zod/')

/** Whether `specifier`, written in `file`, names the schema module. */
const namesSchema = (file: string, specifier: string) => {
	if (specifier === '@vctrl/core/camera-schema') return true
	if (!specifier.startsWith('.')) return false
	const target = join(dirname(file), specifier)
		.replace(/\/$/, '')
		.replace(/(\/index)?\.[cm]?[jt]sx?$/, '')
		.replace(/\/index$/, '')
	return target === 'camera-schema'
}

describe('the zod boundary in @vctrl/core', () => {
	const files = sourceFiles(SRC).map((file) => ({
		file: relative(SRC, file),
		imports: referencesIn(readFileSync(file, 'utf8'))
	}))

	it('finds the source it guards', () => {
		const schema = files.find(({ file }) => file === SCHEMA_MODULE)
		expect(schema?.imports).toContain('zod')
	})

	it('lets only the camera-schema subpath import zod', () => {
		expect(
			files.filter(({ imports }) => imports.some(isZod)).map(({ file }) => file)
		).toEqual([SCHEMA_MODULE])
	})

	it('has no other core module import the schema module', () => {
		expect(
			files
				.filter(({ file, imports }) =>
					imports.some((specifier) => namesSchema(file, specifier))
				)
				.map(({ file }) => file)
		).toEqual([])
	})

	it.each([
		['index.ts', "export * from './camera-schema'"],
		['index.ts', "export * from './camera-schema/'"],
		['scene-camera/a.ts', "await import('../camera-schema/index.js')"],
		['scene-camera/a.ts', "import '@vctrl/core/camera-schema'"],
		['scene-camera/a.ts', 'await import(`../camera-schema`)']
	])('recognizes %s referencing the schema as %s', (file, source) => {
		expect(referencesIn(source).some((s) => namesSchema(file, s))).toBe(true)
	})
})
