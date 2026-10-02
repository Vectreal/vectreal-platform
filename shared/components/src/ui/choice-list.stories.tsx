import { Feather, Gem, Scale } from 'lucide-react'
import { useState } from 'react'

import { ChoiceList, type ChoiceListOption } from './choice-list'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * One of several rich options. The selected row fills and inverts, and its
 * detail opens under it.
 */
const meta = {
	title: 'Components/ChoiceList',
	component: ChoiceList,
	tags: ['autodocs']
} satisfies Meta<typeof ChoiceList>

export default meta
type Story = StoryObj<typeof meta>

type Preset = 'quality' | 'balanced' | 'smallest'

const PRESETS: ChoiceListOption<Preset>[] = [
	{
		value: 'quality',
		label: 'Maximum quality',
		icon: <Gem />,
		meta: '2K · 90%',
		detail: 'Keeps textures large and detail intact, at a bigger download.'
	},
	{
		value: 'balanced',
		label: 'Balanced',
		icon: <Scale />,
		meta: '1K · 80%',
		detail: 'Sharp on desktop and quick to load.'
	},
	{
		value: 'smallest',
		label: 'Smallest',
		icon: <Feather />,
		meta: '512 · 70%',
		detail: 'The smallest file and the fastest first paint.'
	}
]

function Presets({ initial }: { initial: Preset | undefined }) {
	const [value, setValue] = useState(initial)
	return (
		<div className="w-80">
			<ChoiceList
				aria-label="Optimization preset"
				options={PRESETS}
				value={value}
				onValueChange={setValue}
			/>
		</div>
	)
}

export const Selected: Story = {
	args: {
		'aria-label': 'Optimization preset',
		options: [],
		value: undefined,
		onValueChange: () => undefined
	},
	render: () => <Presets initial="balanced" />
}

/** Nothing selected, as when saved settings match no preset. */
export const NoneSelected: Story = {
	args: {
		'aria-label': 'Optimization preset',
		options: [],
		value: undefined,
		onValueChange: () => undefined
	},
	render: () => <Presets initial={undefined} />
}
