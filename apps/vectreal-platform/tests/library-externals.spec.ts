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
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
	installedPackageName,
	isDeclaredDependency
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

const libraryConfigs = readdirSync(PACKAGES, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => join(PACKAGES, entry.name, 'vite.config.ts'))
	.filter((file) => existsSync(file))

describe('library builds', () => {
	it('finds the library configs', () => {
		expect(libraryConfigs.length).toBeGreaterThanOrEqual(4)
	})

	it.each(libraryConfigs)('%s registers manifestExternals', async (file) => {
		const config = (await import(file)).default

		expect(config.build?.lib, file).toBeTruthy()
		const names = [config.plugins ?? []]
			.flat(Infinity)
			.map((plugin: { name?: string } | null) => plugin?.name)
		expect(names).toContain('vctrl-manifest-externals')
	})
})
