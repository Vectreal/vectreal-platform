import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Every error boundary reports what it catches, and this is what keeps it true.
 *
 * The failure this exists to prevent has already happened once, quietly, over
 * many pull requests. The product had exactly one `captureException`, in root's
 * `ErrorBoundary`. Twenty-eight route modules then declared boundaries of their
 * own, each rendering a friendly fallback and dropping the error - and because a
 * route boundary catches *before* the root one, every one of them made the
 * product quieter rather than safer. More resilient-looking UI, less signal, no
 * test that could notice.
 *
 * So this file enumerates the files that declare an `ErrorBoundary` and asserts
 * each resolves to a component that goes through `useErrorReport`. Most of them
 * declare nothing themselves - they re-export a shared boundary, sometimes
 * through the `components/errors` barrel - so the check follows the re-export
 * chain to the module that actually defines the component. A boundary that
 * renders a fallback and reports nothing fails here on the commit that adds it.
 *
 * The ratchet has no exception list on purpose. There is no defensible reason
 * for a boundary not to report, and an allowlist is where that reason would go.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const APP_DIR = join(REPO_ROOT, 'apps/vectreal-platform/app')

/** The single client reporting path. Import path fragment, not a file path. */
const REPORTER = 'lib/observability/use-error-report'

/**
 * The hook has to be imported *and* called.
 *
 * Checking only the import is how the first draft of this file passed a
 * mutation that deleted the call and left the import behind - which is a state
 * lint would eventually catch as an unused binding, but the whole point of this
 * file is not to be relying on that.
 */
function reportsThroughTheOnePath(source: string): boolean {
	return source.includes(REPORTER) && /useErrorReport\s*\(/.test(source)
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx']

function collectSources(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) return collectSources(full)
		if (/\.spec\.tsx?$/.test(entry)) return []
		return SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext)) ? [full] : []
	})
}

const SOURCES = collectSources(APP_DIR)

const read = (file: string) => readFileSync(file, 'utf8')
const show = (file: string) => relative(REPO_ROOT, file)

/** `export function X` / `export const X`, which is where a chain terminates. */
function declares(source: string, name: string): boolean {
	return new RegExp(
		`export\\s+(?:async\\s+)?function\\s+${name}\\b|export\\s+const\\s+${name}\\b`
	).test(source)
}

type Binding = { local: string; exported: string; from?: string }

/**
 * Every `export { ... }` clause, flattened to one entry per name.
 *
 * Parsed as a clause and then split, rather than matched name-by-name with one
 * regex, because the interesting forms differ only in punctuation:
 * `export { A as ErrorBoundary } from './x'`, the same without `from`, and a
 * multi-name clause where `ErrorBoundary` is not the first entry.
 */
function exportBindings(source: string): Binding[] {
	const bindings: Binding[] = []
	const clause = /export\s*\{([^}]*)\}\s*(?:from\s*['"]([^'"]+)['"])?/g
	let match: null | RegExpExecArray

	while ((match = clause.exec(source)) !== null) {
		const from = match[2]
		for (const entry of match[1].split(',')) {
			const [local, exported] = entry.trim().split(/\s+as\s+/)
			if (!local) continue
			bindings.push({
				local: local.trim(),
				exported: (exported ?? local).trim(),
				...(from ? { from } : {})
			})
		}
	}

	return bindings
}

/** Where a locally-bound name was imported from, and under what name there. */
function importOf(
	source: string,
	local: string
): { from: string; name: string } | null {
	const clause = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
	let match: null | RegExpExecArray

	while ((match = clause.exec(source)) !== null) {
		for (const entry of match[1].split(',')) {
			const [imported, alias] = entry.trim().split(/\s+as\s+/)
			if (!imported) continue
			if ((alias ?? imported).trim() === local) {
				return { from: match[2], name: imported.trim() }
			}
		}
	}

	return null
}

/** A relative specifier as a file on disk, resolving barrels and extensions. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
	if (!specifier.startsWith('.')) return null
	const base = resolve(dirname(fromFile), specifier)
	const candidates = [
		...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`),
		...SOURCE_EXTENSIONS.map((ext) => join(base, `index${ext}`))
	]
	return candidates.find((candidate) => existsSync(candidate)) ?? null
}

/**
 * The module that actually defines a name, following re-exports.
 *
 * `seen` is not paranoia about hand-written cycles: a barrel that re-exports a
 * name it also imports is a normal shape, and without the guard the first one
 * added would hang the suite rather than fail it.
 */
function definingModule(
	file: string,
	name: string,
	seen = new Set<string>()
): string | null {
	const key = `${file}#${name}`
	if (seen.has(key)) return null
	seen.add(key)

	const source = read(file)
	if (declares(source, name)) return file

	const binding = exportBindings(source).find((b) => b.exported === name)
	if (!binding) return null

	if (binding.from) {
		const target = resolveSpecifier(file, binding.from)
		return target ? definingModule(target, binding.local, seen) : null
	}

	const imported = importOf(source, binding.local)
	if (!imported) return null
	const target = resolveSpecifier(file, imported.from)
	return target ? definingModule(target, imported.name, seen) : null
}

const BOUNDARY_FILES = SOURCES.filter((file) => {
	const source = read(file)
	return (
		declares(source, 'ErrorBoundary') ||
		exportBindings(source).some((b) => b.exported === 'ErrorBoundary')
	)
})

describe('error boundary reporting', () => {
	/*
	  The anti-tautology guard. Every assertion below is `it.each` over the list
	  collected above, so a collector that silently matched nothing - a renamed
	  directory, a regex that stopped matching - would report a green suite with
	  no tests in it. The number is a floor, not a count, so adding a boundary
	  does not require editing this file.
	*/
	it('finds the boundaries it is supposed to be checking', () => {
		expect(BOUNDARY_FILES.length).toBeGreaterThanOrEqual(25)
	})

	it.each(BOUNDARY_FILES.map(show))('%s resolves to a component', (file) => {
		const resolved = definingModule(join(REPO_ROOT, file), 'ErrorBoundary')
		expect(
			resolved,
			`${file} exports an ErrorBoundary whose definition could not be followed. Re-export it from a module that defines it, rather than through a form this cannot resolve.`
		).not.toBeNull()
	})

	it.each(BOUNDARY_FILES.map(show))('%s reports what it catches', (file) => {
		const resolved = definingModule(join(REPO_ROOT, file), 'ErrorBoundary')
		if (!resolved) return // reported by the assertion above

		expect(
			reportsThroughTheOnePath(read(resolved)),
			`${file} declares an ErrorBoundary, and ${show(resolved)} - the component it resolves to - does not call useErrorReport from ${REPORTER}. A boundary that renders a fallback without reporting makes the product quieter, not safer: it catches the error before the root boundary ever sees it.`
		).toBe(true)
	})

	/*
	  The server half of the same rule. Boundaries are a browser mechanism and
	  cover nothing that fails before a component renders - a loader that throws,
	  an action that rejects, an API route with no UI at all. `handleError` is the
	  framework's one hook for those, and exporting it replaces React Router's
	  own handler, so an entry.server that stops calling the sink does not fall
	  back to anything.
	*/
	it('routes server-side errors through the same module', () => {
		const entry = read(join(APP_DIR, 'entry.server.tsx'))
		expect(entry).toMatch(/export const handleError/)
		expect(entry).toContain('lib/observability/report-server-error.server')
	})
})
