import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup
} from './resizable'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * `ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle` wrap
 * react-resizable-panels. v4 renamed the underlying primitives and swapped the
 * `data-panel-group-direction` attribute the vertical styling keyed off, so the
 * handle's orientation-dependent rules are the part worth watching here.
 */
const meta = {
	title: 'Components/Resizable',
	component: ResizablePanelGroup,
	tags: ['autodocs']
} satisfies Meta<typeof ResizablePanelGroup>

export default meta
type Story = StoryObj<typeof meta>

// v4 reinterprets `defaultSize`: a number is now pixels, and a unit-less
// string is a percentage. `defaultSize={50}` used to mean half the group and
// now means 50px, so these stories pass strings.
const Pane = ({ label }: { label: string }) => (
	<div className="flex h-full items-center justify-center p-6">
		<span className="text-muted-foreground text-sm font-medium">{label}</span>
	</div>
)

/** Horizontal split - the default orientation. */
export const Horizontal: Story = {
	render: () => (
		<ResizablePanelGroup
			orientation="horizontal"
			className="ds-raised max-w-2xl rounded-lg border"
			style={{ height: 220 }}
		>
			<ResizablePanel id="left" defaultSize="40">
				<Pane label="Left" />
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel id="right">
				<Pane label="Right" />
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}

/**
 * Vertical split. The handle has to flip to a full-width, one-pixel-tall bar;
 * if the orientation data attribute changes again, this is the story that
 * catches it.
 */
export const Vertical: Story = {
	render: () => (
		<ResizablePanelGroup
			orientation="vertical"
			className="ds-raised max-w-2xl rounded-lg border"
			style={{ height: 260 }}
		>
			<ResizablePanel id="top" defaultSize="45">
				<Pane label="Top" />
			</ResizablePanel>
			<ResizableHandle />
			<ResizablePanel id="bottom">
				<Pane label="Bottom" />
			</ResizablePanel>
		</ResizablePanelGroup>
	)
}

/** The grip affordance, which rotates with the group's orientation. */
export const WithHandle: Story = {
	render: () => (
		<div className="flex flex-col gap-6">
			<ResizablePanelGroup
				orientation="horizontal"
				className="ds-raised max-w-2xl rounded-lg border"
				style={{ height: 180 }}
			>
				<ResizablePanel id="h-left" defaultSize="50">
					<Pane label="Left" />
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel id="h-right">
					<Pane label="Right" />
				</ResizablePanel>
			</ResizablePanelGroup>

			<ResizablePanelGroup
				orientation="vertical"
				className="ds-raised max-w-2xl rounded-lg border"
				style={{ height: 220 }}
			>
				<ResizablePanel id="v-top" defaultSize="50">
					<Pane label="Top" />
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel id="v-bottom">
					<Pane label="Bottom" />
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	)
}
