import { aimLight } from '@vctrl/core'
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import { createStore, Provider, useAtom, useAtomValue } from 'jotai'
import { useCallback, useMemo } from 'react'
import {
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusKnotGeometry
} from 'three'

import LightingSettings from './lighting-settings-panel'
import { OcclusionBakeSection } from './occlusion-bake-section'
import {
	editedLightRoleAtom,
	type OcclusionBakePreview
} from '../../../../../lib/stores/publisher-config-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'

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
	const [lighting, setLighting] = useAtom(lightingAtom)
	const editedRole = useAtomValue(editedLightRoleAtom)
	const model = useMemo(sampleModel, [])

	// As the publisher route aims it, without the route's debounce.
	const aimEditedLight = useCallback(
		(position: [number, number, number]) =>
			setLighting((prev) => {
				const direction = aimLight(position, prev.environment?.rotation ?? 0)
				return {
					...prev,
					lights: (prev.lights ?? []).map((light) =>
						light.role === editedRole ? { ...light, ...direction } : light
					)
				}
			}),
		[setLighting, editedRole]
	)

	return (
		<VectrealViewer
			model={model}
			lighting={lighting}
			shadowLightEditable={editedRole !== null}
			editableLightRole={editedRole ?? undefined}
			onShadowLightChange={aimEditedLight}
		/>
	)
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

const SOURCE = { document: null, passRevision: 0 }

const BAKE_STATES: {
	title: string
	canBake: boolean
	isOptimizing?: boolean
	isAnimated?: boolean
	preview: OcclusionBakePreview | null
}[] = [
	{ title: 'No model', canBake: false, preview: null },
	{
		title: 'Optimizing',
		canBake: false,
		isOptimizing: true,
		preview: null
	},
	{ title: 'Ready to bake', canBake: true, preview: null },
	{
		title: 'Baking',
		canBake: true,
		preview: { status: 'baking', source: SOURCE, shown: true }
	},
	{
		title: 'Baked',
		canBake: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 1640,
			report: {
				baked: ['Body', 'Sole', 'Laces'],
				skipped: [
					{ material: 'Logo', reason: 'tiling-uvs' },
					{ material: 'Eyelet', reason: 'shared-geometry' }
				]
			}
		}
	},
	{
		title: 'Baked, animated model',
		canBake: true,
		isAnimated: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 920,
			report: { baked: ['Robot'], skipped: [] }
		}
	},
	{
		title: 'Nothing bakeable',
		canBake: true,
		preview: {
			status: 'ready',
			source: SOURCE,
			shown: true,
			durationMs: 40,
			report: {
				baked: [],
				skipped: [{ material: 'Material', reason: 'no-uv0' }]
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
			error: 'The GPU reset while baking ambient occlusion'
		}
	}
]

/** Every state of the Bake section, as the Ambient occlusion view shows it. */
export const BakeSection: Story = {
	parameters: { layout: 'padded', dualTheme: true },
	render: () => (
		<div className="flex flex-wrap gap-4">
			{BAKE_STATES.map((state) => (
				<div key={state.title} className="shell-panel w-[21rem] space-y-4 p-4">
					<h3 className="text-foreground text-sm font-medium">{state.title}</h3>
					<OcclusionBakeSection
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
