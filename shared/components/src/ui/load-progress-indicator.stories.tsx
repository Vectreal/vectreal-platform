import { LoadProgressIndicator } from './load-progress-indicator'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The one progress pattern for a model on its way, shown at each phase. The
 * ring is determinate only while a download's size is known; every other
 * phase turns it indeterminate (Chromatic freezes the turn at its first frame).
 */
const meta = {
	title: 'Components/LoadProgressIndicator',
	component: LoadProgressIndicator,
	args: { delayMs: 0 },
	decorators: [
		(Story) => (
			<div className="bg-muted/50 flex h-64 w-80 items-center justify-center rounded-2xl">
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof LoadProgressIndicator>

export default meta
type Story = StoryObj<typeof meta>

const MB = 1024 * 1024

export const Downloading: Story = {
	args: {
		subject: 'Rocket',
		progress: {
			phase: 'fetching',
			bytes: { loaded: 4.2 * MB, total: 13 * MB }
		}
	}
}

export const DownloadingUnknownSize: Story = {
	args: {
		progress: { phase: 'fetching', bytes: { loaded: 2.5 * MB, total: null } }
	}
}

export const Parsing: Story = {
	args: {
		progress: { phase: 'parsing', items: { loaded: 3, total: 8 } }
	}
}

export const Preparing: Story = {
	args: { progress: { phase: 'preparing' } }
}

export const NothingKnownYet: Story = {
	args: { progress: null }
}
