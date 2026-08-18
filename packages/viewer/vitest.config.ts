import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared.mts'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [],
		resolve: { tsconfigPaths: true },
		test: {
			environment: 'node',
			// `.ts` only, never `.tsx`. The viewer's components need a WebGL context
			// to mean anything, so anything worth unit-testing here has to be pure
			// logic in a plain module. Component behavior is covered by viewer-e2e.
			include: ['src/**/*.spec.ts'],
			coverage: {
				include: ['src/**/*.ts'],
				exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
				reportsDirectory: '../../coverage/packages/viewer'
			}
		}
	})
)
