/*
 * @vctrl/viewer packaging + runtime e2e orchestrator.
 *
 * Pipeline:
 *   1. Boot an ephemeral Verdaccio registry (proxies npmjs for transitive deps).
 *   2. Build and publish @vctrl/core, @vctrl/hooks, @vctrl/viewer to it.
 *   3. Scaffold a throwaway Vite + React consumer app in a tmp dir.
 *   4. npm install @vctrl/viewer from the local registry (the real tarball).
 *   5. Build the consumer (catches packaging / unresolved-import regressions).
 *   6. Serve it and run Playwright (catches render-time runtime crashes).
 *
 * Everything is torn down on exit. Nothing touches the public npm registry or
 * the developer's global npm config.
 */
import { type ChildProcess, spawn } from 'node:child_process'
import { once } from 'node:events'
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = join(here, '..', '..', '..')
const require = createRequire(import.meta.url)

// Resolve the real verdaccio entry JS (the .bin shim is a pnpm wrapper that
// node cannot spawn directly), then run it with the current node binary.
function resolveVerdaccioBin(): string {
	const pkgJson = require.resolve('verdaccio/package.json')
	const bin = require('verdaccio/package.json').bin
	const rel = typeof bin === 'string' ? bin : bin.verdaccio
	return join(dirname(pkgJson), rel)
}

// Workspace packages to publish, in dependency order. viewer bundles core/shared
// at build time, but core + hooks are published too so the registry mirrors a
// real release and any future external dependency would resolve.
const PACKAGES = [
	{ project: 'vctrl/core', dir: 'build/packages/vctrl/core' },
	{ project: 'vctrl/hooks', dir: 'build/packages/vctrl/hooks' },
	{ project: 'vctrl/viewer', dir: 'build/packages/vctrl/viewer' }
]

const cleanups: Array<() => void> = []
function onCleanup(fn: () => void) {
	cleanups.push(fn)
}
function cleanup() {
	while (cleanups.length) {
		try {
			cleanups.pop()!()
		} catch (err) {
			console.error('[e2e] cleanup error:', err)
		}
	}
}

function log(msg: string) {
	console.log(`\n[e2e] ${msg}`)
}

async function getFreePort(): Promise<number> {
	const srv = createServer()
	srv.listen(0)
	await once(srv, 'listening')
	const port = (srv.address() as { port: number }).port
	await new Promise((res) => srv.close(res))
	return port
}

function run(
	cmd: string,
	args: string[],
	opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: opts.cwd ?? workspaceRoot,
			env: { ...process.env, ...opts.env },
			stdio: 'inherit',
			shell: process.platform === 'win32'
		})
		child.on('error', reject)
		child.on('exit', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))
		)
	})
}

// The consumer simulates a standalone third-party project. It must NOT inherit
// the parent pnpm/nx process's package-manager environment (npm_config_*, PNPM_*,
// etc.) — those redirect native prebuilt resolution (e.g. sharp's @img binaries)
// and force a from-source node-gyp build that fails in the nested temp dir.
// Returning the keys as undefined makes child_process omit them.
function cleanChildEnvOverrides(): NodeJS.ProcessEnv {
	const overrides: NodeJS.ProcessEnv = {}
	for (const key of Object.keys(process.env)) {
		if (/^(npm_config_|npm_package_|npm_lifecycle|NPM_|PNPM_|NX_)/i.test(key)) {
			overrides[key] = undefined
		}
	}
	return overrides
}

async function waitForHttp(url: string, timeoutMs = 60000) {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url)
			if (res.ok || res.status === 404) return
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 500))
	}
	throw new Error(`Timed out waiting for ${url}`)
}

async function startVerdaccio(storageDir: string): Promise<string> {
	const port = await getFreePort()
	const configPath = join(here, 'registry', 'config.yaml')
	const verdaccioBin = resolveVerdaccioBin()
	// verdaccio writes its storage relative to cwd, so the dir must exist first.
	mkdirSync(storageDir, { recursive: true })

	log(`starting Verdaccio on :${port} (storage ${storageDir})`)
	const proc = spawn(
		process.execPath,
		[
			verdaccioBin,
			'--config',
			configPath,
			'--listen',
			`http://127.0.0.1:${port}`
		],
		{
			cwd: storageDir,
			env: { ...process.env, VERDACCIO_STORAGE_PATH: storageDir },
			stdio: ['ignore', 'inherit', 'inherit'],
			shell: process.platform === 'win32'
		}
	)
	onCleanup(() => proc.kill('SIGKILL'))

	const registry = `http://127.0.0.1:${port}/`
	await waitForHttp(registry)
	return registry
}

// Rewrite `workspace:*` specifiers in a built package.json to the package's own
// version, faithfully simulating what release-please's `node-workspace` plugin
// produces at release time (all @vctrl/* packages share one linked version).
// This makes the e2e publish the REAL released shape — so a stray `workspace:*`
// in a consumer-facing field (dependencies / peerDependencies) that points at an
// unpublished package surfaces as an install failure instead of being masked.
// `devDependencies` are intentionally left untouched: consumers never install
// them, and unpublished internal libs (@shared/*) legitimately live there.
function rewriteWorkspaceSpecifiers(pkgPath: string) {
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<
		string,
		unknown
	> & { version?: string }
	const linkedVersion = pkg.version ?? '0.0.0'
	let changed = false
	for (const field of [
		'dependencies',
		'peerDependencies',
		'optionalDependencies',
		// devDependencies hold bundled internal libs (@vctrl/core types, @shared/*).
		// Consumers never install them, but rewrite here too so pnpm publish from the
		// detached build dir doesn't trip on an unresolved workspace: specifier.
		'devDependencies'
	]) {
		const deps = pkg[field] as Record<string, string> | undefined
		if (!deps) continue
		for (const [name, spec] of Object.entries(deps)) {
			if (typeof spec === 'string' && spec.startsWith('workspace:')) {
				deps[name] = `^${linkedVersion}`
				changed = true
			}
		}
	}
	if (changed) writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n')
}

