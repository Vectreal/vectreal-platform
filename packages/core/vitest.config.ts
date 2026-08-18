import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared.mts'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [],
		resolve: { tsconfigPaths: true },
		test: {
			environment: 'node',
			// `.ts` only, never `.tsx`. Core is isomorphic and its specs must stay
			// runnable without a DOM or a WebGL context.
			include: ['src/**/*.spec.ts'],
			coverage: {
				include: ['src/**/*.ts'],
				exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
				reportsDirectory: '../../coverage/packages/core'
			}
		}
	})
)
