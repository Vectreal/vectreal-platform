import { valueMappings } from '@shared/utils'
import { useState } from 'react'

import { Slider, type SliderProps } from './slider'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The filled bar. Drag or click to set, arrow keys step by `step` (Shift for
 * ten), and double-click or Enter types an exact value. Each story wraps the
 * slider in local state because the component is controlled.
 */
const meta = {
	title: 'Components/Slider',
	component: Slider,
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div className="w-80">
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

function Controlled(
	props: Omit<SliderProps, 'value' | 'onValueChange'> & {
		initial: number
	}
) {
	const { initial, ...rest } = props
	const [value, setValue] = useState(initial)
	return <Slider {...rest} value={value} onValueChange={setValue} />
}

const base = {
	label: 'Intensity',
	min: 0,
	max: 2,
	step: 0.05,
	value: 0,
	onValueChange: () => undefined
}

export const Default: Story = {
	args: base,
	render: () => (
		<Controlled label="Intensity" min={0} max={2} step={0.05} initial={0.8} />
	)
}

export const Empty: Story = {
	args: base,
	render: () => (
		<Controlled label="Intensity" min={0} max={2} step={0.05} initial={0} />
	)
}

export const Full: Story = {
	args: base,
	render: () => (
		<Controlled label="Intensity" min={0} max={2} step={0.05} initial={2} />
	)
}

export const WithPresets: Story = {
	args: base,
	render: () => (
		<Controlled
			label="Field of view"
			min={10}
			max={120}
			step={1}
			initial={50}
			formatValue={(value) => `${value}°`}
			presets={[
				{ value: 24, label: 'Tele' },
				{ value: 50, label: 'Standard' },
				{ value: 85, label: 'Wide' }
			]}
		/>
	)
}

export const Logarithmic: Story = {
	args: base,
	render: () => (
		<Controlled
			label="Zoom speed"
			min={0.01}
			max={10}
			step={0.01}
			initial={1}
			mapping={valueMappings.log}
		/>
	)
}

export const LongLabel: Story = {
	args: base,
	render: () => (
		<Controlled
			label="Background brightness when shown behind the model"
			min={0}
			max={1}
			step={0.01}
			initial={0.4}
		/>
	)
}

export const Disabled: Story = {
	args: base,
	render: () => (
		<Controlled
			label="Intensity"
			min={0}
			max={2}
			step={0.05}
			initial={0.8}
			disabled
		/>
	)
}
