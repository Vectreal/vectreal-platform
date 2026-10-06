import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import postcss, { type AtRule } from 'postcss'
import type { Plugin } from 'vite'

/**
 * Whether a module specifier belongs to one of the named packages: the package
 * itself or any subpath of it.
 *
 * Exact names were the bug this exists for. The automatic JSX transform imports
 * `react/jsx-runtime`, which an `external: ['react']` list does not match, so
 * `@vctrl/viewer@1.0.0` shipped React's CommonJS runtime inlined behind a
 * `require` shim, and a consumer's `vite dev` threw on it. `three/examples/jsm/*`
 * slipped past `'three'` the same way, and core shipped its own copy of every
 * loader.
 */
export function isDeclaredDependency(
	names: readonly string[],
	id: string
): boolean {
	return names.some((name) => id === name || id.startsWith(`${name}/`))
}

function declaredDependencies(projectRoot: string): string[] {
	const manifest = JSON.parse(
		readFileSync(join(projectRoot, 'package.json'), 'utf8')
	) as {
		dependencies?: Record<string, string>
		peerDependencies?: Record<string, string>
	}
	return Object.keys({
		...manifest.dependencies,
		...manifest.peerDependencies
	})
}

/**
 * The package a resolved module path was installed as, if it was installed.
 * The last `node_modules` segment wins, which is the package itself under
 * pnpm's `.pnpm/<name>@<version>/node_modules/<name>/` layout.
 */
export function installedPackageName(moduleId: string): string | undefined {
	const path = moduleId.replaceAll('\\', '/')
	const marker = '/node_modules/'
	const at = path.lastIndexOf(marker)
	if (at === -1) return undefined

	const segments = path.slice(at + marker.length).split('/')
	return segments[0].startsWith('@')
		? `${segments[0]}/${segments[1]}`
		: segments[0]
}

/**
 * Library builds leave out exactly what the package manifest declares.
 *
 * `dependencies` and `peerDependencies` are what a consumer installs, so they
 * are what a build must import rather than inline. `devDependencies` stay
 * bundled, which is how the viewer carries `@vctrl/core` and `@shared/*`.
 *
 * The same plugin fails the build when its own rule did not hold: a module
 * installed as a declared package inside a chunk, or rolldown's `require`
 * shim, which appears when CommonJS code that requires an external gets
 * inlined. It runs on every build, including the one the release workflow
 * publishes.
 */
export function manifestExternals(projectRoot: string): Plugin {
	const names = declaredDependencies(projectRoot)

	return {
		name: 'vctrl-manifest-externals',
		config: () => ({
			build: {
				rolldownOptions: {
					external: (id: string) => isDeclaredDependency(names, id)
				}
			}
		}),
		generateBundle(_options, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') continue

				for (const moduleId of chunk.moduleIds) {
					const name = installedPackageName(moduleId)
					if (name !== undefined && names.includes(name)) {
						this.error(
							`${chunk.fileName} inlines ${moduleId}, but ${name} is declared in package.json, so it must be imported.`
						)
					}
				}

				if (/typeof require\b/.test(chunk.code)) {
					this.error(
						`${chunk.fileName} carries a require shim, which throws in a consumer's ES module environment. Some inlined CommonJS requires a package this build left external.`
					)
				}
			}
		}
	}
}

/**
 * A published stylesheet's rules, confined to the element that owns them.
 *
 * `@vctrl/viewer` ships Tailwind's utilities for consumers with no build that
 * scans its source. Outside any `@layer`, so a plain stylesheet's resets cannot
 * undo them. But an app that uses Tailwind itself emits the same class names in
 * its own `utilities` layer, and an unlayered rule beats every layered one: the
 * viewer's `.hidden` kept the app's `hidden md:flex` hidden, its `.border`
 * beat `border-b-2`, and its theme's `:root` block rewrote the app's tokens.
 *
 * Every rule gains `:where(scope, scope *)` on its subject, the compound the
 * rule styles, which adds no specificity and stops it matching anything the
 * scope does not contain. The subject rather than the first compound, so a
 * selector that starts at the document (`:root.dark .x`) still matches.
 * The theme's `:root, :host` variables move onto the scope, where they still
 * inherit to everything that reads them. Keyframe selectors are left alone.
 */
export function scopeStylesheetRules(css: string, scope: string): string {
	const where = `:where(${scope}, ${scope} *)`
	const root = postcss.parse(css)

	root.walkRules((rule) => {
		const parent = rule.parent
		if (
			parent?.type === 'atrule' &&
			/keyframes$/.test((parent as AtRule).name)
		) {
			return
		}

		if (rule.selectors.every((selector) => /^:(root|host)$/.test(selector))) {
			rule.selector = scope
			return
		}

		// On the subject, ahead of its pseudo-element: one has to stay last.
		rule.selectors = rule.selectors.map((selector) => {
			const at = pseudoElementStart(selector)
			return `${selector.slice(0, at)}${where}${selector.slice(at)}`
		})
	})

	return root.toString()
}

const LEGACY_PSEUDO_ELEMENT =
	/^:(before|after|first-line|first-letter)(?![\w-])/

/**
 * Where the subject's pseudo-element starts, or the selector's length when it
 * has none. A scan rather than a pattern, because arguments nest
 * (`::slotted(:is(.a))`) and escaped or quoted text (`.after\:x`,
 * `[title=":after"]`) only looks like a pseudo-element.
 */
function pseudoElementStart(selector: string): number {
	let depth = 0
	let start = -1

	for (let index = 0; index < selector.length; index++) {
		const char = selector[index]

		if (char === '\\') {
			index++
		} else if (char === '"' || char === "'") {
			do index = selector.indexOf(char, index + 1)
			while (index > 0 && selector[index - 1] === '\\')
			if (index === -1) break
		} else if (char === '(' || char === '[') {
			depth++
		} else if (char === ')' || char === ']') {
			depth--
		} else if (
			depth === 0 &&
			start === -1 &&
			char === ':' &&
			(selector[index + 1] === ':' ||
				LEGACY_PSEUDO_ELEMENT.test(selector.slice(index)))
		) {
			start = index
		}
	}

	return start === -1 ? selector.length : start
}

/** Applies `scopeStylesheetRules` to the named stylesheet a build emits. */
export function scopedStylesheet(fileName: string, scope: string): Plugin {
	return {
		name: 'vctrl-scoped-stylesheet',
		// After Vite has emitted the stylesheet asset.
		enforce: 'post',
		generateBundle(_options, bundle) {
			const asset = bundle[fileName]
			if (asset?.type !== 'asset') {
				this.error(`${fileName} was not emitted, so it could not be scoped.`)
			}

			asset.source = scopeStylesheetRules(String(asset.source), scope)
		}
	}
}
