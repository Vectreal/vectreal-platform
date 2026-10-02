import { LayoutGrid, Rows3 } from 'lucide-react'
import { useState } from 'react'

import { ToggleGroup, ToggleGroupItem } from './toggle-group'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * A segmented control. The selected segment fills and inverts; layout comes
 * from `className` (a grid for many short options).
 */
const meta = {
	title: 'Components/ToggleGroup',
	component: ToggleGroup,
	tags: ['autodocs']
} satisfies Meta<typeof ToggleGroup>

export default meta
type Story = StoryObj<typeof meta>

function Single({
	options,
	initial,
	className
}: {
	options: string[]
	initial: string
	className?: string
}) {
	const [value, setValue] = useState(initial)
	return (
		<ToggleGroup
			type="single"
			value={value}
			onValueChange={(next) => next && setValue(next)}
			className={className}
		>
			{options.map((option) => (
				<ToggleGroupItem key={option} value={option}>
					{option}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	)
}

export const Labels: Story = {
	args: { type: 'single' },
	render: () => (
		<div className="w-80">
			<Single options={['Instant', 'Linear', 'Smart']} initial="Linear" />
		</div>
	)
}

export const Grid: Story = {
	args: { type: 'single' },
	render: () => (
		<div className="w-80">
			<Single
				options={['Linear', 'Ease in', 'Ease out', 'Ease in-out']}
				initial="Ease out"
				className="grid grid-cols-2"
			/>
		</div>
	)
}

export const Icons: Story = {
	args: { type: 'single' },
	render: () => {
		const IconGroup = () => {
			const [value, setValue] = useState('grid')
			return (
				<ToggleGroup
					type="single"
					value={value}
					onValueChange={(next) => next && setValue(next)}
					className="h-10 w-fit"
				>
					<ToggleGroupItem
						value="grid"
						aria-label="Grid view"
						className="size-8 flex-none px-0"
					>
						<LayoutGrid />
					</ToggleGroupItem>
					<ToggleGroupItem
						value="table"
						aria-label="Table view"
						className="size-8 flex-none px-0"
					>
						<Rows3 />
					</ToggleGroupItem>
				</ToggleGroup>
			)
		}
		return <IconGroup />
	}
}
