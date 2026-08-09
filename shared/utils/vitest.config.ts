import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared.mts'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [],
		resolve: { tsconfigPaths: true },
		test: {
			environment: 'node',
			include: ['src/**/*.spec.ts'],
			coverage: {
				include: ['src/**/*.ts'],
				exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
				reportsDirectory: '../../coverage/shared/utils',
			},
		},
	}),
)
