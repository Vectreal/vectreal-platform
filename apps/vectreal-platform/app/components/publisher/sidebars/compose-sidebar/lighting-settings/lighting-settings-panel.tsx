import { Button } from '@shared/components/ui/button'
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
import { Contrast, Globe, Layers, Lightbulb } from 'lucide-react'
import { useState } from 'react'

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
	withSetup,
	wrapDegrees
} from './lighting-edits'
import { formatDegrees, LightingGlobe } from './lighting-globe'
import { ThumbnailGrid } from './thumbnail-grid'
import { useBakePreview } from './use-bake-preview'
import { useLightingDraft } from './use-lighting-draft'
import {
	environmentThumbnail,
	lightingSetupThumbnail
} from '../../../../../lib/lighting/lighting-thumbnails'
import { environmentLoadFailedAtom } from '../../../../../lib/stores/publisher-config-store'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../../drill-down'
import { PanelCaption, SettingGroup } from '../../sidebar-section'

type OcclusionMode = keyof typeof OCCLUSION_CAPTIONS

const OCCLUSION_CAPTIONS = {
	off: 'Darkens creases and tight gaps on the model. Live draws it as the view moves; Baked writes it into the model when you publish.',
	live: "Drawn every frame while the view moves. 'Only when still' skips it during orbiting.",
	baked:
		"Raytraced into the model's own textures when you publish, so it costs nothing to draw and shows in any glTF viewer."
} as const

/** What the Bake view's trigger says is baked. */
const bakeSummary = (occlusion: boolean, lights: boolean) =>
	occlusion && lights
		? 'Occlusion, lights'
		: occlusion
			? 'Occlusion'
			: lights
				? 'Lights'
				: 'Off'

const OCCLUSION_MODES: { mode: OcclusionMode; label: string }[] = [
	{ mode: 'off', label: 'Off' },
	{ mode: 'live', label: 'Live' },
	{ mode: 'baked', label: 'Baked' }
]

const OCCLUSION_SUMMARY = {
	off: 'Off',
	live: 'Live',
	baked: 'Baked'
} as const satisfies Record<OcclusionMode, string>

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
	const draft = useLightingDraft()
	const { lighting, commit, preview } = draft
	const environmentLoadFailed = useAtomValue(environmentLoadFailedAtom)
	const [path, setPath] = useState<string[]>([])

	const resolved = resolveLighting({ lighting })
	const { environment, occlusion, bake } = resolved
	const bakePreview = useBakePreview()
	const setup = matchingSetup(lighting)
	const enabledLights = resolved.lights.filter((light) => light.enabled)

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
					<DrillDownTrigger
						to="occlusion"
						icon={<Contrast />}
						label="Ambient occlusion"
						summary={OCCLUSION_SUMMARY[occlusion.mode]}
					/>
					<DrillDownTrigger
						to="bake"
						icon={<Layers />}
						label="Bake"
						summary={bakeSummary(occlusion.mode === 'baked', bake.lights)}
					/>
				</div>

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
				id="occlusion"
				title="Ambient occlusion"
				caption={OCCLUSION_CAPTIONS[occlusion.mode]}
			>
				<ToggleGroup
					type="single"
					aria-label="Ambient occlusion"
					value={occlusion.mode}
					onValueChange={(mode) => {
						if (mode)
							commit((prev) => ({
								...prev,
								occlusion: {
									...prev.occlusion,
									mode: mode as OcclusionMode
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

				{occlusion.mode === 'baked' && (
					<Button
						variant="outline"
						className="w-full"
						onClick={() => setPath(['bake'])}
					>
						Preview the bake
					</Button>
				)}
			</DrillDownView>

			<DrillDownView
				id="bake"
				title="Bake"
				caption="Written into the model when you publish. Preview it here before it ships."
			>
				{/*
				  The Ambient occlusion view owns the mode; a second switch here
				  could only guess which mode switching the bake off returns to.
				*/}
				<DrillDownTrigger
					to="occlusion"
					icon={<Contrast />}
					label="Ambient occlusion"
					summary={OCCLUSION_SUMMARY[occlusion.mode]}
				/>
				<Toggle
					label="Studio lights"
					description="Their light and soft shadows, written into a light map. Best on matte products; other glTF viewers show the model without them."
					checked={bake.lights}
					onCheckedChange={(lights) =>
						commit((prev) => ({ ...prev, bake: { ...prev.bake, lights } }))
					}
				/>
				{bake.lights && enabledLights.length === 0 && (
					<PanelCaption>Turn a light on to bake it.</PanelCaption>
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
			</DrillDownView>
		</DrillDown>
	)
}

export default LightingSettings
