import { cn } from '@shared/utils'

import { Button } from './button'
import { Input } from './input'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The surface material on every rung of the `ds-*` ladder: a bevel along the
 * top edge, a hairline rim, a faint base, and the shadow a lifted surface
 * throws. Raised and overlay lift; sunken and fields recede. A regression shows
 * as a rung going flat, or a well standing up off the page.
 */
const meta = {
	title: 'Foundations/Material'
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const RUNGS = [
	['ds-sunken', 'Sunken: a well, shaded from its top edge'],
	['ds-raised', 'Raised: a card sitting on the page'],
	['ds-overlay', 'Overlay: one step higher'],
	['ds-raised-interactive', 'Raised, interactive: hover to lift']
] as const

export const Rungs: Story = {
	render: () => (
		<div className="grid max-w-3xl grid-cols-2 gap-6">
			{RUNGS.map(([rung, label]) => (
				<div key={rung} className={cn(rung, 'rounded-2xl p-6')}>
					<p className="text-h4">{rung}</p>
					<p className="text-muted-foreground text-body-sm mt-1">{label}</p>
				</div>
			))}
		</div>
	)
}

/** Filled actions carry `ds-bevel`; neutral ones carry `ds-control`. */
export const Controls: Story = {
	render: () => (
		<div className="ds-raised flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl p-6">
			<Button>Default</Button>
			<Button variant="brand">Brand</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="destructive">Destructive</Button>
			<Input className="w-56" placeholder="A field recedes" />
		</div>
	)
}
