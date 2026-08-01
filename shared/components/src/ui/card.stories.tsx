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

/** A card on a raised panel - the case where elevation has to keep working. */
export const OnRaisedSurface: Story = {
	render: () => (
		<div className="ds-raised rounded-2xl p-6">
			<Card className="max-w-sm">
				<CardHeader>
					<CardTitle>Nested</CardTitle>
					<CardDescription>Card sitting on ds-raised</CardDescription>
				</CardHeader>
			</Card>
		</div>
	)
}
