import '../src/styles/globals.css'

import type { Preview } from '@storybook/react-vite'

/**
 * Every story renders twice, light above dark.
 *
 * The surface system is built on `color-mix` over `--background`, so a component
 * can look correct in one theme and be invisible in the other - `bg-card`
 * resolves to exactly `--background` in dark mode, which is how bare cards
 * disappeared there. Rendering both in a single story means one Chromatic
 * snapshot covers both, and a regression in either fails the diff.
 */
const preview: Preview = {
	parameters: {
		actions: { argTypesRegex: '^on[A-Z].*' },
		controls: { expanded: true, sort: 'requiredFirst' },
		layout: 'fullscreen',
		options: {
			storySort: {
				order: ['Foundations', 'Surfaces', 'Components']
			}
		}
	},
	decorators: [
		(Story) => (
			<div className="grid grid-cols-1 lg:grid-cols-2">
				<div className="bg-background text-foreground p-8">
					<p className="text-eyebrow text-muted-foreground mb-4">Light</p>
					<Story />
				</div>
				<div className="dark bg-background text-foreground p-8">
					<p className="text-eyebrow text-muted-foreground mb-4">Dark</p>
					<Story />
				</div>
			</div>
		)
	],
	tags: ['autodocs']
}

export default preview
