import mdx from '@mdx-js/rollup'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		plugins: [nxViteTsPaths(), mdx()],
		test: {
			environment: 'node',
			include: ['app/**/*.spec.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
			exclude: [...configDefaults.exclude, 'tests/integration/**'],
			setupFiles: ['tests/setup.ts'],
			coverage: {
				include: ['app/**/*.{ts,tsx}'],
				exclude: [
					'app/**/*.d.ts',
					'app/**/*.stories.tsx',
					'app/**/*.spec.{ts,tsx}',
				],
				reportsDirectory: '../../coverage/apps/vectreal-platform',
			},
		},
	}),
)
