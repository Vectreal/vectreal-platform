/**
 * Deciding whether a spec really exercises a module.
 *
 * Extracted from `critical-path.spec.ts` so the rule can be tested directly.
 * It is the gate for the whole funnel: if this says "guarded" too readily, the
 * critical path reads as covered and nobody finds out until something on it
 * breaks in production.
 *
 * It has to understand two spellings, because specs live in two places. One in
 * `tests/` names its subject by path; one sitting beside its module names it
 * `./thing`. Reading only the first is what made colocating a spec look like
 * it removed a guard.
 */

import { relative, resolve } from 'node:path'

/** Every module specifier a spec imports or mocks, split by which it was. */
export function readSpecifiers(source: string): {
	imported: Set<string>
	mocked: Set<string>
} {
	const imported = new Set<string>()
	const mocked = new Set<string>()

	for (const match of source.matchAll(
		/(?:from|import\(|vi\.mock\(\s*)\s*['"]([^'"]+)['"]/g
	)) {
		const [whole, specifier] = match
		;(whole.includes('vi.mock') ? mocked : imported).add(specifier)
	}

	return { imported, mocked }
}

/**
 * Which module a relative specifier names, as a path under the app directory.
 *
 * Resolved rather than pattern-matched, because `./embed-access-policy` says
 * nothing about which module it is until it is read against the directory the
 * spec sits in. Returns null for a bare or aliased specifier, which the caller
 * compares by suffix instead.
 */
export function resolveSpecifier(
	specifier: string,
	specDir: string,
	projectDir: string
): string | null {
	if (!specifier.startsWith('.')) return null

	/*
	  Relative to the project, not to `app/`, because that is the shape
	  `CRITICAL_FLOWS` names a module in: `app/lib/domain/embed/x.ts`.
	*/
	return relative(projectDir, resolve(specDir, specifier)).replace(
		/\.tsx?$/,
		''
	)
}

export interface SpecSource {
	dir: string
	source: string
}

/**
 * Whether any of these specs imports `modulePath` for real.
 *
 * `vi.mock` does not count: it replaces the module with a stub, so a spec that
 * mocks one is testing its caller. A spec that mocks a module still imports it
 * to configure the stub, which is why the two sets are read separately rather
 * than the mock simply being ignored.
 */
export function isModuleGuarded(
	modulePath: string,
	specs: readonly SpecSource[],
	projectDir: string
): boolean {
	const suffix = modulePath.replace(/^app\//, '').replace(/\.tsx?$/, '')
	const exact = modulePath.replace(/\.tsx?$/, '')

	return specs.some(({ dir, source }) => {
		const { imported, mocked } = readSpecifiers(source)

		const names = (specifiers: Set<string>) =>
			[...specifiers].some((specifier) => {
				const resolved = resolveSpecifier(specifier, dir, projectDir)
				return resolved !== null
					? resolved === exact
					: specifier.endsWith(suffix)
			})

		return names(imported) && !names(mocked)
	})
}
