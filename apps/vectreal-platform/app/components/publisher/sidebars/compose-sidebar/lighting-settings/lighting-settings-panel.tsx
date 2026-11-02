import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import { Toggle } from '@shared/components/ui/toggle'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { valueMappings } from '@shared/utils'
import {
	ENVIRONMENT_KEYS,
	LIGHTING_SETUPS,
	resolveLighting,
	type EnvironmentKey,
	type EnvironmentResolution,
	type LightingSetupId
} from '@vctrl/core'
import { useAtomValue } from 'jotai/react'
import { Globe, Lightbulb } from 'lucide-react'
import { useEffect, useState } from 'react'
import { preload } from 'react-dom'

import { BakeSection } from './bake-section'
import {
	LIGHT_CAPTIONS,
	LIGHT_LABELS,
	LIGHTS_CAPTION,
	LightList,
	LightSettings,
	lightViewId
} from './light-views'
import {
	LIGHT_ROLES,
	matchingSetup,
	withFinish,
	withSetup,
	wrapDegrees
} from './lighting-edits'
import { formatDegrees, LightingGlobe } from './lighting-globe'
import { finishStatus, StudioFinishCard } from './studio-finish-card'
import { ThumbnailGrid } from './thumbnail-grid'
import { useBakePreview } from './use-bake-preview'
import { useLightingDraft } from './use-lighting-draft'
import { nothingCaption } from '../../../../../lib/domain/scene/client/studio-finish-reasons'
import {
	environmentThumbnail,
	lightingSetupThumbnail
} from '../../../../../lib/lighting/lighting-thumbnails'
import {
	environmentLoadFailedAtom,
	viewDirectionAtom
} from '../../../../../lib/stores/publisher-config-store'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../../drill-down'
import { PanelCaption, SettingGroup } from '../../sidebar-section'

const OCCLUSION_MODES = [
	{ mode: 'off', label: 'Off' },
	{ mode: 'live', label: 'Live' }
] as const

type LiveOcclusionMode = (typeof OCCLUSION_MODES)[number]['mode']

const SETUP_OPTIONS = LIGHTING_SETUPS.map((setup) => ({
	value: setup.id,
	label: setup.label,
	src: lightingSetupThumbnail(setup.id)
}))

const ENVIRONMENT_GROUPS = ['studio', 'outdoor', 'nature', 'night'] as const

const environmentLabel = (key: EnvironmentKey) => {
	const name = key.split('-').slice(1).join(' ')
	return name.charAt(0).toUpperCase() + name.slice(1)
}

const ENVIRONMENT_OPTIONS = ENVIRONMENT_GROUPS.map((group) => ({
	group,
	options: ENVIRONMENT_KEYS.filter((key) => key.startsWith(`${group}-`)).map(
		(key) => ({
			value: key as EnvironmentKey,
			label: environmentLabel(key),
			src: environmentThumbnail(key)
		})
	)
}))

/*
  Every thumbnail the tool can show, requested as the panel opens. The
  Environment view mounts only once the root has finished leaving, so asking
  for its tiles there put a round trip after the view was already on screen.
*/
const THUMBNAIL_SOURCES = [
	...SETUP_OPTIONS,
	...ENVIRONMENT_OPTIONS.flatMap(({ options }) => options)
].map(({ src }) => src)

const RESOLUTION_OPTIONS: EnvironmentResolution[] = ['1k', '4k']

const BRIGHTNESS_PRESETS: SliderPreset[] = [
	{ value: 0.3, label: 'Dim' },
	{ value: 1, label: 'Normal' },
	{ value: 2.5, label: 'Bright' }
]

const OCCLUSION_PRESETS: SliderPreset[] = [
	{ value: 0.8, label: 'Light' },
	{ value: 1.4, label: 'Normal' },
	{ value: 3, label: 'Deep' }
]

