import RenderFailure from './render-failure'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
	title: 'Viewer/Render Failure',
	component: RenderFailure,
	tags: ['autodocs'],
	parameters: {
		// Each story scopes its own viewer scheme, like the viewer root does.
		dualTheme: false,
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Drawn in place of the canvas once the browser has taken the WebGL context away and not given it back, so a visitor sees why the scene is missing instead of an empty frame. "Try again" mounts a fresh canvas.'
			}
		}
	},
	args: { onRetry: () => undefined }
} satisfies Meta<typeof RenderFailure>

export default meta

type Story = StoryObj<typeof meta>

export const Light: Story = {
	render: (args) => (
		<div className="viewer light relative h-[320px] w-[343px] bg-zinc-100">
			<RenderFailure {...args} />
		</div>
	)
}

export const Dark: Story = {
	render: (args) => (
		<div className="viewer dark relative h-[320px] w-[343px] bg-zinc-900">
			<RenderFailure {...args} />
		</div>
	)
}
