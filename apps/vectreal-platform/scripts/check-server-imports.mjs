/**
 * Fails the image build when the server bundle imports a package the runner
 * stage does not carry.
 *
 * Run by the Dockerfile's runner stage, mounted beside the server build so
 * resolution walks the same directories the server's own imports do. The
 * runner ships production dependencies only, so a package the server reaches
 * but a manifest declares only for development would otherwise surface on the
 * first request that loads its chunk, possibly long after the deploy turned
 * green. Plain JavaScript because the runner has no TypeScript tooling.
 *
 * Resolution only: nothing is imported, so no module's top-level code runs.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server')

/*
  Imports as the bundler emits them: double-quoted, one static import or
  re-export per line. A relative specifier is a chunk of this build. Bundled
  CommonJS reaches an external package through `require`, which resolves with
  different export conditions, so those are kept apart.
*/
const IMPORTS = [
	/^import\s[^;]*?from\s*"([^"]+)";?$/gm,
	/^import\s*"([^"]+)";?$/gm,
	/^export\s[^;]*?from\s*"([^"]+)";?$/gm,
	/\bimport\(\s*"([^"]+)"\s*\)/g
]
const REQUIRES = /\b(?:__)?require\(\s*"([^"]+)"\s*\)/g

function serverFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name)
		if (entry.isDirectory()) return serverFiles(file)
		return /\.[cm]?js$/.test(file) ? [file] : []
	})
}

const isPackage = (specifier) =>
	!specifier.startsWith('.') &&
	!specifier.startsWith('node:') &&
	!builtinModules.includes(specifier)

const imports = new Set()
const requires = new Set()
for (const file of serverFiles(SERVER)) {
	const source = readFileSync(file, 'utf8')
	for (const pattern of IMPORTS)
		for (const [, specifier] of source.matchAll(pattern))
			if (isPackage(specifier)) imports.add(specifier)
	for (const [, specifier] of source.matchAll(REQUIRES))
		if (isPackage(specifier)) requires.add(specifier)
}

const unresolved = (specifiers, resolve) =>
	[...specifiers].filter((specifier) => {
		try {
			resolve(specifier)
			return false
		} catch {
			return true
		}
	})
const require = createRequire(import.meta.url)
const missing = [
	...unresolved(imports, (specifier) => import.meta.resolve(specifier)),
	...unresolved(requires, (specifier) => require.resolve(specifier))
]

console.log(
	`server bundle: ${imports.size} package imports, ${requires.size} requires, ${missing.length} unresolved`
)
if (missing.length) {
	console.error(
		`Not in the runner's production dependencies:\n${missing.join('\n')}\n` +
			'The match is textual, so an import in a code sample the bundle carries as text (a docs page, say) counts too.'
	)
	process.exit(1)
}
