import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter
} from './info-popover'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
	title: 'Components/Info Popover',
	component: InfoPopover,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Accessible information popover with keyboard support and built-in Vectreal footer component.'
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
					<InfoPopoverVectrealFooter />
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
					<InfoPopoverVectrealFooter />
				</InfoPopoverContent>
			</InfoPopover>
		</div>
	)
}
