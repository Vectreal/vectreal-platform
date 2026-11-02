import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import { createStore, Provider, useAtomValue } from 'jotai'
import { useMemo } from 'react'
import {
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusKnotGeometry
} from 'three'

import { BakeSection } from './bake-section'
import LightingSettings from './lighting-settings-panel'
import { finishStatus, StudioFinishCard } from './studio-finish-card'
import { nothingCaption } from '../../../../../lib/domain/scene/client/studio-finish-reasons'
import { type BakePreview } from '../../../../../lib/stores/publisher-config-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'
import { DrillDown, DrillDownView } from '../../drill-down'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The Lighting tool as the publisher shows it: its panel over the scene it
 * lights, sharing one store, so a setup, a light or the ground can be judged
 * on a model rather than only as a control.
 */
const meta = {
	title: 'Publisher/Lighting',
	parameters: { layout: 'fullscreen', dualTheme: false }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A glossy knot over a matte ball: highlights, shading and a shadow. */
function sampleModel() {
	const model = new Group()
	const knot = new Mesh(
		new TorusKnotGeometry(0.28, 0.09, 160, 24),
		new MeshStandardMaterial({
			color: '#c8c8cc',
			metalness: 1,
			roughness: 0.15
		})
	)
	knot.position.y = 0.62
	const ball = new Mesh(
		new SphereGeometry(0.22, 64, 32),
		new MeshStandardMaterial({ color: '#d9d4cc', roughness: 0.7 })
	)
	ball.position.y = 0.22
	model.add(knot, ball)
	return model
}

function Scene() {
	const lighting = useAtomValue(lightingAtom)
	const model = useMemo(sampleModel, [])
	return <VectrealViewer model={model} lighting={lighting} />
}

function PanelOverScene() {
	const store = useMemo(createStore, [])
	return (
		<Provider store={store}>
			<ModelProvider>
				<div className="bg-background relative h-dvh w-full">
					<Scene />
					<div className="pointer-events-none absolute inset-y-0 left-0 p-4">
						<div className="shell-panel pointer-events-auto flex h-full w-[21rem] flex-col overflow-hidden">
							<div className="border-shell-border-soft shrink-0 border-b p-4">
								<h2 className="text-foreground text-h3">Lighting</h2>
							</div>
							<div className="no-scrollbar min-h-0 flex-1 overflow-auto p-4">
								<LightingSettings />
							</div>
						</div>
					</div>
				</div>
			</ModelProvider>
		</Provider>
	)
}

export const Panel: Story = { render: () => <PanelOverScene /> }

const SOURCE = { document: null, passRevision: 0, bakes: '' }

const BAKE_STATES: {
	title: string
	canBake: boolean
	isOptimizing?: boolean
	isAnimated?: boolean
	preview: BakePreview | null
}[] = [
	{ title: 'No model', canBake: false, preview: null },
	{
		title: 'Optimizing',
		canBake: false,
		isOptimizing: true,
		preview: null
	},
	{ title: 'Ready to preview', canBake: true, preview: null },
	{
		title: 'Drawing',
		canBake: true,
		preview: { status: 'baking', source: SOURCE, shown: true }
	},
	{
		title: 'Shown',
		canBake: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 3280,
			reports: {
				occlusion: {
					baked: ['Body', 'Sole', 'Laces'],
					skipped: [
						{ material: 'Logo', reason: 'tiling-uvs' },
						{ material: 'Eyelet', reason: 'shared-geometry' }
					]
				},
				lights: {
					baked: ['Body', 'Sole', 'Laces', 'Logo'],
					skipped: [{ material: 'Eyelet', reason: 'shared-geometry' }]
				}
			}
		}
	},
	{
		title: 'Shown, animated model',
		canBake: true,
		isAnimated: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 920,
			reports: { occlusion: { baked: ['Robot'], skipped: [] } }
		}
	},
	{
		title: 'Nothing to finish',
		canBake: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 40,
			reports: {
				occlusion: {
					baked: [],
					skipped: [
						{ material: 'Body', reason: 'no-uv0' },
						{ material: 'Sole', reason: 'no-uv0' },
						{ material: 'Laces', reason: 'no-uv0' },
						{ material: 'Logo', reason: 'tiling-uvs' }
					]
				}
			}
		}
	},
	{
		title: 'Drawn at lower detail',
		canBake: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 6400,
			reports: {
				occlusion: {
					baked: ['Body', 'Sole'],
					skipped: [],
					recovered: 'lower-detail'
				}
			}
		}
	},
	{
		title: 'Lights failed',
		canBake: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 2100,
			reports: {
				occlusion: { baked: ['Body', 'Sole'], skipped: [] },
				lights: {
					failed: 'gpu-reset',
					detail: 'The GPU reset while baking the studio lights'
				}
			}
		}
	},
	{
		// Exported names run long with no spaces, and must wrap in the sidebar.
		title: 'Long material names',
		canBake: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 2100,
			reports: {
				occlusion: {
					baked: ['Body'],
					skipped: [
						{
							material:
								'Sneaker_Upper_Mesh_Knit_Primary_Material_Variant_002_Final_v3',
							reason: 'overlapping-uvs'
						},
						{
							material:
								'Sneaker_Tongue_Mesh_Knit_Secondary_Material_Variant_007_Final_v2',
							reason: 'overlapping-uvs'
						}
					]
				},
				lights: {
					failed: 'unexpected',
					detail:
						'WebGLRenderer:_framebuffer_incomplete_FRAMEBUFFER_INCOMPLETE_ATTACHMENT_on_target_0'
				}
			}
		}
	},
	{
		title: 'Failed',
		canBake: true,
		preview: {
			status: 'failed',
			source: SOURCE,
			shown: true,
			failure: {
				reason: 'no-webgl',
				detail: 'Error creating WebGL context.'
			}
		}
	}
]

/** Every state of the preview, as the Studio finish view shows it. */
export const FinishPreviewStates: Story = {
	parameters: { layout: 'padded', dualTheme: true },
	render: () => (
		<div className="flex flex-wrap gap-4">
			{BAKE_STATES.map((state) => (
				<div key={state.title} className="shell-panel w-[21rem] space-y-4 p-4">
					<h3 className="text-foreground text-sm font-medium">{state.title}</h3>
					<BakeSection
						preview={state.preview}
						canBake={state.canBake}
						isOptimizing={state.isOptimizing ?? false}
						isAnimated={state.isAnimated ?? false}
						onBake={() => {}}
						onShownChange={() => {}}
					/>
				</div>
			))}
		</div>
	)
}

/** The card on the Lighting tool's root, off and then through each preview state. */
export const FinishCardStates: Story = {
	parameters: { layout: 'padded', dualTheme: true },
	render: () => (
		<div className="flex flex-wrap gap-4">
			{[
				{ title: 'Off', canBake: false, isOptimizing: false, preview: null },
				...BAKE_STATES
			].map((state, index) => (
				<div key={state.title} className="shell-panel w-[21rem] space-y-4 p-4">
					<h3 className="text-foreground text-sm font-medium">{state.title}</h3>
					<DrillDown path={[]} onPathChange={() => {}} rootTitle="Lighting">
						<DrillDownView id="root">
							<StudioFinishCard
								status={finishStatus(index > 0, state.preview)}
								nothingCaption={nothingCaption(state.preview?.reports)}
								canPreview={state.canBake}
								isOptimizing={state.isOptimizing ?? false}
								onAdd={() => {}}
								onPreview={() => {}}
								onShownChange={() => {}}
							/>
						</DrillDownView>
					</DrillDown>
				</div>
			))}
		</div>
	)
}
