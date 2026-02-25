import { LoadingSpinner } from '@shared/components/ui/loading-spinner'

import Overlay from './overlay'

import type { Meta, StoryObj } from '@storybook/react-vite'

type OverlayProps = React.ComponentProps<typeof Overlay>

const meta = {
	title: 'Components/Loading Overlay',
	component: Overlay,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'UI layer that displays loading state and optional popover content on top of the canvas.'
			}
		}
	},
	args: {
		hasContent: false,
		loader: <LoadingSpinner />,
		popover: (
			<div className="rounded bg-zinc-900/80 px-2 py-1 text-xs text-white">
				Overlay popover slot
			</div>
		)
	},
	render: (args: OverlayProps) => (
		<div
			className="viewer relative h-[320px] w-[480px] border border-zinc-300 bg-zinc-100 p-3"
			data-theme="light"
		>
			<div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-zinc-200" />
			<Overlay {...args} />
		</div>
	)
} satisfies Meta<typeof Overlay>

export default meta

type Story = StoryObj<typeof meta>

export const Loading: Story = {
	args: {
		hasContent: false
	}
}

export const Loaded: Story = {
	args: {
		hasContent: true
	}
}
