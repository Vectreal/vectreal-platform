import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [nxViteTsPaths()],
		test: {
			environment: 'node',
			include: ['tests/integration/**/*.spec.{ts,tsx}'],
			setupFiles: ['tests/integration/setup.ts'],
			coverage: { enabled: false },
		},
	}),
)
