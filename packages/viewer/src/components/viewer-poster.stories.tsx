import { useState } from 'react'

import {
	ViewerPoster,
	type ViewerPosterProps,
	type ViewerPosterState
} from './viewer-poster'

import type { Meta, StoryObj } from '@storybook/react-vite'

const THUMBNAIL_SRC =
	'https://images.unsplash.com/photo-1673951284213-2a3550681b7d?ixlib=rb-4.1.0&q=85&fm=jpg&cs=srgb&w=1920&h=1080&fit=crop'

const meta = {
	title: 'Viewer/Poster',
	component: ViewerPoster,
	tags: ['autodocs'],
	parameters: {
		// The poster scopes its own viewer scheme, like the viewer root does.
		dualTheme: false,
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'What a scene shows before a visitor asks for it, from `@vctrl/viewer/poster`: its still image and one button. Nothing of the scene is mounted behind it. Pressed, the button turns into the loader in place; a load that fails offers the scene again.'
			}
		}
	},
	args: {
		thumbnail: THUMBNAIL_SRC,
		label: 'A sports car',
		onActivate: () => undefined
	},
	decorators: [
		(Story) => (
			<div className="h-[360px] w-[640px] max-w-full bg-zinc-200">
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof ViewerPoster>

export default meta

type Story = StoryObj<typeof meta>

export const Idle: Story = {}

export const Loading: Story = { args: { state: 'loading' } }

export const Failed: Story = { args: { state: 'failed' } }

export const Dark: Story = { args: { theme: 'dark' } }

export const German: Story = { args: { locale: 'de' } }

/** No thumbnail: the scene's stage color alone behind the button. */
export const NoThumbnail: Story = {
	args: { thumbnail: undefined, background: '#2a2d34' }
}

/** Press, load for two seconds, fail, press again, load, and start over. */
const ClickThroughPoster = (args: ViewerPosterProps) => {
	const [state, setState] = useState<ViewerPosterState>('idle')
	const [attempts, setAttempts] = useState(0)
	return (
		<ViewerPoster
			{...args}
			state={state}
			onActivate={() => {
				setState('loading')
				setAttempts((count) => count + 1)
				setTimeout(() => setState(attempts % 2 === 0 ? 'failed' : 'idle'), 2000)
			}}
		/>
	)
}

export const ClickThrough: Story = {
	render: (args) => <ClickThroughPoster {...args} />
}
