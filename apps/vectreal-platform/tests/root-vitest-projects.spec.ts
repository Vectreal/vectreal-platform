import { globSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import rootConfig from '../../../vitest.config.mts'

/**
 * Every project's suite is reachable from the repo root.
 *
 * `vitest.config.mts` lists its projects as globs so a project that gains a
 * `vitest.config.ts` joins the root run by existing. That is the right default
 * and it has one failure mode: a project added somewhere the globs do not
 * reach - a new top-level directory, a nested workspace - is skipped in
 * silence, and a suite nobody runs looks exactly like a suite that passes.
 *
 * This is the same shape of bug the root config was written to fix. Before it
 * existed, `npx vitest run --root .` ran every spec under none of their
 * configs and failed 53 of 100 files for reasons that were all artifacts. The
 * command was still being quoted as a gate.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** Config files a project's unit suite is defined by. */
const PROJECT_CONFIGS = globSync('**/vitest.config.ts', {
	cwd: REPO_ROOT,
	exclude: (path) => path.includes('node_modules')
}).sort()

const PROJECT_GLOBS = rootConfig.test?.projects as string[]

const REACHED = PROJECT_GLOBS.flatMap((pattern) =>
	globSync(pattern, { cwd: REPO_ROOT })
).sort()

describe('root vitest config', () => {
	/*
	  Anti-tautology: both sides of the comparison below come from globs, so a
	  discovery that quietly matched nothing would compare [] to [] and pass.
	*/
	it('finds the projects it is supposed to be checking', () => {
		expect(PROJECT_CONFIGS.length).toBeGreaterThanOrEqual(5)
	})

	it('reaches every project that defines a unit suite', () => {
		expect(REACHED).toEqual(PROJECT_CONFIGS)
	})

	/*
	  Integration specs need a running local Supabase and are run through
	  `vectreal-platform:test-integration`. Pulling them into the root run would
	  make the default command fail for everyone without a database, which is
	  the fastest way to get a gate ignored again.
	*/
	it('leaves the integration suite out', () => {
		expect(REACHED.some((path) => path.includes('integration'))).toBe(false)
	})
})
