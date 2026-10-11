import { useState } from 'react'

import CameraControls from './camera-controls'

import type { CameraControlsOption } from './camera-controls'
import type { Meta, StoryObj } from '@storybook/react-vite'

const THREE: CameraControlsOption[] = [
	{ cameraId: 'hero', name: 'Hero' },
	{ cameraId: 'detail', name: 'Detail' },
	{ cameraId: 'context', name: 'Context' }
]

const FIVE: CameraControlsOption[] = [
	...THREE,
	{ cameraId: 'top', name: 'Top' },
	{ cameraId: 'back', name: 'Back' }
]

/** Holds the selection the way the viewer would, from its own events. */
const Stage = ({
	cameras,
	theme,
	initialCameraId,
	offListLabel
}: {
	cameras: CameraControlsOption[]
	theme: 'light' | 'dark'
	initialCameraId: string
	offListLabel?: string
}) => {
	const [activeCameraId, setActiveCameraId] = useState(initialCameraId)
	return (
		<div
			className={
				theme === 'dark'
					? 'viewer relative h-[360px] w-[480px] bg-zinc-900'
					: 'viewer relative h-[360px] w-[480px] bg-zinc-100'
			}
			data-theme={theme}
		>
			<CameraControls
				cameras={cameras}
				activeCameraId={activeCameraId}
				offListLabel={offListLabel}
				onSelect={setActiveCameraId}
			/>
		</div>
	)
}

const meta = {
	title: 'Viewer/Camera Controls',
	component: Stage,
	tags: ['autodocs'],
	parameters: {
		// Each story scopes its own viewer theme; the shared light/dark
		// decorator would render it twice.
		dualTheme: false,
		layout: 'centered',
		docs: {
			description: {
				component:
					'The viewer’s switcher between scene cameras, drawn when a scene has two or more. Arrows wrap; past three cameras the name also opens a list. Remount a story to replay its entrance.'
			}
		}
	},
	args: { cameras: THREE, theme: 'light', initialCameraId: 'hero' }
} satisfies Meta<typeof Stage>

export default meta

type Story = StoryObj<typeof meta>

export const ThreeCameras: Story = {}

export const DarkMode: Story = { args: { theme: 'dark' } }

export const WithList: Story = { args: { cameras: FIVE } }

export const OnAHotspotView: Story = {
	args: { initialCameraId: 'hotspot-camera-1', offListLabel: 'Handle' }
}
