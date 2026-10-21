/**
 * Library builds externalize what the package manifest declares, subpaths
 * included, and every library build registers the plugin that does it.
 *
 * The rule itself runs inside each build (`vite.library.mts`), which also
 * fails the build if a declared package ends up inlined. What a build cannot
 * check is its own absence: a config that drops the plugin builds happily with
 * nothing externalized. That half is checked here, from the configs, without a
 * build.
 */
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import {
	declarationImports,
	installedPackageName,
	isDeclaredDependency,
	unpublishableImport
} from '../../../vite.library.mts'

const PACKAGES = join(import.meta.dirname, '..', '..', '..', 'packages')

describe('isDeclaredDependency', () => {
	const declared = ['react', 'three', '@react-three/drei']

	it.each([
		'react',
		'react/jsx-runtime',
		'three/examples/jsm/loaders/GLTFLoader.js',
		'@react-three/drei',
		'@react-three/drei/core/Bounds'
	])('treats %s as external', (id) => {
		expect(isDeclaredDependency(declared, id)).toBe(true)
	})

	it.each([
		// A longer name sharing a prefix is a different package.
		'reactive',
		'three-stdlib',
		'@react-three/drei-extra',
		// Undeclared, or declared only as a devDependency: bundled.
		'clsx',
		'@vctrl/core',
		'./local-module'
	])('bundles %s', (id) => {
		expect(isDeclaredDependency(declared, id)).toBe(false)
	})
})

describe('installedPackageName', () => {
	it.each([
		[
			'/repo/node_modules/.pnpm/react@19.2.8/node_modules/react/cjs/react-jsx-runtime.production.js',
			'react'
		],
		[
			'/repo/node_modules/.pnpm/@react-three+drei@10.7.8/node_modules/@react-three/drei/core/Bounds.js',
			'@react-three/drei'
		],
		['/repo/node_modules/three/examples/jsm/loaders/GLTFLoader.js', 'three'],
		[
			'C:\\repo\\node_modules\\three\\examples\\jsm\\loaders\\GLTFLoader.js',
			'three'
		]
	])('reads %s as %s', (moduleId, name) => {
		expect(installedPackageName(moduleId)).toBe(name)
	})

	it.each(['/repo/packages/core/src/index.ts', '\0rolldown/runtime.js'])(
		'reads %s as not installed',
		(moduleId) => {
			expect(installedPackageName(moduleId)).toBeUndefined()
		}
	)
})

describe('declarationImports', () => {
	it('reads augmentations, require imports and path references', () => {
		const source = [
			"declare module '@vctrl/core' {}",
			"import three = require('three');",
			'/// <reference path="./globals.d.ts" />'
		].join('\n')

		expect(declarationImports(source)).toEqual([
			'@vctrl/core',
			'three',
			'./globals.d.ts'
		])
	})

	it('reads an import after a string that looks like a comment', () => {
		const source = [
			'export declare const ACCEPT = "image/*";',
			'url: "https://example.com"; model: import("./model").Model;',
			"/** Ends here. */ export * from './after';"
		].join('\n')

		expect(declarationImports(source)).toEqual(['./model', './after'])
	})

	it('ignores comments and string-literal types', () => {
		const source = [
			"direction: 'from' | 'to';",
			"/** Extends ThreeBoundsProps from '@react-three/drei'. */",
			"// import { x } from 'undeclared'"
		].join('\n')

		expect(declarationImports(source)).toEqual([])
	})

	it('reads static, dynamic, side-effect and type-reference imports', () => {
		const source = [
			"import { Object3D } from 'three';",
			"export * from './types';",
			'export type { Props } from "./props";',
			"onLoad: (model: import('@vctrl/core').Model) => void;",
			"import './side-effect';",
			'/// <reference types="vite/client" />'
		].join('\n')

		expect(declarationImports(source)).toEqual([
			'three',
			'./types',
			'./props',
			'@vctrl/core',
			'./side-effect',
			'vite/client'
		])
	})
})

describe('unpublishableImport', () => {
	// A published directory as a build leaves it, with a subpath's script
	// beside its folder of types, which is how core shipped.
	const outDir = mkdtempSync(join(tmpdir(), 'published-declarations-'))
	const write = (path: string) => {
		mkdirSync(dirname(join(outDir, path)), { recursive: true })
		writeFileSync(join(outDir, path), '')
	}
	write('components/scene/resolve-hotspot-markers.d.ts')
	write('components/scene/model-frame.d.ts')
	write('types/viewer-types.d.ts')
	write('model-loader/index.d.ts')
	write('model-formats/index.d.ts')
	write('model-formats.js')
	afterAll(() => rmSync(outDir, { recursive: true, force: true }))

	const file = join(outDir, 'components/scene/resolve-hotspot-markers.d.ts')
	const declared = ['three', '@vctrl/core']

	it.each([
		'./model-frame',
		'./model-frame.js',
		'../../types/viewer-types',
		'../../model-loader',
		'./model-frame.d.ts',
		'three',
		'@vctrl/core'
	])('accepts %s', (specifier) => {
		expect(
			unpublishableImport(specifier, file, outDir, declared)
		).toBeUndefined()
	})

	it.each([
		// What the viewer published while tsconfig paths became relative paths.
		['../../../../core/src/index.ts', 'leaves the published directory'],
		['../../../sibling', 'leaves the published directory'],
		// A source file the declaration build never emitted.
		['./model-context', 'reaches no declaration file'],
		// The script is found before the folder, and has no types.
		['../../model-formats', 'reaches no declaration file'],
		['@shared/utils', 'is not declared'],
		['@vctrl/viewer', 'is not declared']
	])('rejects %s', (specifier, reason) => {
		expect(unpublishableImport(specifier, file, outDir, declared)).toContain(
			reason
		)
	})
})

const packageConfigs = readdirSync(PACKAGES, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => join(PACKAGES, entry.name, 'vite.config.ts'))
	.filter((file) => existsSync(file))

// The CLI builds an executable (`build.ssr`), not a library: it externalizes
// the same way, but publishes no types.
const EXECUTABLE_CONFIGS = [join(PACKAGES, 'cli', 'vite.config.ts')]
const libraryConfigs = packageConfigs.filter(
	(file) => !EXECUTABLE_CONFIGS.includes(file)
)

const pluginNames = async (file: string) => {
	const config = (await import(file)).default
	return {
		config,
		names: [config.plugins ?? []]
			.flat(Infinity)
			.map((plugin: { name?: string } | null) => plugin?.name)
	}
}

describe('package builds', () => {
	it('finds the library and executable configs', () => {
		expect(libraryConfigs.length).toBeGreaterThanOrEqual(5)
		expect(packageConfigs).toEqual(expect.arrayContaining(EXECUTABLE_CONFIGS))
	})

	it.each(packageConfigs)('%s registers manifestExternals', async (file) => {
		const { config, names } = await pluginNames(file)

		const kind = EXECUTABLE_CONFIGS.includes(file) ? 'ssr' : 'lib'
		expect(config.build?.[kind], file).toBeTruthy()
		expect(names).toContain('vctrl-manifest-externals')
	})

	it.each(libraryConfigs)(
		'%s emits its types through publishedDeclarations',
		async (file) => {
			const { names } = await pluginNames(file)

			expect(names).toContain('vctrl-published-declarations')
		}
	)
})
