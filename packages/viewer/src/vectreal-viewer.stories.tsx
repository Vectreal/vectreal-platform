import { useGLTF } from '@react-three/drei'
import type { Meta, StoryObj } from '@storybook/react'
import React, { ComponentProps } from 'react'
import type { TypeWithDeepControls } from 'storybook-addon-deep-controls'

import { defaultInfoPopoverProps } from './components'
import {
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultGridOptions
} from './components/scene'

import VectrealViewer from './vectreal-viewer'

type ViewerProps = ComponentProps<typeof VectrealViewer>

const Component = (props: ViewerProps) => {
	const { scene } = useGLTF(
		// Model from the glTF sample models repository
		'https://raw.githack.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'
	)

	return <VectrealViewer model={scene} {...props} />
}

const meta: TypeWithDeepControls<Meta<typeof VectrealViewer>> = {
	component: Component,
	decorators: [
		(Story) => (
			<div style={{ height: '100vh' }}>
				<Story />
			</div>
		)
	],
	title: 'VectrealViewer',
	parameters: {
		deepControls: { enabled: true },
		layout: 'fullscreen'
	},
	argTypes: {
		'cameraOptions.position': {
			table: {
				category: 'Camera Options'
			},
			control: 'object',
			description: 'Initial camera position'
		},
		'cameraOptions.fov': {
			table: {
				category: 'Camera Options'
			},
			control: 'number',
			description: 'Field of view'
		},
		'cameraOptions.aspect': {
			table: {
				category: 'Camera Options'
			},
			control: 'number',
			description: 'Aspect ratio'
		},
		'cameraOptions.near': {
			table: {
				category: 'Camera Options'
			},
			control: 'number',
			description: 'Near clipping plane'
		},
		'cameraOptions.far': {
			table: {
				category: 'Camera Options'
			},
			control: 'number',
			description: 'Far clipping plane'
		},
		'controlsOptions.maxPolarAngle': {
			table: {
				category: 'Controls Options'
			},
			control: 'number',
			description: 'Maximum polar angle'
		},
		'controlsOptions.autoRotate': {
			table: {
				category: 'Controls Options'
			},
			control: 'boolean',
			description: 'Enable auto-rotate'
		},
		'controlsOptions.controlsTimeout': {
			table: {
				category: 'Controls Options'
			},
			control: 'number',
			description: 'Controls timeout duration'
		},
		'controlsOptions.makeDefault': {
			table: {
				category: 'Controls Options'
			},
			control: 'boolean',
			description: 'Make default camera controls'
		},
		'envOptions.backgroundColor': {
			table: {
				category: 'Environment Options'
			},
			control: 'color',
			description: 'Background color'
		},
		'envOptions.env.preset': {
			table: {
				category: 'Environment Options'
			},
			control: 'text',
			description: 'Environment preset'
		},
		'envOptions.stage.intensity': {
			table: {
				category: 'Environment Options'
			},
			control: 'number',
			description: 'Stage intensity'
		},
		'envOptions.stage.adjustCamera': {
			table: {
				category: 'Environment Options'
			},
			control: 'number',
			description: 'Adjust camera'
		},
		'gridOptions.showGrid': {
			table: {
				category: 'Grid Options'
			},
			control: 'boolean',
			description: 'Show grid'
		},
		'gridOptions.cellSize': {
			table: {
				category: 'Grid Options'
			},
			control: 'number',
			description: 'Cell size'
		},
		'gridOptions.sectionSize': {
			table: {
				category: 'Grid Options'
			},
			control: 'number',
			description: 'Section size'
		},
		'gridOptions.sectionColor': {
			table: {
				category: 'Grid Options'
			},
			control: 'color',
			description: 'Section color'
		},
		'gridOptions.cellColor': {
			table: {
				category: 'Grid Options'
			},
			control: 'color',
			description: 'Cell color'
		},
		'gridOptions.snapToBottom': {
			table: {
				category: 'Grid Options'
			},
			control: 'boolean',
			description: 'Snap to bottom'
		},
		'gridOptions.fadeDistance': {
			table: {
				category: 'Grid Options'
			},
			control: 'number',
			description: 'Fade distance'
		},
		'gridOptions.fadeStrength': {
			table: {
				category: 'Grid Options'
			},
			control: 'number',
			description: 'Fade strength'
		},
		'gridOptions.args': {
			table: {
				category: 'Grid Options'
			},
			control: 'object',
			description: 'Grid arguments'
		},
		'gridOptions.followCamera': {
			table: {
				category: 'Grid Options'
			},
			control: 'boolean',
			description: 'Follow camera'
		},
		'gridOptions.infiniteGrid': {
			table: {
				category: 'Grid Options'
			},
			control: 'boolean',
			description: 'Infinite grid'
		},
		'infoPopoverOptions.showInfo': {
			table: {
				category: 'Info Popover Options'
			},
			control: 'boolean',
			description: 'Show info popover'
		},
		'infoPopoverOptions.content': {
			table: {
				category: 'Info Popover Options'
			},
			control: 'text',
			description: 'Content of the info popover'
		}
	}
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		cameraOptions: defaultCameraOptions,
		controlsOptions: { ...defaultControlsOptions, autoRotate: false },
		envOptions: defaultEnvOptions,
		gridOptions: defaultGridOptions,
		infoPopoverOptions: defaultInfoPopoverProps
	}
}
