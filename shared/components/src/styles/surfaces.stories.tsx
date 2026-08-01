import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The elevation ladder. These are plain CSS utilities rather than components,
 * but they are the foundation the rest of the system sits on and they had no
 * coverage at all - which is how a PR that rewrote every overlay surface passed
 * Chromatic with "no changes".
 */
const meta = {
	title: 'Foundations/Surfaces'
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const LADDER = [
	['ds-sunken', 'Wells. Inputs, and blocks that recede from their container.'],
	['ds-raised', 'The default panel. Cards, tables, sidebars.'],
	['ds-overlay', 'Above a raised surface. Menus, popovers, rows on a panel.']
] as const

export const Elevation: Story = {
	render: () => (
		<div className="space-y-3">
			{LADDER.map(([name, description]) => (
				<div key={name} className={`${name} rounded-2xl p-5`}>
					<p className="font-medium">{name}</p>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
			))}
		</div>
	)
}

/**
 * Nesting is the real test: each step has to separate from the one beneath it
 * without a border. If two steps collapse to the same value in one theme, this
 * story shows it immediately.
 */
export const Nested: Story = {
	render: () => (
		<div className="ds-raised rounded-2xl p-4">
			<p className="text-eyebrow text-muted-foreground mb-3">ds-raised panel</p>
			<div className="ds-overlay mb-2 rounded-xl p-3">
				<p className="text-sm">ds-overlay row</p>
			</div>
			<div className="ds-sunken rounded-xl p-3">
				<p className="text-sm">ds-sunken well</p>
			</div>
		</div>
	)
}

export const Interactive: Story = {
	render: () => (
		<div className="ds-raised space-y-2 rounded-2xl p-4">
			<p className="text-eyebrow text-muted-foreground">Hover these</p>
			<button className="ds-raised-interactive w-full rounded-xl p-3 text-left text-sm">
				ds-raised-interactive
			</button>
			<button className="ds-overlay-interactive w-full rounded-xl p-3 text-left text-sm">
				ds-overlay-interactive
			</button>
		</div>
	)
}

export const Divider: Story = {
	render: () => (
		<div className="ds-raised rounded-2xl p-4">
			<p className="text-sm">Above</p>
			<div className="ds-divider my-3 h-px" />
			<p className="text-sm">Below</p>
		</div>
	)
}
