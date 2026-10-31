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
	type LightingSetupId,
	type SceneLightRole
} from '@vctrl/core'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { Contrast, Globe, Image as ImageIcon, Lightbulb } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
	LIGHT_CAPTIONS,
	LIGHT_LABELS,
	LIGHTS_CAPTION,
	LightList,
	LightSettings,
	lightViewId
} from './light-views'
import {
	type BackgroundType,
	backgroundOfType,
	LIGHT_ROLES,
	matchingSetup,
	withSetup,
	wrapDegrees
} from './lighting-edits'
import StageColorField from './stage-color-field'
import { ThumbnailGrid } from './thumbnail-grid'
import { useLightingDraft } from './use-lighting-draft'
import {
	environmentThumbnail,
	lightingSetupThumbnail
} from '../../../../../lib/lighting/lighting-thumbnails'
import {
	editedLightRoleAtom,
	environmentLoadFailedAtom
} from '../../../../../lib/stores/publisher-config-store'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../../drill-down'
import { SettingGroup } from '../../sidebar-section'

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

const TURN_PRESETS: SliderPreset[] = [
	{ value: -90, label: 'Left' },
	{ value: 0, label: 'Front' },
	{ value: 90, label: 'Right' }
]

const BRIGHTNESS_PRESETS: SliderPreset[] = [
	{ value: 0.3, label: 'Dim' },
	{ value: 1, label: 'Normal' },
	{ value: 2.5, label: 'Bright' }
]

const BACKGROUND_BLUR_PRESETS: SliderPreset[] = [
	{ value: 0, label: 'Sharp' },
	{ value: 0.3, label: 'Soft' },
	{ value: 0.8, label: 'Blurred' }
]

const OCCLUSION_PRESETS: SliderPreset[] = [
	{ value: 0.8, label: 'Light' },
	{ value: 1.4, label: 'Normal' },
	{ value: 3, label: 'Deep' }
]

const BACKGROUNDS: { type: BackgroundType; label: string; summary: string }[] =
	[
		{ type: 'none', label: 'None', summary: 'Transparent' },
		{ type: 'color', label: 'Color', summary: 'Color' },
		{ type: 'gradient', label: 'Gradient', summary: 'Gradient' },
		{ type: 'environment', label: 'HDRI', summary: 'Environment' }
	]

const BACKGROUND_CAPTIONS: Record<BackgroundType, string> = {
	none: 'Nothing behind the model: an embed shows the page it sits on, and the ground shadow lands on it.',
	color:
		'A flat stage behind the model, for its shadow to land on. The environment still lights it.',
	gradient:
		'A stage that shades from top to bottom, for the shadow to land on. The environment still lights it.',
	environment:
		'The environment map fills the view behind the model. It has no floor, so a ground shadow has nothing to land on.'
}

const formatDegrees = (value: number) => `${Math.round(value)}°`

/** The light whose handle the scene shows: the one open, else the key. */
const roleOpenIn = (path: string[]): SceneLightRole =>
	LIGHT_ROLES.find((role) => path.includes(lightViewId(role))) ?? 'key'

const LightingSettings = () => {
	const draft = useLightingDraft()
	const { lighting, commit, preview } = draft
	const environmentLoadFailed = useAtomValue(environmentLoadFailedAtom)
	const setEditedLightRole = useSetAtom(editedLightRoleAtom)
	const [path, setPath] = useState<string[]>([])

	const editedRole = roleOpenIn(path)
	useEffect(() => {
		setEditedLightRole(editedRole)
		return () => setEditedLightRole(null)
	}, [editedRole, setEditedLightRole])

	const resolved = resolveLighting({ lighting })
	const { environment, background, occlusion } = resolved
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

				<Slider
					label="Turn"
					min={-180}
					max={180}
					step={1}
					presets={TURN_PRESETS}
					formatValue={formatDegrees}
					value={wrapDegrees(environment.rotation)}
					onValueChange={(rotation) =>
						preview((prev) => ({
							...prev,
							environment: { ...prev.environment, rotation }
						}))
					}
				/>

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
						to="background"
						icon={<ImageIcon />}
						label="Background"
						summary={
							BACKGROUNDS.find((entry) => entry.type === background.type)
								?.summary
						}
					/>
					<DrillDownTrigger
						to="occlusion"
						icon={<Contrast />}
						label="Ambient occlusion"
						summary={occlusion.mode === 'live' ? 'On' : 'Off'}
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
				id="background"
				title="Background"
				caption={BACKGROUND_CAPTIONS[background.type]}
			>
				<ToggleGroup
					type="single"
					aria-label="Background"
					value={background.type}
					onValueChange={(value) => {
						if (value)
							commit((prev) => ({
								...prev,
								background: backgroundOfType(
									value as BackgroundType,
									prev.background
								)
							}))
					}}
				>
					{BACKGROUNDS.map((entry) => (
						<ToggleGroupItem key={entry.type} value={entry.type}>
							{entry.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>

				{background.type === 'environment' && (
					<>
						<Slider
							label="Blur"
							min={0}
							max={1}
							step={0.01}
							presets={BACKGROUND_BLUR_PRESETS}
							value={background.blur ?? 0}
							onValueChange={(blur) =>
								preview((prev) => ({
									...prev,
									background: { ...background, blur }
								}))
							}
						/>
						<Slider
							label="Brightness"
							min={0}
							max={3}
							step={0.01}
							mapping={valueMappings.quadratic}
							presets={BRIGHTNESS_PRESETS}
							value={background.intensity ?? 1}
							onValueChange={(intensity) =>
								preview((prev) => ({
									...prev,
									background: { ...background, intensity }
								}))
							}
						/>
					</>
				)}

				{background.type === 'color' && (
					<StageColorField
						label="Color"
						value={background.color}
						onChange={(color) =>
							preview((prev) => ({
								...prev,
								background: { type: 'color', color }
							}))
						}
					/>
				)}

				{background.type === 'gradient' && (
					<>
						<StageColorField
							label="Top"
							value={background.top}
							onChange={(top) =>
								preview((prev) =>
									prev.background?.type === 'gradient'
										? { ...prev, background: { ...prev.background, top } }
										: prev
								)
							}
						/>
						<StageColorField
							label="Bottom"
							value={background.bottom}
							onChange={(bottom) =>
								preview((prev) =>
									prev.background?.type === 'gradient'
										? { ...prev, background: { ...prev.background, bottom } }
										: prev
								)
							}
						/>
					</>
				)}
			</DrillDownView>

			<DrillDownView
				id="occlusion"
				title="Ambient occlusion"
				caption="Darkens creases and tight gaps on the model. It is drawn every frame while the view moves; 'Only when still' skips it during orbiting."
			>
				<Toggle
					label="Ambient occlusion"
					checked={occlusion.mode === 'live'}
					onCheckedChange={(on) =>
						commit((prev) => ({
							...prev,
							occlusion: { ...prev.occlusion, mode: on ? 'live' : 'off' }
						}))
					}
				/>
				<Toggle
					label="Only when still"
					disabled={occlusion.mode !== 'live'}
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
					disabled={occlusion.mode !== 'live'}
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
			</DrillDownView>
		</DrillDown>
	)
}

export default LightingSettings
