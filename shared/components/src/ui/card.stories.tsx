import { Button } from './button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from './card'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * `Card` is the broadest surface in the system. Its base changed from
 * `bg-card` + `shadow-sm` to `ds-raised`, because `--card` resolves to exactly
 * `--background` in dark mode - a bare card was invisible there, which is why
 * call sites had each invented their own separation. That change shipped with
 * no visual coverage whatsoever.
 */
const meta = {
	title: 'Components/Card',
	component: Card,
	tags: ['autodocs']
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: () => (
		<Card className="max-w-sm">
			<CardHeader>
				<CardTitle>Scene metrics</CardTitle>
				<CardDescription>Updated a few moments ago</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-sm">
					A card with no extra classes. It has to separate from the page on its
					own, without a border.
				</p>
			</CardContent>
			<CardFooter>
				<Button size="sm">Open</Button>
			</CardFooter>
		</Card>
	)
}

/**
 * A card on a raised panel, both elevations side by side.
 *
 * The default `raised` card is invisible here - it and the panel resolve to the
 * same 4% mix, so there is no edge between them. Nested cards need `overlay`.
 * The broken case is kept in the story on purpose: it is the whole reason the
 * prop exists, and a regression would show as the two boxes converging.
 */
export const OnRaisedSurface: Story = {
	render: () => (
		<div className="ds-raised space-y-4 rounded-2xl p-6">
			<Card className="max-w-sm">
				<CardHeader>
					<CardTitle>elevation=&quot;raised&quot;</CardTitle>
					<CardDescription>
						Same value as the panel, so no separation
					</CardDescription>
				</CardHeader>
			</Card>
			<Card elevation="overlay" className="max-w-sm">
				<CardHeader>
					<CardTitle>elevation=&quot;overlay&quot;</CardTitle>
					<CardDescription>One step up, so it reads as nested</CardDescription>
				</CardHeader>
			</Card>
		</div>
	)
}
