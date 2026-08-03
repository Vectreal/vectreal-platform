import { useState } from 'react'

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
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from './drawer'
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

/**
 * The hover card portals to `document.body` by default, which lands it outside
 * the decorator's themed wrapper - so it rendered light in the dark column and
 * the story could not show the thing it exists to show. It is pinned to the
 * panel here via `container`.
 */
export const HoverCardOnPanel: Story = {
	render: function HoverCardStory() {
		const [panel, setPanel] = useState<HTMLDivElement | null>(null)

		return (
			<div ref={setPanel} className="ds-raised relative rounded-2xl p-6">
				<HoverCard open>
					<HoverCardTrigger asChild>
						<Button variant="ghost">Author</Button>
					</HoverCardTrigger>
					<HoverCardContent align="start" container={panel}>
						An overlay opening over a raised panel. It has to step up from the
						panel, not match it.
					</HoverCardContent>
				</HoverCard>
			</div>
		)
	}
}

/**
 * The drawer header, which had two things wrong with it at once.
 *
 * `DrawerTitle` declared no font-size, and Radix renders it as an `<h2>`, so it
 * inherited the 28px display heading from the base layer. Then the first fix
 * gave it `text-lg font-semibold` - a shadcn default that appears nowhere in the
 * type scale. It is on the h3 rung now, with the section heading beneath it on
 * the h4 rung that the scale was missing.
 *
 * Pinned open with `modal={false}` so the rungs are readable without an overlay
 * over them. `DrawerContent` is `fixed`, so it sits against the viewport edge
 * here exactly as it does in the app rather than inside a story panel.
 */
export const DrawerHeading: Story = {
	render: () => (
		<Drawer open modal={false} direction="right">
			<DrawerContent className="max-w-sm!">
				<DrawerHeader className="border-b">
					<DrawerTitle>Edit Project</DrawerTitle>
					<DrawerDescription>
						Update the details for Configurator
					</DrawerDescription>
				</DrawerHeader>
				<div className="space-y-6 p-6">
					<section className="space-y-1">
						<h3 className="text-h4">Danger zone</h3>
						<p className="text-muted-foreground text-sm">
							A section heading on the h4 rung, above body copy. This is the
							step the scale was missing.
						</p>
					</section>
					<section className="space-y-1">
						<p className="text-muted-foreground text-eyebrow">Micro label</p>
						<p className="text-muted-foreground text-sm">
							The rung below, for labels above a value.
						</p>
					</section>
				</div>
			</DrawerContent>
		</Drawer>
	)
}

/**
 * The drawer's action row, which two consumers stacked full-width and two others
 * replaced with a hand-rolled `flex justify-end` div.
 *
 * `DrawerFooter` defaulted to a permanent column - right for a bottom sheet on a
 * phone, wrong for a `max-w-lg` side drawer. It now has the same shape as
 * `DialogFooter`, so all four use the primitive and agree.
 */
export const DrawerActions: Story = {
	render: () => (
		<Drawer open modal={false} direction="right">
			<DrawerContent className="max-w-sm!">
				<DrawerHeader className="border-b">
					<DrawerTitle>Edit API Key</DrawerTitle>
					<DrawerDescription>
						Update the name, description, or project access
					</DrawerDescription>
				</DrawerHeader>
				<div className="flex-1 p-6">
					<p className="text-muted-foreground text-sm">
						Body copy, padded to the same edge as the header above and the
						actions below.
					</p>
				</div>
				<DrawerFooter className="border-t">
					<Button variant="outline">Cancel</Button>
					<Button>Save Changes</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	)
}
