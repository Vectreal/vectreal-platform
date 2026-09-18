import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig, { vctrlSourcePlugin } from '../../vitest.shared.mts'

/**
 * `@vctrl/hooks` had no test configuration and no specs, which is why the
 * dispatch in `file-loaders.ts` - the one branch every supported format passes
 * through, and the one STL, FBX and OBJ extend - had never been executed by a
 * test. The root `vitest.config.mts` globs `packages/*​/vitest.config.ts`, so
 * this file is all it takes to join the root run.
 */
export default mergeConfig(
	sharedConfig,
	defineConfig({
		/* Source, not the last build; `vctrlSourcePlugin` says why. */
		plugins: [vctrlSourcePlugin(['core'])],
		resolve: { tsconfigPaths: true },
		test: {
			// `.ts` only: these are browser-side hooks, but the modules under test
			// are plain functions and must stay runnable without a WebGL context.
			environment: 'node',
			include: ['src/**/*.spec.ts'],
			coverage: {
				include: ['src/**/*.ts'],
				exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
				reportsDirectory: '../../coverage/packages/hooks'
			}
		}
	})
)
