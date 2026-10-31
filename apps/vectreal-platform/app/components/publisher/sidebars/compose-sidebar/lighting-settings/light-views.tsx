import { Button } from '@shared/components/ui/button'
import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import { Toggle } from '@shared/components/ui/toggle'
import { valueMappings } from '@shared/utils'
import { resolveLighting } from '@vctrl/core'
import { Plus, Trash2 } from 'lucide-react'

import {
	hexToKelvin,
	kelvinToHex,
	MAX_KELVIN,
	MIN_KELVIN,
	NEUTRAL_KELVIN
} from './color-temperature'
import {
	LIGHT_ROLES,
	withLight,
	withLightAdded,
	withLightRemoved,
	wrapDegrees
} from './lighting-edits'
import { DrillDownTrigger, useDrillDownNavigation } from '../../drill-down'

import type { useLightingDraft } from './use-lighting-draft'
import type { SceneLightRole } from '@vctrl/core'

type LightingDraft = ReturnType<typeof useLightingDraft>

export const LIGHT_LABELS: Record<SceneLightRole, string> = {
	key: 'Key light',
	fill: 'Fill light',
	rim: 'Rim light'
}

export const LIGHT_CAPTIONS: Record<SceneLightRole, string> = {
	key: 'The main light. It shapes the model and casts the shadow it stands on. Drag the handle in the scene to move it.',
	fill: 'Softens the shadows the key leaves on the model. Drag the handle in the scene to move it.',
	rim: 'Lights the model from behind, to lift its edge off the background. Drag the handle in the scene to move it.'
}

/** The view id of a light's own settings. */
export const lightViewId = (role: SceneLightRole) => `light-${role}`

const STRENGTH_PRESETS: SliderPreset[] = [
	{ value: 0.3, label: 'Subtle' },
	{ value: 1, label: 'Even' },
	{ value: 3, label: 'Strong' }
]

const SOFTNESS_PRESETS: SliderPreset[] = [
	{ value: 5, label: 'Crisp' },
	{ value: 25, label: 'Soft' },
	{ value: 70, label: 'Diffuse' }
]

const HEIGHT_PRESETS: SliderPreset[] = [
	{ value: 15, label: 'Low' },
	{ value: 45, label: 'Mid' },
	{ value: 85, label: 'Overhead' }
]

const COLOR_PRESETS: SliderPreset[] = [
	{ value: 3200, label: 'Warm' },
	{ value: NEUTRAL_KELVIN, label: 'Neutral' },
	{ value: 9000, label: 'Cool' }
]

const formatDegrees = (value: number) => `${Math.round(value)}°`

export const LIGHTS_CAPTION =
	"Up to three studio lights, placed on the environment's own bright spots. Every shadow in the scene comes from them."

/** One row per light, and a way to add the roles the setup has none for. */
export function LightList({ lighting, commit }: LightingDraft) {
	const lights = lighting.lights ?? []
	const missing = LIGHT_ROLES.filter(
		(role) => !lights.some((light) => light.role === role)
	)
	const { push } = useDrillDownNavigation()

	return (
		<>
			<div className="space-y-2">
				{resolveLighting({ lighting }).lights.map((light) => (
					<DrillDownTrigger
						key={light.role}
						to={lightViewId(light.role)}
						label={LIGHT_LABELS[light.role]}
						summary={light.enabled ? `${light.intensity.toFixed(1)}×` : 'Off'}
					/>
				))}
			</div>
			{missing.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{missing.map((role) => (
						<Button
							key={role}
							variant="ghost"
							size="sm"
							onClick={() => {
								commit((prev) => withLightAdded(prev, role))
								push(lightViewId(role), lightViewId(role))
							}}
						>
							<Plus aria-hidden />
							Add {LIGHT_LABELS[role].toLowerCase()}
						</Button>
					))}
				</div>
			)}
		</>
	)
}

/** A light's own settings. */
export function LightSettings({
	role,
	lighting,
	commit,
	preview
}: LightingDraft & { role: SceneLightRole }) {
	const { pop } = useDrillDownNavigation()
	const light = resolveLighting({ lighting }).lights.find(
		(entry) => entry.role === role
	)

	if (!light) return null

	return (
		<>
			<Toggle
				label="On"
				checked={light.enabled}
				onCheckedChange={(enabled) =>
					commit((prev) => withLight(prev, role, { enabled }))
				}
			/>
			<Slider
				label="Strength"
				min={0}
				max={5}
				step={0.05}
				mapping={valueMappings.quadratic}
				presets={STRENGTH_PRESETS}
				formatValue={(value) => `${value.toFixed(2)}×`}
				disabled={!light.enabled}
				value={light.intensity}
				onValueChange={(intensity) =>
					preview((prev) => withLight(prev, role, { intensity }))
				}
			/>
			<Slider
				label="Softness"
				min={1}
				max={120}
				step={1}
				mapping={valueMappings.quadratic}
				presets={SOFTNESS_PRESETS}
				formatValue={formatDegrees}
				disabled={!light.enabled}
				value={light.size}
				onValueChange={(size) =>
					preview((prev) => withLight(prev, role, { size }))
				}
			/>
			<Slider
				label="Direction"
				min={-180}
				max={180}
				step={1}
				formatValue={formatDegrees}
				disabled={!light.enabled}
				value={wrapDegrees(light.azimuth)}
				onValueChange={(azimuth) =>
					preview((prev) => withLight(prev, role, { azimuth }))
				}
			/>
			<Slider
				label="Height"
				min={0}
				max={90}
				step={1}
				presets={HEIGHT_PRESETS}
				formatValue={formatDegrees}
				disabled={!light.enabled}
				value={light.elevation}
				onValueChange={(elevation) =>
					preview((prev) => withLight(prev, role, { elevation }))
				}
			/>
			<Slider
				label="Color"
				min={MIN_KELVIN}
				max={MAX_KELVIN}
				step={100}
				presets={COLOR_PRESETS}
				formatValue={(value) => `${value} K`}
				disabled={!light.enabled}
				value={hexToKelvin(light.color)}
				onValueChange={(kelvin) =>
					preview((prev) =>
						withLight(prev, role, { color: kelvinToHex(kelvin) })
					)
				}
			/>
			<Button
				variant="ghost"
				size="sm"
				className="text-destructive self-start"
				onClick={() => {
					pop()
					commit((prev) => withLightRemoved(prev, role))
				}}
			>
				<Trash2 aria-hidden />
				Remove light
			</Button>
		</>
	)
}
