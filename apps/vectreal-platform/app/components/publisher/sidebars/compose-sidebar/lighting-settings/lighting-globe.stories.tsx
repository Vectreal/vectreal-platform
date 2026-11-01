import {
	LIGHTING_SETUPS,
	resolveLighting,
	type LightingSettings
} from '@vctrl/core'
import { useState } from 'react'

import { formatDegrees, LightingGlobe } from './lighting-globe'
import { SettingGroup } from '../../sidebar-section'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The Lighting tool's Turn: the sky around the model, seen from its front.
 * Drag it sideways, or use the arrow keys, to turn the environment and every
 * light together.
 */
const meta = {
	title: 'Publisher/Lighting/Globe',
	component: LightingGlobe,
	decorators: [
		(Story) => (
			<div className="w-72">
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof LightingGlobe>

export default meta
type Story = StoryObj<typeof meta>

function Turnable({
	lighting,
	initial = 0
}: {
	lighting: LightingSettings
	initial?: number
}) {
	const [rotation, setRotation] = useState(initial)
	const resolved = resolveLighting({ lighting })
	return (
		<SettingGroup label="Turn" value={formatDegrees(rotation)}>
			<LightingGlobe
				rotation={rotation}
				onRotationChange={setRotation}
				map={resolved.environment.map}
				lights={resolved.lights}
			/>
		</SettingGroup>
	)
}

const setup = (id: string) =>
	LIGHTING_SETUPS.find((entry) => entry.id === id)!.lighting

const args = {
	rotation: 0,
	onRotationChange: () => undefined,
	map: 'studio-key' as const,
	lights: []
}

/** The Product setup: each light sits on the studio map's region it stands for. */
export const Product: Story = {
	args,
	render: () => <Turnable lighting={setup('product')} />
}

/** A city at night has several bright regions; turned so some sit behind. */
export const ManyRegionsTurned: Story = {
	args,
	render: () => (
		<Turnable
			lighting={{ ...setup('product'), environment: { map: 'night-city' } }}
			initial={120}
		/>
	)
}

/** Colored lights, so each dot reads in its own color. */
export const ColoredLights: Story = {
	args,
	render: () => (
		<Turnable
			lighting={{
				lights: [
					{ role: 'key', azimuth: 40, elevation: 35, color: '#ffb46b' },
					{ role: 'fill', azimuth: -60, elevation: 15, color: '#9ec4ff' },
					{ role: 'rim', azimuth: 160, elevation: 25, color: '#ffffff' }
				]
			}}
		/>
	)
}

/** No lights: the environment alone, with no bright regions to show. */
export const EnvironmentOnly: Story = {
	args,
	render: () => (
		<Turnable
			lighting={{ environment: { map: 'nature-park-overcast' }, lights: [] }}
		/>
	)
}
