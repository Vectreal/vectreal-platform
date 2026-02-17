import { createRequire } from 'node:module'
import { dirname, join } from 'path'

import type { StorybookConfig } from '@storybook/react-vite'

const require = createRequire(import.meta.url)

const config: StorybookConfig = {
	stories: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
	addons: [getAbsolutePath('@storybook/addon-docs')],
	framework: {
		name: getAbsolutePath('@storybook/react-vite'),
		options: {
			builder: {
				viteConfigPath: 'vite.config.ts'
			}
		}
	}
}

export default config

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs

function getAbsolutePath(value: string): string {
	return dirname(require.resolve(join(value, 'package.json')))
}
