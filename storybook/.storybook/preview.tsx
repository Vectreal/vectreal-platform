/*
  Load order matters and is deliberate: the platform app loads the design system
  first and the viewer's stylesheet afterwards, as a lazily-imported chunk. That
  order is exactly what let the viewer overwrite the host's radius scale after
  hydration. Reproducing it here means a regression of that kind shows up as a
  diff rather than only in production.
*/
import '../../shared/components/src/styles/globals.css'
import '../../packages/viewer/src/styles.css'
import '../../packages/viewer/src/utilities.css'

import type { Preview } from '@storybook/react-vite'

/**
 * Stories render twice, light above dark.
 *
 * The surface system is built on `color-mix` over `--background`, so a component
 * can look correct in one theme and be invisible in the other - `bg-card`
 * resolves to exactly `--background` in dark mode, which is how bare cards
 * disappeared there. One snapshot covering both means a regression in either
 * fails the diff.
 *
 * Stories that manage their own theming or are expensive to mount twice - the
 * viewer's, which each spin up a WebGL canvas - opt out with
 * `parameters: { dualTheme: false }`.
 *
 * No `actions.argTypesRegex`. It gave every `on*` prop an implicit action, and
 * an implicit action does two kinds of harm: it throws when a component calls
 * it while a story renders (a ready callback fired from an effect is enough),
 * and a passed callback changes behavior, so a viewer marker selected instead
 * of opening its card. A story that wants a callback logged passes `fn()` from
 * `storybook/test` in its args.
 */
const preview: Preview = {
	parameters: {
		controls: { expanded: true, sort: 'requiredFirst' },
		layout: 'fullscreen',
		options: {
			storySort: {
				order: ['Foundations', 'Components', 'Viewer']
			}
		}
	},
	decorators: [
		(Story, context) => {
			if (context.parameters.dualTheme === false) {
				return <Story />
			}

			return (
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
		}
	],
	tags: ['autodocs']
}

export default preview
