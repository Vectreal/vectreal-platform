import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The funnel this product exists to serve, and a ratchet that keeps it guarded.
 *
 * Publish a scene, mint a key, allow a domain, paste the snippet into a Shopify
 * storefront, see the model. If any one of those steps is broken the platform
 * has no reason to exist, and everything else in the repo is decoration. Two of
 * them have already broken in production while CI was green:
 *
 *   - the embed manifest and the asset gate disagreed about which assets an
 *     embed may fetch, so every embed 404'd (fixed in #734)
 *   - `*.myshopify.com` could not be saved at all, because the code path that
 *     implemented wildcards was unreachable (fixed 2026-08-22)
 *
 * Both were invisible to tests of either half. Both lived in a module nothing
 * imported from a spec.
 *
 * So this file names the modules that own each step and asserts they are
 * exercised by tests. `KNOWN_UNGUARDED` pins the steps that are not yet, and the
 * ratchet only turns one way: a module that gains a spec must be removed from
 * the set or this fails, and a new unguarded module on the funnel fails
 * immediately. The gaps stay visible and countable instead of being discovered
 * by a customer.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const APP = 'apps/vectreal-platform'

type FunnelStep = {
	/** What the user is doing. */
	step: string
	/** The module that owns the decision for this step, relative to the app. */
	module: string
}

const FUNNEL: FunnelStep[] = [
	{
		step: 'save a scene',
		module: 'app/lib/domain/scene/server/scene-settings.operations.server.ts'
	},
	{
		step: 'publish it, and decide what an embed may fetch',
		module: 'app/lib/domain/scene/embed-asset-policy.ts'
	},
	{
		step: 'mint an API key scoped to the project',
		module: 'app/lib/domain/auth/api-key-repository.server.ts'
	},
	{
		step: 'allow the storefront domain',
		module: 'app/lib/domain/embed/embed-domain-policy.ts'
	},
	{
		step: 'copy a snippet that carries the key',
		module: 'app/lib/domain/embed/embed-snippet.ts'
	},
	{
		step: 'authorize the third-party request',
		module: 'app/lib/domain/embed/embed-access-policy.ts'
	},
	{
		step: 'serve the embed manifest',
		module: 'app/lib/domain/scene/server/scene-manifest.server.ts'
	}
]

/*
  Steps with no test that imports them, each for the same structural reason:
  the decision is entangled with the database lookup inside a `.server.ts`, so
  nothing can import it without Postgres. The fix is the one `embed-asset-policy`
  already demonstrates - lift the decision into a pure module and leave the
  lookup behind - not a mock.

  Removing an entry is the only way this list is allowed to change.
*/
const KNOWN_UNGUARDED = new Set([
	'app/lib/domain/scene/server/scene-settings.operations.server.ts',
	'app/lib/domain/auth/api-key-repository.server.ts'
])

function collectSpecFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) return collectSpecFiles(full)
		return /\.spec\.tsx?$/.test(entry) ? [full] : []
	})
}

const SPEC_SOURCES = [
	join(REPO_ROOT, APP, 'tests'),
	join(REPO_ROOT, APP, 'app')
]
	.filter((dir) => existsSync(dir))
	.flatMap(collectSpecFiles)
	/*
	  Excluding this file is load-bearing. `FUNNEL` names every module as a
	  string, so a substring search finds all of them here and reports the whole
	  critical path as covered by the file that is supposed to be checking it.
	  The first draft did exactly that.
	*/
	.filter((file) => !file.endsWith('critical-path.spec.ts'))
	.map((file) => readFileSync(file, 'utf8'))

/**
 * A module counts as guarded when a spec actually imports it.
 *
 * Two things deliberately do not count. A filename that merely resembles the
 * module's proves nothing about what is exercised. And `vi.mock('...')` replaces
 * the module with a stub, so a spec that mocks a module is testing its caller,
 * not the module - `api-key-repository.server` is mocked by the key route spec
 * and has no test of its own.
 */
function isGuarded(modulePath: string): boolean {
	const importPath = modulePath.replace(/^app\//, '').replace(/\.tsx?$/, '')
	const escaped = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const realImport = new RegExp(
		`(?:from|import\\()\\s*['"][^'"]*${escaped}['"]`
	)
	/*
	  A spec that mocks the module still imports it, to configure the stub. The
	  key route spec does exactly that, so importing alone would have counted a
	  module with no test of its own as guarded.
	*/
	const mocked = new RegExp(`vi\\.mock\\(\\s*['"][^'"]*${escaped}['"]`)
	return SPEC_SOURCES.some(
		(source) => realImport.test(source) && !mocked.test(source)
	)
}

describe('critical path', () => {
	it.each(FUNNEL)('$step: its module exists', ({ module }) => {
		expect(
			existsSync(join(REPO_ROOT, APP, module)),
			`${module} is named as owning "the funnel" but does not exist. If it moved, update FUNNEL; the step still has to be owned by something.`
		).toBe(true)
	})

	it.each(FUNNEL.filter(({ module }) => !KNOWN_UNGUARDED.has(module)))(
		'$step: is exercised by a spec',
		({ module }) => {
			expect(
				isGuarded(module),
				`No spec imports ${module}, and it is on the critical path. Add one, or add it to KNOWN_UNGUARDED with a reason.`
			).toBe(true)
		}
	)

	/*
	  The teeth of the ratchet. Once a gap is closed the entry has to go, so the
	  list cannot quietly describe a past that is no longer true.
	*/
	it.each([...KNOWN_UNGUARDED])(
		'%s is still genuinely unguarded, or should leave KNOWN_UNGUARDED',
		(module) => {
			expect(
				isGuarded(module),
				`${module} is now imported by a spec. Remove it from KNOWN_UNGUARDED so the gap count stays honest.`
			).toBe(false)
		}
	)

	it('has no stale entries in KNOWN_UNGUARDED', () => {
		const funnelModules = new Set(FUNNEL.map(({ module }) => module))
		expect([...KNOWN_UNGUARDED].filter((m) => !funnelModules.has(m))).toEqual(
			[]
		)
	})
})
