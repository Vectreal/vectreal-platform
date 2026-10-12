import { useState } from 'react'

import AnimationControls from './animation-controls'
import { CHROME_PLACEMENT } from './chrome-classes'

import type { Meta, StoryObj } from '@storybook/react-vite'

/** Toggles playback the way the viewer's runtime would report it. */
const Stage = ({ theme }: { theme: 'light' | 'dark' }) => {
	const [playing, setPlaying] = useState(true)
	return (
		<div
			className={
				theme === 'dark'
					? 'viewer dark relative h-[240px] w-[360px] bg-zinc-900'
					: 'viewer light relative h-[240px] w-[360px] bg-zinc-100'
			}
		>
			<AnimationControls
				className={CHROME_PLACEMENT.animationControls}
				playing={playing}
				complete={false}
				onToggle={() => setPlaying((current) => !current)}
				onRestart={() => setPlaying(true)}
			/>
		</div>
	)
}

const meta = {
	title: 'Viewer/Animation Controls',
	component: Stage,
	tags: ['autodocs'],
	parameters: {
		// Each story scopes its own viewer theme; the shared light/dark
		// decorator would render it twice.
		dualTheme: false,
		layout: 'centered',
		docs: {
			description: {
				component:
					'The viewer’s playback bar, drawn when the scene asks for visitor controls. The Publisher draws this same component at the foot of its stage, so the editor and preview match.'
			}
		}
	},
	args: { theme: 'light' }
} satisfies Meta<typeof Stage>

export default meta

type Story = StoryObj<typeof meta>

export const Light: Story = {}

export const DarkMode: Story = { args: { theme: 'dark' } }
