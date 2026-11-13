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
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server')

/*
  Static and dynamic imports as Rollup emits them: double-quoted, one static
  import per line. A relative specifier is a chunk of this build.
*/
const IMPORTS = [
	/^import\s[^;]*?from\s*"([^"]+)";?$/gm,
	/^import\s*"([^"]+)";?$/gm,
	/\bimport\(\s*"([^"]+)"\s*\)/g
]

function serverFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name)
		if (entry.isDirectory()) return serverFiles(file)
		return file.endsWith('.js') ? [file] : []
	})
}

const specifiers = new Set()
for (const file of serverFiles(SERVER)) {
	const source = readFileSync(file, 'utf8')
	for (const pattern of IMPORTS)
		for (const [, specifier] of source.matchAll(pattern))
			if (
				!specifier.startsWith('.') &&
				!specifier.startsWith('node:') &&
				!builtinModules.includes(specifier)
			)
				specifiers.add(specifier)
}

const missing = [...specifiers].filter((specifier) => {
	try {
		import.meta.resolve(specifier)
		return false
	} catch {
		return true
	}
})

console.log(
	`server bundle: ${specifiers.size} package imports, ${missing.length} unresolved`
)
if (missing.length) {
	console.error(
		`Not in the runner's production dependencies:\n${missing.join('\n')}`
	)
	process.exit(1)
}
