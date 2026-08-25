import { defineConfig } from 'vitest/config'

/**
 * The root entry point, so that `vitest` run from the repo root means the same
 * thing as the per-project targets Nx runs.
 *
 * Without this file there was no root configuration at all - `vitest.shared.mts`
 * is a base that each project's own config merges, not something Vitest loads -
 * so `npx vitest run --root .` fell back to Vitest's defaults: no `globals`, no
 * tsconfig path resolution, no MDX plugin, no setup file, and the default
 * `**\/*.{test,spec}.?(c|m)[jt]s?(x)` glob instead of any project's `include`.
 * It collected every project's specs and ran them under none of their configs,
 * so 53 of 100 spec files failed on a clean checkout with `describe is not
 * defined` and `Cannot find package '@vctrl/core'`. None of those were real,
 * which is worse than the command not working at all: it was quoted as a gate.
 *
 * Globs rather than a list, so a project that gains a `vitest.config.ts` joins
 * the root run by existing. A list would have to be edited, and the failure
 * mode of forgetting is silence - exactly the failure this file exists to fix.
 * `tests/root-vitest-projects.spec.ts` asserts nothing is missed.
 *
 * `vitest.integration.config.ts` is deliberately not matched. Integration specs
 * need a local Supabase and are run through their own Nx target.
 */
export default defineConfig({
	test: {
		projects: [
			'apps/*/vitest.config.ts',
			'packages/*/vitest.config.ts',
			'shared/*/vitest.config.ts'
		]
	}
})
