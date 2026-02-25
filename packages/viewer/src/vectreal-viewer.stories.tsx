import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter
} from './components'
import {
	defaultControlsOptions,
	defaultEnvOptions,
	defaultGridOptions
} from './components/scene'
import VectrealViewer from './vectreal-viewer'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
	title: 'Viewer/Vectreal Viewer',
	component: VectrealViewer,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Render interactive 3D content with built-in controls, post-processing, and optional UI overlays.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div style={{ height: '80vh' }}>
				<Story />
			</div>
		)
	],
	args: {
		theme: 'system',
		controlsOptions: { ...defaultControlsOptions, autoRotate: false },
		envOptions: defaultEnvOptions,
		gridOptions: defaultGridOptions
	},
	render: (args) => (
		<VectrealViewer {...args}>
			<ambientLight intensity={0.8} />
			<directionalLight position={[3, 4, 2]} intensity={1.4} />
			<mesh castShadow receiveShadow rotation={[0.2, 0.4, 0]}>
				<boxGeometry args={[1.2, 1.2, 1.2]} />
				<meshStandardMaterial color="#60a5fa" metalness={0.3} roughness={0.4} />
			</mesh>
		</VectrealViewer>
	)
} satisfies Meta<typeof VectrealViewer>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithPopover: Story = {
	args: {
		popover: (
			<InfoPopover>
				<InfoPopoverTrigger />
				<InfoPopoverContent>
					<InfoPopoverCloseButton />
					<InfoPopoverText>
						<p>
							This is a customizable overlay slot for contextual viewer help.
						</p>
					</InfoPopoverText>
					<InfoPopoverVectrealFooter />
				</InfoPopoverContent>
			</InfoPopover>
		)
	}
}
