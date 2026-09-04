import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger
} from './info-popover'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
	title: 'Viewer/Info Popover',
	component: InfoPopover,
	tags: ['autodocs'],
	parameters: {
		// These scope their own theme and mount a WebGL canvas; the shared
		// light/dark decorator would render each one twice.
		dualTheme: false,
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Accessible information popover with keyboard support. The content is supplied by the consuming app; the primitives carry no branding.'
			}
		}
	},
	render: () => (
		<div
			className="viewer relative h-[360px] w-[360px] bg-zinc-100"
			data-theme="light"
		>
			<InfoPopover>
				<InfoPopoverTrigger />
				<InfoPopoverContent>
					<InfoPopoverCloseButton />
					<InfoPopoverText>
						<p>
							Viewer controls: drag to orbit, scroll to zoom, right-click to
							pan.
						</p>
					</InfoPopoverText>
				</InfoPopoverContent>
			</InfoPopover>
		</div>
	)
} satisfies Meta<typeof InfoPopover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const DarkMode: Story = {
	render: () => (
		<div
			className="viewer relative h-[360px] w-[360px] bg-zinc-900"
			data-theme="dark"
		>
			<InfoPopover>
				<InfoPopoverTrigger />
				<InfoPopoverContent>
					<InfoPopoverCloseButton />
					<InfoPopoverText>
						<p>
							Viewer controls: drag to orbit, scroll to zoom, right-click to
							pan.
						</p>
					</InfoPopoverText>
				</InfoPopoverContent>
			</InfoPopover>
		</div>
	)
}
