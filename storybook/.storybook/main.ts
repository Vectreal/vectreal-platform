import { createRequire } from 'node:module'
import { dirname, join } from 'path'

import type { StorybookConfig } from '@storybook/react-vite'

const require = createRequire(import.meta.url)

/**
 * One Storybook for the whole workspace, publishing to a single Chromatic
 * project.
 *
 * The design system and the viewer were separate Storybooks, which meant two
 * Chromatic projects and no way to see them together - even though the platform
 * app loads both stylesheets at once, and the interaction between them has
 * already broken the radius scale once.
 *
 * Titles are namespaced: `Foundations/*` for tokens and surfaces, `Components/*`
 * for shared UI, `Viewer/*` for `@vctrl/viewer`.
 */
const config: StorybookConfig = {
	stories: [
		'../../shared/components/src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
		'../../packages/viewer/src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
		// App-level components too. The dashboard's cards and meters carry as much
		// design decision as the shared primitives do, and until now nothing
		// visual regression-tested them.
		'../../apps/vectreal-platform/app/components/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'
	],
	addons: [getAbsolutePath('@storybook/addon-docs')],
	docs: {
		docsMode: true
	},
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

function getAbsolutePath(value: string): string {
	return dirname(require.resolve(join(value, 'package.json')))
}
