import { cn } from '@shared/utils'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from './alert'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger
} from './alert-dialog'
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
 * An overlay on its own themed surface, light above dark.
 *
 * The stories below opt out of the global dual-theme decorator and build the
 * pair themselves, because these overlays are `fixed` and portal to
 * `document.body`. Under the decorator they escaped both themed wrappers and
 * rendered in light tokens over the dark column - so the stories that existed
 * to show an overlay against both themes showed it against neither.
 *
 * Each primitive takes a portal `container`, and an element with a transform
 * becomes the containing block for `fixed` descendants, so `transform-gpu` on
 * the stage is what actually pins the overlay inside it.
 */
function ThemedStage({
	theme,
	children
}: {
	theme: 'light' | 'dark'
	children: (container: HTMLElement | null) => React.ReactNode
}) {
	const [stage, setStage] = useState<HTMLDivElement | null>(null)

	return (
		<div
			ref={setStage}
			className={cn(
				'bg-background text-foreground relative h-96 transform-gpu overflow-hidden p-8',
				theme === 'dark' && 'dark'
			)}
		>
			<p className="text-eyebrow text-muted-foreground">{theme}</p>
			{children(stage)}
		</div>
	)
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
 * over them.
 */
export const DrawerHeading: Story = {
	parameters: { dualTheme: false },
	render: () => (
		<>
			{(['light', 'dark'] as const).map((theme) => (
				<ThemedStage key={theme} theme={theme}>
					{(container) => (
						<Drawer open modal={false} direction="right" container={container}>
							<DrawerContent className="max-w-sm!">
								<DrawerHeader className="border-b">
									<DrawerTitle>Edit Project</DrawerTitle>
									<DrawerDescription>
										Update the details for Studio Showcase
									</DrawerDescription>
								</DrawerHeader>
								<div className="space-y-6 p-6">
									<section className="space-y-1">
										<h3 className="text-h4">Danger zone</h3>
										<p className="text-muted-foreground text-sm">
											A section heading on the h4 rung, above body copy. This is
											the step the scale was missing.
										</p>
									</section>
									<section className="space-y-1">
										<p className="text-muted-foreground text-eyebrow">
											Micro label
										</p>
										<p className="text-muted-foreground text-sm">
											The rung below, for labels above a value.
										</p>
									</section>
								</div>
							</DrawerContent>
						</Drawer>
					)}
				</ThemedStage>
			))}
		</>
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
	parameters: { dualTheme: false },
	render: () => (
		<>
			{(['light', 'dark'] as const).map((theme) => (
				<ThemedStage key={theme} theme={theme}>
					{(container) => (
						<Drawer open modal={false} direction="right" container={container}>
							<DrawerContent className="max-w-sm!">
								<DrawerHeader className="border-b">
									<DrawerTitle>Edit API Key</DrawerTitle>
									<DrawerDescription>
										Update the name, description, or project access
									</DrawerDescription>
								</DrawerHeader>
								<div className="flex-1 p-6">
									<p className="text-muted-foreground text-sm">
										Body copy, padded to the same edge as the header above and
										the actions below.
									</p>
								</div>
								<DrawerFooter className="border-t">
									<Button variant="outline">Cancel</Button>
									<Button>Save Changes</Button>
								</DrawerFooter>
							</DrawerContent>
						</Drawer>
					)}
				</ThemedStage>
			))}
		</>
	)
}

/*
  Closed at rest, and it has to be.

  Radix declares `AlertDialogProps extends Omit<DialogProps, 'modal'>`: an alert
  dialog is always modal, with no opt-out. Left open it pins
  `overflow: hidden; pointer-events: none` on `document.body` and hides the rest
  of the tree from assistive tech, which froze the entire Storybook page rather
  than just this story - two of them open at once, fighting over the focus trap.
  The drawers above can sit open because vaul accepts `modal={false}`.

  So this one opens on click. The theming contract it used to assert visually is
  covered by `type-scale-adherence` instead, which reads the sources and cannot
  be broken by a snapshot nobody looks at closely.
*/
function TriggeredAlert({ container }: { container: HTMLElement | null }) {
	const [open, setOpen] = useState(false)

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button variant="outline">Discard changes</Button>
			</AlertDialogTrigger>
			<AlertDialogContent container={container}>
				<AlertDialogHeader>
					<AlertDialogTitle>Discard changes?</AlertDialogTitle>
					<AlertDialogDescription>
						Your edits to this scene have not been saved.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep editing</AlertDialogCancel>
					<AlertDialogAction>Discard</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

/**
 * `AlertDialogContent`, which portals the same way `DialogContent` does and had
 * the same gap: opened from inside a `.dark` subtree it rendered light. It takes
 * a `container` now, so the two agree.
 *
 * Open the lower one to check it. If the portal escapes its theme again it comes
 * back white on the dark stage.
 */
export const AlertDialogThemed: Story = {
	parameters: { dualTheme: false },
	render: () => (
		<>
			{(['light', 'dark'] as const).map((theme) => (
				<ThemedStage key={theme} theme={theme}>
					{(container) => <TriggeredAlert container={container} />}
				</ThemedStage>
			))}
		</>
	)
}
