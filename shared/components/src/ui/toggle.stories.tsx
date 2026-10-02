import { Eye, Lock, Mountain, RotateCw } from 'lucide-react'
import { useState } from 'react'

import { Toggle } from './toggle'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * One on/off control in two layouts. Tiles are for bento grids of settings;
 * rows are for lists where each option needs a sentence.
 */
const meta = {
	title: 'Components/Toggle',
	component: Toggle,
	tags: ['autodocs']
} satisfies Meta<typeof Toggle>

export default meta
type Story = StoryObj<typeof meta>

function Tile({
	label,
	icon,
	initial = false,
	disabled
}: {
	label: string
	icon: React.ReactNode
	initial?: boolean
	disabled?: boolean
}) {
	const [checked, setChecked] = useState(initial)
	return (
		<Toggle
			layout="tile"
			label={label}
			icon={icon}
			checked={checked}
			onCheckedChange={setChecked}
			disabled={disabled}
		/>
	)
}

export const TileGrid: Story = {
	args: { label: 'Visible' },
	render: () => (
		<div className="grid w-80 grid-cols-3 gap-2">
			<Tile label="Visible" icon={<Eye />} initial />
			<Tile label="Editor only" icon={<Lock />} />
			<Tile label="Auto rotate" icon={<RotateCw />} initial />
			<Tile label="Background" icon={<Mountain />} />
			<Tile label="Disabled" icon={<Lock />} disabled />
			<Tile label="Disabled on" icon={<Eye />} initial disabled />
		</div>
	)
}

function Row({
	label,
	description,
	initial = false,
	disabled
}: {
	label: string
	description?: string
	initial?: boolean
	disabled?: boolean
}) {
	const [checked, setChecked] = useState(initial)
	return (
		<Toggle
			label={label}
			description={description}
			checked={checked}
			onCheckedChange={setChecked}
			disabled={disabled}
		/>
	)
}

export const Rows: Story = {
	args: { label: 'Analytics' },
	render: () => (
		<div className="w-96 space-y-4">
			<Row
				label="Necessary"
				description="Required for sign-in and security. Always on."
				initial
				disabled
			/>
			<Row
				label="Analytics"
				description="Helps us understand which features are used."
			/>
			<Row label="No description" initial />
		</div>
	)
}
