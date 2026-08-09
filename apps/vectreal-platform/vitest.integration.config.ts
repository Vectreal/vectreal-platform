import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared.mts'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [tsconfigPaths()],
		test: {
			environment: 'node',
			include: ['tests/integration/**/*.spec.{ts,tsx}'],
			setupFiles: ['tests/integration/setup.ts'],
			coverage: { enabled: false },
		},
	}),
)