// Publish a built package to the local registry using a throwaway userconfig so
// the developer's ~/.npmrc is never touched.
async function publishPackage(
	project: string,
	dir: string,
	registry: string,
	npmrc: string
) {
	log(`building + publishing ${project}`)
	// copy-md depends on build, so this builds the package and stages README/LICENSE.
	// Workspace tasks and publishing run through pnpm (repo convention / pnpm-only
	// pipeline); only the consumer install below uses npm, to prove the published
	// package is installable for a plain third-party npm consumer.
	await run('pnpm', ['nx', 'run', `${project}:copy-md`])

	// Match the released manifest: rewrite `workspace:*` to the linked version
	// exactly as release-please's node-workspace plugin does on the release PR.
	rewriteWorkspaceSpecifiers(join(workspaceRoot, dir, 'package.json'))

	const token = Buffer.from('e2e:e2e').toString('base64')
	writeFileSync(
		npmrc,
		[
			`registry=${registry}`,
			`//${registry.replace(/^https?:\/\//, '')}:_authToken="${token}"`,
			`//${registry.replace(/^https?:\/\//, '')}:always-auth=true`,
			''
		].join('\n')
	)

	await run('pnpm', ['publish', '--registry', registry, '--no-git-checks'], {
		cwd: join(workspaceRoot, dir),
		env: { NPM_CONFIG_USERCONFIG: npmrc, npm_config_userconfig: npmrc }
	})
}

async function main() {
	const ci = process.argv.includes('--ci')
	const tmpRoot = mkdtempSync(join(tmpdir(), 'vctrl-viewer-e2e-'))
	onCleanup(() => rmSync(tmpRoot, { recursive: true, force: true }))

	const storageDir = join(tmpRoot, 'verdaccio-storage')
	const npmrc = join(tmpRoot, '.npmrc')
	const consumerDir = join(tmpRoot, 'consumer')

	const registry = await startVerdaccio(storageDir)

	for (const { project, dir } of PACKAGES) {
		await publishPackage(project, dir, registry, npmrc)
	}

	// Scaffold the consumer app from the template and pin it to the registry.
	log(`scaffolding consumer app in ${consumerDir}`)
	cpSync(join(here, 'consumer-template'), consumerDir, { recursive: true })
	// legacy-peer-deps mirrors how integration sites install the React Three
	// Fiber stack: drei declares optional react-native/expo peers that npm's
	// strict resolver would otherwise reject. The dependency set itself is
	// declared in the consumer package.json so resolution is deterministic.
	writeFileSync(
		join(consumerDir, '.npmrc'),
		[`registry=${registry}`, 'legacy-peer-deps=true', ''].join('\n')
	)

	log('installing @vctrl/viewer + @vctrl/hooks + peer deps from local registry')
	const consumerEnv = cleanChildEnvOverrides()
	// --ignore-scripts: the @vctrl/core -> @gltf-transform/functions -> ndarray-pixels
	// chain pulls `sharp` (a native Node binary) as a transitive dependency. A
	// browser consumer never executes it (ndarray-pixels resolves its sharp-free
	// browser export), but Verdaccio can't serve sharp's @img prebuilt binaries, so
	// its install would otherwise source-build via node-gyp and fail. Skipping
	// install scripts avoids that native build; esbuild still resolves its platform
	// binary package, so the Vite build below is unaffected.
	await run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], {
		cwd: consumerDir,
		env: consumerEnv
	})

	log('building consumer app (packaging regression gate)')
	await run('npx', ['vite', 'build'], { cwd: consumerDir, env: consumerEnv })

	const previewPort = await getFreePort()
	const baseURL = `http://127.0.0.1:${previewPort}`
	log(`serving consumer preview at ${baseURL}`)
	const preview: ChildProcess = spawn(
		'npx',
		[
			'vite',
			'preview',
			'--port',
			String(previewPort),
			'--strictPort',
			'--host',
			'127.0.0.1'
		],
		{
			cwd: consumerDir,
			env: { ...process.env, ...consumerEnv },
			stdio: 'inherit',
			shell: process.platform === 'win32'
		}
	)
	onCleanup(() => preview.kill('SIGKILL'))
	await waitForHttp(baseURL)

	log('running Playwright against the published-package render')
	// Playwright + browsers live in the workspace root install, so run it there.
	await run(
		'pnpm',
		['exec', 'playwright', 'test', '--config', join(here, '..', 'playwright.config.ts')],
		{ env: { E2E_BASE_URL: baseURL, ...(ci ? { CI: 'true' } : {}) } }
	)

	log(
		'e2e passed: @vctrl/viewer + @vctrl/hooks install, bundle, and render cleanly ✓'
	)
}

process.on('SIGINT', () => {
	cleanup()
	process.exit(130)
})

main()
	.then(() => {
		cleanup()
		process.exit(0)
	})
	.catch((err) => {
		console.error('\n[e2e] FAILED:', err.message)
		cleanup()
		process.exit(1)
	})
