import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isModuleGuarded } from './critical-path-guard'
import { CRITICAL_FLOWS } from '../app/lib/observability/critical-flows'

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
 *
 * The list itself moved to `app/lib/observability/critical-flows.ts` when error
 * reporting started tagging exceptions with the step they happened on. It is
 * the same array, read by both: the set of flows that is test-guarded and the
 * set that is observable have to be one set, and two copies of a list are how
 * they stop being.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const APP = 'apps/vectreal-platform'

const FUNNEL = CRITICAL_FLOWS

/*
  Steps with no test that imports them, each for the same structural reason:
  the decision is entangled with the database lookup inside a `.server.ts`, so
  nothing can import it without Postgres. There are two ways out, and both have
  now been used: lift the decision into a pure module and leave the lookup
  behind, as `embed-asset-policy` did, or exercise the lookup for real from
  `tests/integration`, as `api-key-lifecycle.integration.spec.ts` did for key
  minting and rotation. A mock is neither.

  That second route out used to be worth less than it looked. `ci-quality.yaml`
  ran `lint,typecheck,test,build-ci` and never `test-integration`, and the unit
  config excludes `tests/integration/**`, so a module could leave this set on
  the strength of a spec no pull request executed. It now has an Integration
  Tests job that runs the suite against a supabase/postgres service on every
  pull request, so those specs are a gate rather than a note.

  That does not move `scene-settings.operations.server.ts`, and running the
  suite in CI was never going to: no spec imports it at all. It is 669 lines
  orchestrating quota checks, entitlements, asset upload and four tables, and
  `uploadSceneAssets` puts Supabase Storage on the path beside Postgres, which
  is why it did not fall out of the same work that closed
  `api-key-repository.server`. Closing it needs a spec that drives
  `saveSceneSettings` end to end, and storage in the job to run it against.

  Removing an entry is the only way this list is allowed to change.
*/
const KNOWN_UNGUARDED = new Set([
	'app/lib/domain/scene/server/scene-settings.operations.server.ts'
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
	/*
	  The directory is kept alongside the source, because a colocated spec names
	  its subject relatively - `./embed-access-policy` - and that string says
	  nothing about which module it is until it is resolved against the spec's
	  own location.
	*/
	.map((file) => ({
		dir: dirname(file),
		source: readFileSync(file, 'utf8')
	}))

/**
 * A module counts as guarded when a spec actually imports it.
 *
 * The rule lives in `critical-path-guard.ts` so it can be tested directly:
 * it is what decides whether the funnel reads as covered, and a matcher that
 * says yes too readily is worse than no check at all.
 */
function isGuarded(modulePath: string): boolean {
	return isModuleGuarded(modulePath, SPEC_SOURCES, join(REPO_ROOT, APP))
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
