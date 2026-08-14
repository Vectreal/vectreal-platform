import { describeAnimationClips } from '@vctrl/core'
import { fn } from 'storybook/test'
import {
	AnimationClip,
	BoxGeometry,
	Mesh,
	MeshStandardMaterial,
	NumberKeyframeTrack,
	VectorKeyframeTrack
} from 'three'

import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter
} from './components'
import { defaultControlsOptions, defaultEnvOptions } from './components/scene'
import VectrealViewer from './vectreal-viewer'

import type { Meta, StoryObj } from '@storybook/react-vite'
const meta = {
	title: 'Viewer/Vectreal Viewer',
	component: VectrealViewer,
	tags: ['autodocs'],
	parameters: {
		// These scope their own theme and mount a WebGL canvas; the shared
		// light/dark decorator would render each one twice.
		dualTheme: false,
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
		onCommandExecutorReady: fn(),
		theme: 'system',
		controlsOptions: { ...defaultControlsOptions, autoRotate: false },
		envOptions: defaultEnvOptions
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

/**
 * Built in code rather than loaded from a fixture: there is no animated model
 * anywhere in `packages/`, and committing a binary to drive one story is a poor
 * trade. Module scope keeps the identity stable, which matters because the
 * runtime rebuilds its mixer whenever the model changes.
 */
const animatedModel = new Mesh(
	new BoxGeometry(1.2, 1.2, 1.2),
	new MeshStandardMaterial({ color: '#60a5fa', metalness: 0.3, roughness: 0.4 })
)
animatedModel.name = 'AnimatedCube'

const animatedClips = [
	new AnimationClip('Spin', 4, [
		new NumberKeyframeTrack('.rotation[y]', [0, 4], [0, Math.PI * 2])
	]),
	new AnimationClip('Hover', 2, [
		new VectorKeyframeTrack(
			'.position',
			[0, 1, 2],
			[0, 0, 0, 0, 0.6, 0, 0, 0, 0]
		)
	])
]

// Ids are derived, never hand-written: they carry a digest of the clip name, so
// a literal here would silently fail to match and the scene would sit still.
const animatedClipConfigs = describeAnimationClips(animatedClips).map(
	(descriptor, order) => ({
		clipId: descriptor.clipId,
		sourceName: descriptor.name,
		sourceIndex: descriptor.index,
		enabled: true,
		order,
		loop: order === 1 ? ('ping_pong' as const) : ('repeat' as const),
		timeScale: 1,
		startOffset: 0
	})
)

export const Animated: Story = {
	parameters: {
		// Chromatic pauses CSS and SMIL animation, but not requestAnimationFrame,
		// which is what r3f's loop and the mixer run on. The captured frame would
		// depend on wall-clock time between mount and capture, so every build would
		// diff. Behavior is covered by the playback unit tests and viewer-e2e.
		chromatic: { disableSnapshot: true }
	},
	args: {
		model: animatedModel,
		animations: animatedClips,
		animationOptions: {
			enabled: true,
			mode: 'simultaneous',
			autoplay: true,
			loopSequence: false,
			showControls: true,
			clips: animatedClipConfigs
		}
	},
	render: (args) => (
		<VectrealViewer {...args}>
			<ambientLight intensity={0.8} />
			<directionalLight position={[3, 4, 2]} intensity={1.4} />
		</VectrealViewer>
	)
}

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
