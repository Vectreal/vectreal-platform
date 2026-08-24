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

import type { VectrealViewerProps } from './vectreal-viewer'
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

/**
 * A cube gives occlusion something to hide behind: markers on the far face sit
 * behind a full model depth from the opening view, so the fade is visible
 * without touching the controls.
 */
const createHotspotModel = (name: string) => {
	const mesh = new Mesh(
		new BoxGeometry(1.2, 1.2, 1.2),
		new MeshStandardMaterial({
			color: '#60a5fa',
			metalness: 0.3,
			roughness: 0.4
		})
	)
	mesh.name = name
	return mesh
}

const hotspotModel = createHotspotModel('HotspotCube')

/**
 * A data URI keeps the story self-contained: the `image` and `svg` presets take
 * a `payloadUrl`, and a story that reached for a hosted file would render an
 * empty frame the day that file moved.
 */
const markSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fc6c18"><path d="M12 2 15 9l7 .6-5.3 4.6L18.3 21 12 17.3 5.7 21l1.6-6.8L2 9.6 9 9z"/></svg>'
)}`

type StoryHotspot = NonNullable<VectrealViewerProps['hotspots']>[number]

const base = (
	id: string,
	name: string,
	worldPosition: [number, number, number]
): StoryHotspot => ({
	id,
	name,
	worldPosition,
	visible: true,
	internalOnly: false,
	stylePreset: 'dot'
})

/**
 * Every preset and every filter rule, laid out in one row in front of the
 * geometry. Nine stored, seven drawn: the hidden one and the internal-only one
 * never reach a public viewer.
 */
const styleHotspots: StoryHotspot[] = [
	{ ...base('step-1', 'First stop', [-0.75, 0.15, 0.7]), sequenceIndex: 0 },
	{
		// A deliberate gap: stored indices only have to be unique, so this marker
		// still has to read "step 2".
		...base('step-2', 'Second stop', [-0.4, 0.15, 0.7]),
		sequenceIndex: 4
	},
	base('plain', 'No sequence', [-0.05, 0.15, 0.7]),
	{
		...base('image-preset', 'Image preset', [0.3, 0.15, 0.7]),
		stylePreset: 'image',
		payloadUrl: markSvg
	},
	{
		...base('svg-preset', 'SVG preset', [0.65, 0.15, 0.7]),
		stylePreset: 'svg',
		payloadUrl: markSvg
	},
	{
		...base('badged', 'Sequenced artwork', [1.0, 0.15, 0.7]),
		stylePreset: 'svg',
		payloadUrl: markSvg,
		sequenceIndex: 7
	},
	{
		...base('no-payload', 'Image preset, no artwork yet', [-1.1, 0.15, 0.7]),
		stylePreset: 'image'
	},
	{ ...base('hidden', 'Hidden by the author', [0, 0.6, 0.7]), visible: false },
	{ ...base('internal', 'Internal only', [0, -0.35, 0.7]), internalOnly: true }
]

/**
 * Occlusion only. Positions hug the cube faces, which `Center top` lifts to span
 * y 0 to 1.2 with its faces at z ±0.6.
 */
const occlusionHotspots: StoryHotspot[] = [
	{
		...base('front-1', 'Front panel', [-0.35, 0.95, 0.62]),
		sequenceIndex: 0,
		// The only hotspot in these stories with somewhere to go, so the button
		// branch - focus ring, tab stop, aria-disabled while occluded - is the one
		// actually rendered rather than the label-only fallback.
		linkedCameraId: 'opening'
	},
	{ ...base('front-2', 'Lower edge', [0.35, 0.35, 0.62]), sequenceIndex: 1 },
	base('rear', 'Rear panel', [0, 0.85, -0.62]),
	// Exactly on the front face, not floating in front of it. This is what the
	// authoring surface actually stores - it raycasts the model and keeps the
	// intersection - and a depth test without a tolerance reports it as occluded
	// by the very triangle it sits on.
	base('on-surface', 'Placed on the surface', [-0.2, 0.6, 0.6]),
	{
		...base('rear-always', 'Rear panel, always shown', [0, 0.35, -0.62]),
		occlusionEnabled: false
	}
]

const hotspotRender: Story['render'] = (args) => (
	<VectrealViewer {...args}>
		<ambientLight intensity={0.8} />
		<directionalLight position={[3, 4, 2]} intensity={1.4} />
		<mesh rotation={[0.2, 0.4, 0]}>
			<boxGeometry args={[1.2, 1.2, 1.2]} />
			<meshStandardMaterial color="#60a5fa" metalness={0.3} roughness={0.4} />
		</mesh>
	</VectrealViewer>
)

/**
 * The cube is a child rather than the `model` prop, which leaves the viewer with
 * no occlusion target at all. That is the point: without it the markers would
 * fade on whichever frame the bounds pass happened to settle, and a snapshot of
 * marker chrome is worth more than one of the fade.
 */
export const HotspotStyles: Story = {
	args: { hotspots: styleHotspots },
	render: hotspotRender
}

/** The publisher's view of the same scene: the internal-only hotspot appears. */
export const HotspotsOnAnEditingSurface: Story = {
	args: { hotspots: styleHotspots, showInternalHotspots: true },
	render: hotspotRender
}

/**
 * Markers on the far side of the model fade; the one with `occlusionEnabled:
 * false` does not. Orbit to watch it reverse.
 */
export const HotspotOcclusion: Story = {
	args: {
		model: hotspotModel,
		hotspots: occlusionHotspots,
		// An explicit camera rather than the bounds framing pass. Occlusion is a
		// function of where the camera is, so a story that let the framing settle
		// on its own would snapshot whichever frame the capture happened to catch.
		// A stored position also switches bounds framing off (see `boundsEnabled`),
		// which is what makes the opening view repeatable.
		cameraOptions: {
			activeCameraId: 'opening',
			cameras: [
				{
					cameraId: 'opening',
					name: 'Opening view',
					position: [0.9, 1.5, 3.2],
					target: [0, 0.6, 0]
				}
			]
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
