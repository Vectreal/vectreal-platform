import { createRequire } from 'node:module'
import { dirname, join } from 'path'

import type { StorybookConfig } from '@storybook/react-vite'

const require = createRequire(import.meta.url)

const config: StorybookConfig = {
	stories: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
	addons: [getAbsolutePath('@storybook/addon-docs')],
	docs: {
		docsMode: true
	},
	framework: {
		name: getAbsolutePath('@storybook/react-vite'),
		options: {
			builder: {
				viteConfigPath: 'vite.storybook.config.ts'
			}
		}
	}
}

export default config

function getAbsolutePath(value: string): string {
	return dirname(require.resolve(join(value, 'package.json')))
}
