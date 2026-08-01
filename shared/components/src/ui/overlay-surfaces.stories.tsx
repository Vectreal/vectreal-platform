import { Alert, AlertDescription, AlertTitle } from './alert'
import { Button } from './button'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList
} from './command'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The overlay primitives that #668 missed.
 *
 * `alert`, `command`, `hover-card` and `navigation-menu` were still painting
 * with `bg-card` / `bg-popover` plus a drawn border while dropdown, popover,
 * select and context-menu had already moved to the surface ladder - so two
 * menus opening over the same page did not agree on what an overlay looks like.
 *
 * Rendered on a `ds-raised` panel rather than the page: an overlay that only
 * separates from the flat background is the failure mode worth catching, and it
 * is the one the elevation ladder was built to fix.
 */
const meta = {
	title: 'Components/Overlay surfaces',
	parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Alerts: Story = {
	render: () => (
		<div className="ds-raised space-y-4 rounded-2xl p-6">
			<Alert>
				<AlertTitle>Scene published</AlertTitle>
				<AlertDescription>
					It is live at your embed URL. Borders removed; the surface separates
					on its own.
				</AlertDescription>
			</Alert>
			<Alert variant="destructive">
				<AlertTitle>Upload failed</AlertTitle>
				<AlertDescription>The file exceeded your plan limit.</AlertDescription>
			</Alert>
		</div>
	)
}

export const CommandPalette: Story = {
	render: () => (
		<div className="ds-raised rounded-2xl p-6">
			<Command className="max-w-md">
				<CommandInput placeholder="Search scenes..." />
				<CommandList>
					<CommandEmpty>No results.</CommandEmpty>
					<CommandGroup heading="Scenes">
						<CommandItem>Living room</CommandItem>
						<CommandItem>Product hero</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
		</div>
	)
}

export const HoverCardOnPanel: Story = {
	render: () => (
		<div className="ds-raised rounded-2xl p-6">
			<HoverCard open>
				<HoverCardTrigger asChild>
					<Button variant="ghost">Author</Button>
				</HoverCardTrigger>
				<HoverCardContent align="start">
					An overlay opening over a raised panel. It has to step up from the
					panel, not match it.
				</HoverCardContent>
			</HoverCard>
		</div>
	)
}
