import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

import sharedConfig from '../../vitest.shared.mts'

export default mergeConfig(
	sharedConfig,
	defineConfig({
		resolve: { tsconfigPaths: true },
		plugins: [
			// Must mirror vite.config.ts. Without the frontmatter plugins the MDX
			// modules compile but export no `frontmatter`, so the news and docs
			// manifests resolve to zero entries and any test over them passes
			// vacuously.
			mdx({
				format: 'mdx',
				remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter]
			})
		],
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
					'app/**/*.spec.{ts,tsx}'
				],
				reportsDirectory: '../../coverage/apps/vectreal-platform'
			}
		}
	})
)
