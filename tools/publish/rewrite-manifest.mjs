// Prepares a built package manifest for `pnpm publish`.
//
// This repo is intentionally not a real pnpm workspace (it relies on
// tsconfig-path resolution), so `pnpm publish` cannot convert the
// `workspace:*` protocol on its own. This script rewrites the built
// manifest in place before publishing:
//   - strips devDependencies (irrelevant to consumers, and the source of
//     unpublishable workspace-only deps like @shared/*)
//   - rewrites `workspace:*` @vctrl/* deps to `^<published version>`,
//     read from the sibling package source so unified versioning is honored
//   - fails loudly on any other unresolved workspace: protocol
//
// Usage: node tools/publish/rewrite-manifest.mjs --dir build/packages/vctrl/<name>

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const dirIdx = args.indexOf('--dir')
if (dirIdx === -1 || !args[dirIdx + 1]) {
	console.error('Usage: rewrite-manifest.mjs --dir <buildDir>')
	process.exit(1)
}

const repoRoot = process.cwd()
const buildDir = resolve(repoRoot, args[dirIdx + 1])
const manifestPath = join(buildDir, 'package.json')
const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))

// devDependencies never belong in a published library manifest.
delete pkg.devDependencies

const resolveVctrlVersion = (name) => {
	const short = name.replace(/^@vctrl\//, '')
	const src = JSON.parse(
		readFileSync(join(repoRoot, 'packages', short, 'package.json'), 'utf8')
	)
	return `^${src.version}`
}

for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
	const deps = pkg[field]
	if (!deps) continue
	for (const [name, spec] of Object.entries(deps)) {
		if (typeof spec !== 'string' || !spec.startsWith('workspace:')) continue
		if (!name.startsWith('@vctrl/')) {
			console.error(
				`Cannot publish ${pkg.name}: unpublishable workspace dependency "${name}": "${spec}" in ${field}.`
			)
			process.exit(1)
		}
		deps[name] = resolveVctrlVersion(name)
	}
}

writeFileSync(manifestPath, JSON.stringify(pkg, null, '\t') + '\n')
console.log(
	`Prepared ${pkg.name}@${pkg.version} for publish — dependencies: ${JSON.stringify(pkg.dependencies ?? {})}`
)