const LightingSettings = () => {
	for (const src of THUMBNAIL_SOURCES) preload(src, { as: 'image' })

	const draft = useLightingDraft()
	const { lighting, commit, preview } = draft
	const environmentLoadFailed = useAtomValue(environmentLoadFailedAtom)
	const view = useAtomValue(viewDirectionAtom)
	const [path, setPath] = useState<string[]>([])

	const resolved = resolveLighting({ lighting })
	const { environment, occlusion, bake } = resolved
	const bakePreview = useBakePreview()
	const setup = matchingSetup(lighting)
	const enabledLights = resolved.lights.filter((light) => light.enabled)

	const depth = occlusion.mode === 'baked'
	const status = finishStatus(bakePreview.bakesAnything, bakePreview.preview)

	/*
	  Adding the finish previews it too, once the render with the new lighting
	  has given `bake` the request to draw: called from the click, it would
	  draw what the lighting asked for before.
	*/
	const [previewQueued, setPreviewQueued] = useState(false)
	const { canBake, bake: drawPreview, bakesAnything } = bakePreview
	useEffect(() => {
		if (!previewQueued) return
		// Turned off again before it could draw: nobody is waiting for it now.
		if (!bakesAnything) setPreviewQueued(false)
		else if (canBake) {
			setPreviewQueued(false)
			void drawPreview()
		}
	}, [previewQueued, bakesAnything, canBake, drawPreview])

	const addFinish = () => {
		commit((prev) =>
			withFinish(prev, { depth: true, lights: enabledLights.length > 0 })
		)
		setPreviewQueued(true)
	}

	const selectSetup = (id: LightingSetupId) => {
		const chosen = LIGHTING_SETUPS.find((entry) => entry.id === id)
		if (chosen) commit((prev) => withSetup(prev, chosen))
	}

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Lighting">
			<DrillDownView id="root">
				<SettingGroup label="Setup" value={setup?.label ?? 'Custom'}>
					<ThumbnailGrid
						label="Lighting setup"
						options={SETUP_OPTIONS}
						value={setup?.id}
						onSelect={selectSetup}
					/>
				</SettingGroup>

				<SettingGroup
					label="Turn"
					value={formatDegrees(wrapDegrees(environment.rotation))}
				>
					<LightingGlobe
						rotation={wrapDegrees(environment.rotation)}
						map={environment.map}
						lights={resolved.lights}
						view={view ?? undefined}
						onRotationChange={(rotation) =>
							preview((prev) => ({
								...prev,
								environment: { ...prev.environment, rotation }
							}))
						}
					/>
				</SettingGroup>

				<div className="space-y-2">
					<DrillDownTrigger
						to="environment"
						icon={<Globe />}
						label="Environment"
						summary={environmentLabel(environment.map)}
					/>
					<DrillDownTrigger
						to="lights"
						icon={<Lightbulb />}
						label="Lights"
						summary={
							enabledLights.length === 0
								? 'None'
								: enabledLights
										.map((light) => LIGHT_LABELS[light.role].split(' ')[0])
										.join(', ')
						}
					/>
				</div>

				<StudioFinishCard
					status={status}
					progress={bakePreview.preview?.progress}
					nothingCaption={nothingCaption(bakePreview.preview?.reports)}
					canPreview={bakePreview.canBake}
					isOptimizing={bakePreview.isOptimizing}
					onAdd={addFinish}
					onPreview={() => void bakePreview.bake()}
					onShownChange={bakePreview.setShown}
				/>

				<Toggle
					label="Ground shadow"
					description="A floor under the model that catches the shadows its lights cast."
					checked={resolved.ground.enabled}
					onCheckedChange={(enabled) =>
						commit((prev) => ({ ...prev, ground: { enabled } }))
					}
				/>
			</DrillDownView>

			<DrillDownView
				id="environment"
				title="Environment"
				caption="The image the scene is lit and reflected by. Picking one keeps the lights where they are."
			>
				{ENVIRONMENT_OPTIONS.map(({ group, options }) => (
					<SettingGroup
						key={group}
						label={group.charAt(0).toUpperCase() + group.slice(1)}
					>
						<ThumbnailGrid
							label={`${group} environments`}
							options={options}
							value={environment.map}
							onSelect={(map) =>
								commit((prev) => ({
									...prev,
									environment: { ...prev.environment, map }
								}))
							}
						/>
					</SettingGroup>
				))}
				{/* `alert`, which is announced as it appears, unlike an inserted `status`. */}
				{environmentLoadFailed && (
					<p role="alert" className="text-destructive text-xs">
						This map could not be loaded, so the scene is lit by a neutral room
						instead.
					</p>
				)}

				<Slider
					label="Brightness"
					min={0}
					max={5}
					step={0.01}
					mapping={valueMappings.quadratic}
					presets={BRIGHTNESS_PRESETS}
					value={environment.intensity}
					onValueChange={(intensity) =>
						preview((prev) => ({
							...prev,
							environment: { ...prev.environment, intensity }
						}))
					}
				/>

				<SettingGroup
					label="Resolution"
					description="4k sharpens reflections on glossy models and takes longer to download."
				>
					<ToggleGroup
						type="single"
						aria-label="Environment resolution"
						value={environment.resolution}
						onValueChange={(value) => {
							if (value)
								commit((prev) => ({
									...prev,
									environment: {
										...prev.environment,
										resolution: value as EnvironmentResolution
									}
								}))
						}}
					>
						{RESOLUTION_OPTIONS.map((resolution) => (
							<ToggleGroupItem key={resolution} value={resolution}>
								{resolution}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</SettingGroup>
			</DrillDownView>

			<DrillDownView id="lights" title="Lights" caption={LIGHTS_CAPTION}>
				<LightList {...draft} />
			</DrillDownView>
			{LIGHT_ROLES.map((role) => (
				<DrillDownView
					key={role}
					id={lightViewId(role)}
					title={LIGHT_LABELS[role]}
					caption={LIGHT_CAPTIONS[role]}
				>
					<LightSettings role={role} {...draft} />
				</DrillDownView>
			))}

			<DrillDownView
				id="finish"
				title="Studio finish"
				caption="Drawn into the model's own textures when you publish, so any viewer shows it at no cost. It holds one pose and suits matte products best."
			>
				<Toggle
					label="Depth"
					description="Darkens creases and tight gaps. Any glTF viewer shows it."
					checked={depth}
					onCheckedChange={(on) =>
						commit((prev) => withFinish(prev, { depth: on }))
					}
				/>
				<Toggle
					label="Studio lights"
					description="Their light and soft shadows, written into a light map. Other glTF viewers show the model without them."
					checked={bake.lights}
					onCheckedChange={(lights) =>
						commit((prev) => withFinish(prev, { lights }))
					}
				/>
				{bake.lights && enabledLights.length === 0 && (
					<PanelCaption>Turn a light on to draw it in.</PanelCaption>
				)}

				{bakePreview.bakesAnything && (
					<BakeSection
						preview={bakePreview.preview}
						canBake={bakePreview.canBake}
						isOptimizing={bakePreview.isOptimizing}
						isAnimated={bakePreview.isAnimated}
						onBake={() => void bakePreview.bake()}
						onShownChange={bakePreview.setShown}
					/>
				)}

				<SettingGroup
					label="Live occlusion"
					description={
						depth
							? 'Depth from the studio finish takes its place.'
							: "Darkens creases as the view moves, drawn every frame. 'Only when still' skips it while orbiting."
					}
				>
					{!depth && (
						<ToggleGroup
							type="single"
							aria-label="Live occlusion"
							value={occlusion.mode}
							onValueChange={(mode) => {
								if (mode)
									commit((prev) => ({
										...prev,
										occlusion: {
											...prev.occlusion,
											mode: mode as LiveOcclusionMode
										}
									}))
							}}
						>
							{OCCLUSION_MODES.map((entry) => (
								<ToggleGroupItem key={entry.mode} value={entry.mode}>
									{entry.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					)}
				</SettingGroup>

				{occlusion.mode === 'live' && (
					<>
						<Toggle
							label="Only when still"
							checked={occlusion.live.atRest}
							onCheckedChange={(atRest) =>
								commit((prev) => ({
									...prev,
									occlusion: {
										...prev.occlusion,
										live: { ...prev.occlusion?.live, atRest }
									}
								}))
							}
						/>
						<Slider
							label="Strength"
							min={0.5}
							max={4}
							step={0.1}
							presets={OCCLUSION_PRESETS}
							value={occlusion.live.intensity}
							onValueChange={(intensity) =>
								preview((prev) => ({
									...prev,
									occlusion: {
										...prev.occlusion,
										live: { ...prev.occlusion?.live, intensity }
									}
								}))
							}
						/>
					</>
				)}
			</DrillDownView>
		</DrillDown>
	)
}

export default LightingSettings
