import { Toggle } from '@shared/components/ui/toggle'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { useAtom } from 'jotai/react'
import {
	Circle,
	Contrast,
	Pause,
	SlidersHorizontal,
	Sun,
	SunDim
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
	ambientToDarkness,
	darknessToAmbient,
	SHADOW_ADVANCED_FIELDS,
	SHADOW_AO_INTENSITY_FIELD,
	SHADOW_CONTACT_FIELDS,
	SHADOW_DARKNESS_KEY,
	SHADOW_PRESETS,
	SHADOW_PRIMARY_FIELDS,
	type ShadowPreset
} from './constants'
import { shadowsAtom } from '../../../../../lib/stores/scene-settings-store'
import { InlineNotice } from '../../../../layout-components'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../../drill-down'
import { FieldSlider } from '../../field-slider'
import { SettingGroup } from '../../sidebar-section'

import type { ShadowsProps } from '@vctrl/core'

const COMMIT_DELAY_MS = 250

const ShadowSettingsPanel = () => {
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [path, setPath] = useState<string[]>([])

	// Local draft so dragging a slider stays responsive without re-baking the
	// accumulative shadow on every tick (each prop change resets the bake and
	// flickers). The draft is committed to the atom — triggering a single
	// re-bake — shortly after the user stops dragging.
	const [draft, setDraft] = useState<ShadowsProps>(shadows)
	const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		setDraft(shadows)
	}, [shadows])

	useEffect(
		() => () => {
			if (commitTimer.current) clearTimeout(commitTimer.current)
		},
		[]
	)

	const scheduleCommit = useCallback(
		(next: ShadowsProps) => {
			setDraft(next)
			if (commitTimer.current) clearTimeout(commitTimer.current)
			commitTimer.current = setTimeout(() => setShadows(next), COMMIT_DELAY_MS)
		},
		[setShadows]
	)

	/**
	 * Commits at once, dropping any pending slider commit. For a click rather
	 * than a drag (a switch, a preset), so there is no per-tick re-bake to
	 * debounce, and a preset sets several params in one snappy re-bake.
	 */
	const commitNow = useCallback(
		(next: ShadowsProps) => {
			if (commitTimer.current) clearTimeout(commitTimer.current)
			setDraft(next)
			setShadows(next)
		},
		[setShadows]
	)

	const shadowsEnabled = draft.enabled ?? false

	const handleApplyPreset = (preset: ShadowPreset) =>
		commitNow({
			...draft,
			opacity: preset.values.opacity,
			light: {
				...draft.light,
				ambient: preset.values.light.ambient,
				radius: preset.values.light.radius,
				position: preset.values.light.position
			}
		})

	const handleToggleAo = (value: boolean) =>
		commitNow({
			...draft,
			ao: value,
			// Seed a sensible strength the first time AO is turned on so its slider
			// (min 0.5) isn't left below range on scenes saved before AO existed.
			...(value && draft.aoIntensity == null ? { aoIntensity: 1.4 } : {})
		})

	const activePreset = SHADOW_PRESETS.find(
		(preset) =>
			preset.values.opacity === draft.opacity &&
			preset.values.light.ambient === draft.light?.ambient &&
			preset.values.light.radius === draft.light?.radius
	)

	const handleFieldChange = (key: string, value: number) => {
		// "Darkness" is a virtual control: it drives the bake light's ambient fill
		// (inverted — more darkness = less fill = a deeper shadow core).
		if (key === SHADOW_DARKNESS_KEY) {
			scheduleCommit({
				...draft,
				light: {
					...draft.light,
					ambient: darknessToAmbient(value)
				}
			})
			return
		}

		// Nested drei RandomizedLight params (e.g. "light.radius") are merged into
		// the accumulative shadow's light config; everything else is a top-level prop.
		if (key.startsWith('light.')) {
			const lightKey = key.slice('light.'.length)
			scheduleCommit({
				...draft,
				light: { ...draft.light, [lightKey]: value }
			})
			return
		}

		// Nested contact/ground-shadow params (e.g. "contact.blur").
		if (key.startsWith('contact.')) {
			const contactKey = key.slice('contact.'.length)
			scheduleCommit({
				...draft,
				contact: { ...draft.contact, [contactKey]: value }
			})
			return
		}

		scheduleCommit({ ...draft, [key]: value })
	}

	const getFieldValue = (key: string) => {
		if (key === SHADOW_DARKNESS_KEY) {
			return ambientToDarkness(draft.light?.ambient ?? 0.3)
		}

		if (key.startsWith('light.')) {
			const lightKey = key.slice('light.'.length)
			return (
				(draft.light?.[
					lightKey as keyof NonNullable<ShadowsProps['light']>
				] as number) ?? 0
			)
		}

		if (key.startsWith('contact.')) {
			const contactKey = key.slice('contact.'.length)
			return (
				(draft.contact?.[
					contactKey as keyof NonNullable<ShadowsProps['contact']>
				] as number) ?? 0
			)
		}

		return (draft[key as keyof ShadowsProps] as number) ?? 0
	}

	const contactEnabled = draft.contact?.enabled ?? false
	const aoEnabled = draft.ao ?? false

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Shadows">
			<DrillDownView id="root">
				<div className="grid grid-cols-3 gap-2">
					<Toggle
						layout="tile"
						label="Cast shadows"
						icon={<SunDim />}
						checked={shadowsEnabled}
						onCheckedChange={(enabled) => commitNow({ ...draft, enabled })}
					/>
				</div>

				{shadowsEnabled ? (
					<>
						<SettingGroup
							label="Preset"
							description="Sets opacity, darkness, softness and light angle together."
						>
							<ToggleGroup
								type="single"
								aria-label="Shadow preset"
								value={activePreset?.id ?? ''}
								onValueChange={(id) => {
									const preset = SHADOW_PRESETS.find((entry) => entry.id === id)
									if (preset) handleApplyPreset(preset)
								}}
							>
								{SHADOW_PRESETS.map((preset) => (
									<ToggleGroupItem key={preset.id} value={preset.id}>
										{preset.label}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</SettingGroup>

						<div className="space-y-2">
							<DrillDownTrigger
								to="directional"
								icon={<Sun />}
								label="Directional shadow"
								summary={activePreset?.label ?? 'Custom'}
							/>
							<DrillDownTrigger
								to="ground"
								icon={<Circle />}
								label="Ground shadow"
								summary={contactEnabled ? 'On' : 'Off'}
							/>
							<DrillDownTrigger
								to="advanced"
								icon={<SlidersHorizontal />}
								label="Advanced"
								summary={aoEnabled ? 'AO on' : undefined}
							/>
						</div>
					</>
				) : (
					<InlineNotice tone="neutral">
						Turn on shadows to configure their quality.
					</InlineNotice>
				)}
			</DrillDownView>

			<DrillDownView
				id="directional"
				title="Directional shadow"
				caption="The baked shadow cast by the scene light. Drag the light handle in the scene to change its angle."
			>
				{SHADOW_PRIMARY_FIELDS.map((field) => (
					<FieldSlider
						key={field.key}
						field={field}
						value={getFieldValue(field.key)}
						onChange={handleFieldChange}
					/>
				))}
			</DrillDownView>

			<DrillDownView
				id="ground"
				title="Ground shadow"
				caption="A soft pool under the model, independent of the light, so it stays grounded."
			>
				<div className="grid grid-cols-3 gap-2">
					<Toggle
						layout="tile"
						label="Ground shadow"
						icon={<Circle />}
						checked={contactEnabled}
						// The ground shadow's enabled flag is nested under `contact`.
						onCheckedChange={(enabled) =>
							commitNow({ ...draft, contact: { ...draft.contact, enabled } })
						}
					/>
				</div>
				{SHADOW_CONTACT_FIELDS.map((field) => (
					<FieldSlider
						key={field.key}
						field={field}
						disabled={!contactEnabled}
						value={getFieldValue(field.key)}
						onChange={handleFieldChange}
					/>
				))}
			</DrillDownView>

			<DrillDownView
				id="advanced"
				title="Advanced"
				caption="Ambient occlusion darkens crevices on the model and costs GPU while the view moves; 'Only when still' skips it during orbiting."
			>
				{SHADOW_ADVANCED_FIELDS.map((field) => (
					<FieldSlider
						key={field.key}
						field={field}
						value={getFieldValue(field.key)}
						onChange={handleFieldChange}
					/>
				))}
				<div className="grid grid-cols-3 gap-2">
					<Toggle
						layout="tile"
						label="Ambient occlusion"
						icon={<Contrast />}
						checked={aoEnabled}
						onCheckedChange={handleToggleAo}
					/>
					<Toggle
						layout="tile"
						label="Only when still"
						icon={<Pause />}
						disabled={!aoEnabled}
						checked={draft.aoAtRest ?? false}
						onCheckedChange={(aoAtRest) => commitNow({ ...draft, aoAtRest })}
					/>
				</div>
				<FieldSlider
					field={SHADOW_AO_INTENSITY_FIELD}
					disabled={!aoEnabled}
					value={getFieldValue(SHADOW_AO_INTENSITY_FIELD.key)}
					onChange={handleFieldChange}
				/>
			</DrillDownView>
		</DrillDown>
	)
}

export default ShadowSettingsPanel
