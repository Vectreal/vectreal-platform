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
					'UI layer that displays loading state and optional popover content on top of the canvas. Chrome - the popover slot and the playback controls - is drawn only once the scene is ready, so it never lands on top of the loader.'
			}
		}
	},
	args: {
		loadingState: 'loading',
		loader: <LoadingSpinner className="text-primary" />,
		/*
		  Positioned like the real `InfoPopover` root, and absolutely, because the
		  backdrop below is `absolute inset-0`: a static slot paints underneath it
		  and these stories showed an empty box whatever state they were in.
		*/
		popover: (
			<div className="absolute bottom-0 left-0 m-2 rounded bg-zinc-900/80 px-2 py-1 text-xs text-white">
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

/**
 * Mid cross-fade: the model is framed and the loader is fading out over it.
 * Still no chrome - it would appear on top of the loader it is meant to
 * follow.
 */
export const Loaded: Story = {
	args: {
		loadingState: 'loaded'
	}
}

/**
 * The only state that draws chrome. Read this against `Loading`: the popover
 * slot is filled in both, and only here is it painted.
 */
export const Ready: Story = {
	args: {
		loadingState: 'ready'
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
