import { LoadingSpinner } from '@shared/components/ui/loading-spinner'

import Overlay from './overlay'

import type { Meta, StoryObj } from '@storybook/react-vite'

type OverlayProps = React.ComponentProps<typeof Overlay>

const meta = {
	title: 'Viewer/Loading Overlay',
	component: Overlay,
	tags: ['autodocs'],
	parameters: {
		// These scope their own theme and mount a WebGL canvas; the shared
		// light/dark decorator would render each one twice.
		dualTheme: false,
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'UI layer that displays loading state and optional popover content on top of the canvas.'
			}
		}
	},
	args: {
		loadingState: 'loading',
		loader: <LoadingSpinner className="text-primary" />,
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
		loadingState: 'loading'
	}
}

export const Loaded: Story = {
	args: {
		loadingState: 'loaded'
	}
}

const THUMBNAIL_SRC =
	'https://images.unsplash.com/photo-1673951284213-2a3550681b7d?ixlib=rb-4.1.0&q=85&fm=jpg&cs=srgb&w=1920&h=1080&fit=crop'

export const LoadingWithThumbnail: Story = {
	args: {
		loadingThumbnail: {
			src: THUMBNAIL_SRC,
			alt: 'Preview thumbnail backdrop'
		}
	}
}

/**
 * The presentation is the consuming app's call. Turning off the blur and the
 * scrims shows the thumbnail as-is, which suits a shot already styled to match
 * the surrounding page.
 */
export const LoadingWithUnstyledThumbnail: Story = {
	args: {
		loadingThumbnail: {
			src: THUMBNAIL_SRC,
			alt: 'Preview thumbnail backdrop',
			blur: false,
			scrim: false
		}
	}
}

/** `contain` fits the whole image in rather than cropping it to fill. */
export const LoadingWithContainedThumbnail: Story = {
	args: {
		loadingThumbnail: {
			src: THUMBNAIL_SRC,
			alt: 'Preview thumbnail backdrop',
			blur: 'blur-xl',
			objectFit: 'contain'
		}
	}
}
