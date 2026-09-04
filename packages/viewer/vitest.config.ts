import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared.mts'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [],
		resolve: { tsconfigPaths: true },
		test: {
			// `node` stays the default because almost everything here is pure
			// logic. A `.tsx` spec that needs a DOM opts in with its own
			// `// @vitest-environment jsdom` docblock.
			environment: 'node',
			/*
			  `.tsx` is admitted only for components that render no WebGL. Anything
			  drawing into the canvas still belongs in viewer-e2e, where there is a
			  real GL context - a `<Canvas>` under jsdom tests nothing.

			  `overlay.tsx` is the case this opened for: it decides whether the
			  info popover and the playback controls are on screen, and that
			  decision is plain DOM. It was made in a component with no test able to
			  reach it, which is how the popover came to paint over the loader.
			*/
			include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
			coverage: {
				// `.ts` only, deliberately. Most `.tsx` here mounts a canvas that
				// cannot be exercised without a GL context, so measuring it would
				// report a floor that no test in this project can ever lift.
				include: ['src/**/*.ts'],
				exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
				reportsDirectory: '../../coverage/packages/viewer'
			}
		}
	})
)
