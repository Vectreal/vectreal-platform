/**
 * Fails the build when a public route's first-load JavaScript grows past its
 * budget, or when three.js reaches it statically.
 *
 * Run by `build-ci`, right after the build, so CI enforces it on every PR.
 *
 * Twice this year heavy code reached a marketing route and no gate noticed:
 * the home page's static imports carried three.js, React Three Fiber and
 * postprocessing, and later a barrel carried every newsroom article into the
 * home page, the converters and pricing. The bundler warns about neither. Both
 * were found by hand, by walking the static imports from a route's chunk in the
 * emitted build. This is that walk, kept.
 *
 * A route's first load is its chunk plus every chunk that chunk imports
 * statically, gzipped. Dynamic imports are not followed: they load later, on a
 * condition, which is how the 3D on these pages stays off the first load.
 *
 * The budgets sit a little above the sizes measured on 24 Sep 2026, so an
 * ordinary change passes and a new dependency or a leaked module does not.
 * Raising one is a decision: say why in the PR.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.resolve(
	scriptDir,
	'../../../build/apps/vectreal-platform/client/assets'
)

/** Route id, as `app/routes.tsx` gives it, and its budget in KB gzipped. Measured: 289, 354, 363. */
const BUDGETS_KB: Record<string, number> = {
	'home-index': 300,
	'routes/layouts/convert-layout': 370,
	'routes/pricing-page/pricing-page': 380
}

/*
  Which chunk is a route's module comes from React Router's own manifest, not
  from file names: a shared chunk can carry a route's name, as a component
  chunk called pricing sits beside the pricing page's module.
*/
function routeModules() {
	const [manifest, ...more] = readdirSync(ASSETS).filter((file) =>
		/^manifest-[\w-]+\.js$/.test(file)
	)
	if (!manifest || more.length)
		throw new Error(`Expected one route manifest in ${ASSETS}`)
	const source = readFileSync(path.join(ASSETS, manifest), 'utf8')
	const json = source.slice(source.indexOf('=') + 1).replace(/;\s*$/, '')
	const { routes } = JSON.parse(json) as {
		routes: Record<string, { module: string }>
	}
	return routes
}

/** A string only three.js's renderer contains: its presence means three is on the first load. */
const THREE_MARKER = 'WebGLRenderer'

const STATIC_IMPORT = /(?:from|import)\s*"\.\/([^"]+\.js)"/g

function staticClosure(files: string[], entry: string) {
	const seen = new Set<string>()
	const todo = [entry]
	while (todo.length) {
		const file = todo.pop() as string
		if (seen.has(file) || !files.includes(file)) continue
		seen.add(file)
		const source = readFileSync(path.join(ASSETS, file), 'utf8')
		for (const [, next] of source.matchAll(STATIC_IMPORT)) todo.push(next)
	}
	return seen
}

function main() {
	const files = readdirSync(ASSETS).filter((file) => file.endsWith('.js'))
	const routes = routeModules()
	const failures: string[] = []

	for (const [route, budget] of Object.entries(BUDGETS_KB)) {
		const module = routes[route]?.module
		if (!module) {
			failures.push(`${route}: no such route; was it renamed?`)
			continue
		}
		const closure = staticClosure(files, path.basename(module))
		let bytes = 0
		let three: string | null = null
		for (const file of closure) {
			const source = readFileSync(path.join(ASSETS, file))
			bytes += gzipSync(source).length
			if (!three && source.includes(THREE_MARKER)) three = file
		}
		const kb = Math.round(bytes / 1024)
		console.log(
			`${route.padEnd(34)} ${String(kb).padStart(4)} KB gz of ${budget}, ${closure.size} chunks`
		)
		if (kb > budget)
			failures.push(`${route}: ${kb} KB gz is over its ${budget} KB budget`)
		if (three)
			failures.push(`${route}: three.js is on its first load, via ${three}`)
	}

	if (failures.length) {
		console.error(`\n${failures.join('\n')}`)
		process.exit(1)
	}
}

main()
