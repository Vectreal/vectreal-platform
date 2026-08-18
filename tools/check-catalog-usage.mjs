// Fails when a manifest names a version that the catalog already owns.
//
// `pnpm-workspace.yaml` holds one range per shared dependency, and every
// manifest that needs one writes `"catalog:"`. Nothing in pnpm stops someone
// writing the range out again instead, and a manifest that does still installs
// and builds — it just quietly reintroduces the second source of truth. That is
// how `@vctrl/core` came to publish `three@^0.177.0` while the repo built
// against 0.185.1.
//
// Usage: node tools/check-catalog-usage.mjs

import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.join(import.meta.dirname, '..')

const workspace = readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8')
const catalogBlock = workspace.match(/^catalog:\n((?:[ \t]+.*\n)+)/m)

if (!catalogBlock) {
	console.error('No catalog: block found in pnpm-workspace.yaml')
	process.exit(1)
}

const cataloged = new Set(
	Array.from(catalogBlock[1].matchAll(/^\s+'?([^':\s]+)'?:/gm)).map((m) => m[1])
)

const manifests = [
	'package.json',
	...globSync(['apps/*/package.json', 'packages/*/package.json', 'shared/*/package.json', 'storybook/package.json'], {
		cwd: ROOT
	})
]

const fields = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies'
]

let failed = false

for (const rel of manifests) {
	const pkg = JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'))

	for (const field of fields) {
		for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
			if (!cataloged.has(name)) continue
			if (typeof spec !== 'string') continue
			if (spec.startsWith('catalog:') || spec.startsWith('workspace:')) continue

			console.error(
				`${rel}: ${field}.${name} is "${spec}" but ${name} is in the catalog. Use "catalog:".`
			)
			failed = true
		}
	}
}

if (failed) {
	console.error(
		'\nA cataloged dependency must be referenced as "catalog:" so its version lives in one place.'
	)
	process.exit(1)
}

console.log(`OK: ${cataloged.size} cataloged dependencies, no duplicated ranges.`)
