import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isPosthogEnabled } from './posthog-enabled'

/**
 * There is one PostHog project, and a machine holding its token reported into
 * it: development servers, production builds run locally, and the Stripe
 * webhook's private client all bypassed the switch the browser honoured. The
 * client is imported fresh per test since it is a process-wide singleton.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(HERE, '../../..')
const CLIENT_MODULE = join(HERE, 'posthog-client.server.ts')

async function freshClient() {
	vi.resetModules()
	const { getPosthogClient } = await import('./posthog-client.server')
	return getPosthogClient()
}

function stubConfigured(flag: string | undefined) {
	vi.stubEnv('VITE_PUBLIC_POSTHOG_TOKEN', 'phc_test')
	vi.stubEnv('VITE_PUBLIC_POSTHOG_HOST', 'https://posthog.invalid')
	vi.stubEnv('VITE_PUBLIC_POSTHOG_ENABLED', flag)
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('isPosthogEnabled', () => {
	it.each([
		// The flag decides whenever it is set, whatever the build.
		[{ dev: false, flag: 'false' }, false],
		[{ dev: true, flag: 'false' }, false],
		[{ dev: true, flag: 'true' }, true],
		[{ dev: false, flag: 'true' }, true],
		// Unset, the build decides: production reports without a flag to forget.
		[{ dev: false, flag: undefined }, true],
		[{ dev: true, flag: undefined }, false]
	])('%j -> %s', (input, expected) => {
		expect(isPosthogEnabled(input)).toBe(expected)
	})
})

describe('getPosthogClient', () => {
	it('stays off in development with a token but no switch', async () => {
		stubConfigured(undefined)
		expect(import.meta.env.DEV).toBe(true)
		expect(await freshClient()).toBeNull()
	})

	// `nx build` and `nx start` on a laptop: a production build, local env.
	it('stays off in a production build when the switch says false', async () => {
		stubConfigured('false')
		vi.stubEnv('DEV', false)
		expect(await freshClient()).toBeNull()
	})

	it('comes up in a production build with no switch at all', async () => {
		stubConfigured(undefined)
		vi.stubEnv('DEV', false)
		expect(await freshClient()).not.toBeNull()
	})

	it('comes up in development when the switch is on', async () => {
		stubConfigured('true')
		expect(await freshClient()).not.toBeNull()
	})

	/*
	  The tsx maintenance scripts reach this through `reportServerError` from
	  inside a catch block, with no Vite and so no `import.meta.env`. A throw
	  there aborted a purge partway. Run under real tsx for that reason.
	*/
	it.each([
		// A production script: no flag, so it reports, and must reach the
		// build-mode read without Vite.
		[undefined, 'client'],
		['false', 'null']
	])('can be called outside Vite, flag %s -> %s', (flag, expected) => {
		const output = execFileSync(
			join(APP_ROOT, '../../node_modules/.bin/tsx'),
			[
				'-e',
				`import('${CLIENT_MODULE}').then((m) => console.log(m.getPosthogClient() === null ? 'null' : 'client'))`
			],
			{
				encoding: 'utf8',
				env: {
					PATH: process.env.PATH,
					VITE_PUBLIC_POSTHOG_TOKEN: 'phc_test',
					VITE_PUBLIC_POSTHOG_HOST: 'https://posthog.invalid',
					...(flag === undefined ? {} : { VITE_PUBLIC_POSTHOG_ENABLED: flag })
				}
			}
		)
		expect(output.trim()).toBe(expected)
	})
})

/*
  The browser entry cannot be imported by a test: it hydrates the document on
  load. So its call is pinned by source, both fields read by name (passing
  `import.meta.env` whole makes Vite inline every VITE_ variable).
*/
describe('the browser entry', () => {
	it('initializes PostHog only behind the shared switch', () => {
		const source = readFileSync(join(APP_ROOT, 'app/entry.client.tsx'), 'utf8')
		expect(source).toMatch(
			/if \(\s*isPosthogEnabled\(\{\s*dev: import\.meta\.env\.DEV,\s*flag: import\.meta\.env\.VITE_PUBLIC_POSTHOG_ENABLED\s*\}\)\s*\)\s*\{\s*posthog\.init\(/
		)
	})
})

/**
 * Whether a module can load `posthog-node` at runtime.
 *
 * Inverted on purpose: every `'posthog-node'` string in the code counts, and
 * only the module path of a declaration that is provably type-only is
 * excused. Listing the ways to load a module instead - value imports,
 * re-exports, `import()`, `require`, `createRequire` - always missed one, and
 * every regex version was fooled by a comment. Comments are not nodes here.
 */
function loadsPosthogNode(file: string, source: string): boolean {
	const allTypes = (elements: readonly { isTypeOnly: boolean }[]) =>
		elements.length > 0 && elements.every((element) => element.isTypeOnly)

	const typeOnlyDeclaration = (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const clause = node.importClause
			if (!clause) return false
			if (clause.isTypeOnly) return true
			return (
				clause.name === undefined &&
				clause.namedBindings !== undefined &&
				ts.isNamedImports(clause.namedBindings) &&
				allTypes(clause.namedBindings.elements)
			)
		}
		if (ts.isExportDeclaration(node)) {
			if (node.isTypeOnly) return true
			return (
				node.exportClause !== undefined &&
				ts.isNamedExports(node.exportClause) &&
				allTypes(node.exportClause.elements)
			)
		}
		return false
	}

	let loads = false
	const visit = (node: ts.Node) => {
		if (
			ts.isStringLiteralLike(node) &&
			node.text === 'posthog-node' &&
			!typeOnlyDeclaration(node.parent)
		) {
			loads = true
		}
		ts.forEachChild(node, visit)
	}

	visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true))
	return loads
}

/*
  The switch only holds if every server-side client comes through
  `getPosthogClient`. The Stripe webhook processor built one of its own from the
  token, which bypassed it, and then shut it down after each event - which on
  the shared client would stop it for every other caller.
*/
describe('the shared client', () => {
	function sources(dir: string): string[] {
		return readdirSync(dir).flatMap((entry) => {
			const full = join(dir, entry)
			if (statSync(full).isDirectory()) return sources(full)
			return /\.(m?[jt]sx?)$/.test(entry) && !/\.spec\./.test(entry)
				? [full]
				: []
		})
	}

	const files = [
		...sources(join(APP_ROOT, 'app')),
		...sources(join(APP_ROOT, 'scripts')),
		join(APP_ROOT, 'server.mjs')
	].map((file) => ({ file, source: readFileSync(file, 'utf8') }))

	const others = files.filter(({ file }) => file !== CLIENT_MODULE)
	const show = (file: string) => relative(APP_ROOT, file)

	it('is the only module that loads posthog-node as a value', () => {
		expect(
			others
				.filter(({ file, source }) => loadsPosthogNode(file, source))
				.map(({ file }) => show(file))
		).toEqual([])
	})

	it('is never shut down by a caller', () => {
		expect(
			others
				.filter(
					({ source }) =>
						source.includes('getPosthogClient') && /\.shutdown\(/.test(source)
				)
				.map(({ file }) => show(file))
		).toEqual([])
	})

	it('sends webhook events immediately, since nothing drains it on SIGTERM', () => {
		const webhook = files.find(({ file }) =>
			file.endsWith('stripe-webhook-processor.server.ts')
		)
		expect(webhook?.source).toMatch(/void client\.captureImmediate\(/)
	})
})
