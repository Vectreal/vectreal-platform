import { cn } from '@shared/utils'

import { VectrealEmbedBadge } from './vectreal-embed-badge'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The mark sits inside the viewer's container and takes the viewer's scheme,
 * not the page's, so both stories put the `light` or `dark` class on their own
 * `.viewer` exactly as the viewer does.
 */
const meta = {
	title: 'Embed/Vectreal Badge',
	component: VectrealEmbedBadge,
	parameters: {
		dualTheme: false,
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Shown on an embedded scene whose owning plan has not bought `embed_branding_removal`. Independent of the author’s info-popover setting.'
			}
		}
	}
} satisfies Meta<typeof VectrealEmbedBadge>

export default meta

type Story = StoryObj<typeof meta>

const surface = (theme: 'light' | 'dark') => () => (
	<div
		className={cn('viewer relative h-[240px] w-[420px] overflow-hidden', theme)}
		style={{ background: theme === 'dark' ? '#1c1c1c' : '#e9e9ec' }}
	>
		<VectrealEmbedBadge />
	</div>
)

export const OnLight: Story = { render: surface('light') }
export const OnDark: Story = { render: surface('dark') }
