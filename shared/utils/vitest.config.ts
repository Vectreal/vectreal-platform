import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [nxViteTsPaths()],
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
