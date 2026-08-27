import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { Label } from '@shared/components/ui/label'
import { Switch } from '@shared/components/ui/switch'
import { useAtom } from 'jotai/react'
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
import { InfoTooltip } from '../../../../info-tooltip'
import { InlineNotice } from '../../../../layout-components'
import {
	EnhancedSettingSlider,
	SettingToggle,
	ToggleButtonGroup
} from '../../../settings-components'
import { CollapsibleSectionTrigger } from '../../accordion-components'
import {
	SettingGroup,
	SidebarSection,
	SidebarSectionContent
} from '../../sidebar-section'

/**
 * The presets as `ToggleButtonGroup` wants them.
 *
 * The grid these replaced expressed "active" as a solid `bg-primary` fill — a
 * fourth selection language in the compose panels, and the same defect as the
 * hotspot row this change started from. `description` was a `title=` hover
 * tooltip, invisible on touch and to the keyboard; as `subLabel` it is simply
 * on screen.
 */
const PRESET_OPTIONS: ToggleButtonGroupOption<string>[] = SHADOW_PRESETS.map(
	(preset) => ({
		value: preset.id,
		label: preset.label,
		subLabel: preset.description
	})
)

import type { FieldConfig } from '../../../../../types/settings-field'
import type { ToggleButtonGroupOption } from '../../../settings-components'
import type { ShadowsProps } from '@vctrl/core'

interface ShadowFieldProps {
	field: FieldConfig
	idPrefix: string
	value: number
	onChange: (key: string, value: number) => void
}

const ShadowField = ({
	field,
	idPrefix,
	value,
	onChange
}: ShadowFieldProps) => (
	<EnhancedSettingSlider
		id={`${idPrefix}-${field.key}`}
		sliderProps={{
			min: field.min,
			max: field.max,
			step: field.step,
			value: value ?? field.min,
			onChange: (v) => onChange(field.key, v)
		}}
		label={field.label}
		tooltip={field.tooltip}
		labelProps={{ low: `${field.min}`, high: `${field.max}` }}
		formatValue={field.formatValue}
		valueMapping={field.valueMapping}
		allowDirectInput
	/>
)

const COMMIT_DELAY_MS = 250

const ShadowSettingsPanel = () => {
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [advancedOpen, setAdvancedOpen] = useState(false)

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

	const shadowsEnabled = draft.enabled ?? false

	const handleToggleShadows = (enabled: boolean) => {
		if (commitTimer.current) clearTimeout(commitTimer.current)
		const next = { ...draft, enabled }
		setDraft(next)
		setShadows(next)
	}

	// Presets set several params at once, so commit immediately (no per-tick
	// debounce) for a single, snappy re-bake.
	const handleApplyPreset = (preset: ShadowPreset) => {
		if (commitTimer.current) clearTimeout(commitTimer.current)
		const next: ShadowsProps = {
			...draft,
			opacity: preset.values.opacity,
			light: {
				...draft.light,
				ambient: preset.values.light.ambient,
				radius: preset.values.light.radius,
				position: preset.values.light.position
			}
		}
		setDraft(next)
		setShadows(next)
	}

	// Boolean toggles commit immediately — a single click, not a drag, so there is
	// no per-tick re-bake to debounce.
	const handleToggleAo = (value: boolean) => {
		if (commitTimer.current) clearTimeout(commitTimer.current)
		const next: ShadowsProps = {
			...draft,
			ao: value,
			// Seed a sensible strength the first time AO is turned on so its slider
			// (min 0.5) isn't left below range on scenes saved before AO existed.
			...(value && draft.aoIntensity == null ? { aoIntensity: 1.4 } : {})
		}
		setDraft(next)
		setShadows(next)
	}

	// The ground (contact) shadow's enabled flag is nested under `contact`.
	const handleToggleContact = (value: boolean) => {
		if (commitTimer.current) clearTimeout(commitTimer.current)
		const next: ShadowsProps = {
			...draft,
			contact: { ...draft.contact, enabled: value }
		}
		setDraft(next)
		setShadows(next)
	}

	const activePresetId =
		SHADOW_PRESETS.find(
			(preset) =>
				preset.values.opacity === draft.opacity &&
				preset.values.light.ambient === draft.light?.ambient &&
				preset.values.light.radius === draft.light?.radius
		)?.id ?? null

	const handleFieldChange = (key: string, value: number | string) => {
		// "Darkness" is a virtual control: it drives the bake light's ambient fill
		// (inverted — more darkness = less fill = a deeper shadow core).
		if (key === SHADOW_DARKNESS_KEY) {
			scheduleCommit({
				...draft,
				light: {
					...draft.light,
					ambient: darknessToAmbient(value as number)
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

	return (
		/*
		  Titleless on purpose. `DynamicSidebar` already draws "Shadows" and the
		  tool's description above this panel, so a section of the same name printed
		  the word twice - the defect the Hotspots panel was rebuilt to remove.
		  The master switch is a setting rather than section chrome, so it says so.
		*/
		<SidebarSection>
			<SidebarSectionContent>
				<SettingToggle
					enabled={shadowsEnabled}
					onToggle={handleToggleShadows}
					title="Cast shadows"
					description="Ground the model with a directional shadow."
					info="Configure shadow quality in your scene."
				/>

				{!shadowsEnabled && (
					<InlineNotice tone="neutral">
						Turn on shadows to configure their quality.
					</InlineNotice>
				)}

				{shadowsEnabled && (
					<div className="space-y-4">
						<SettingGroup label="Presets">
							<ToggleButtonGroup
								options={PRESET_OPTIONS}
								isActive={(id) => activePresetId === id}
								onChange={(id) => {
									const preset = SHADOW_PRESETS.find((entry) => entry.id === id)
									if (preset) handleApplyPreset(preset)
								}}
							/>
						</SettingGroup>

						<SettingGroup label="Directional shadow">
							{SHADOW_PRIMARY_FIELDS.map((field) => (
								<ShadowField
									key={field.key}
									field={field}
									idPrefix="shadow"
									value={getFieldValue(field.key)}
									onChange={handleFieldChange}
								/>
							))}
						</SettingGroup>

						<SettingGroup
							label="Ground shadow"
							action={
								<div className="flex items-center gap-2">
									<InfoTooltip content="A soft shadow pooled under the model that approximates the ambient occlusion it casts on the floor. It's independent of the directional light, so the model stays grounded even when the main shadow is cast off to the side. Raise Softness to keep it diffuse." />
									<Switch
										id="shadow-ground-toggle"
										aria-label="Enable ground shadow"
										checked={draft.contact?.enabled ?? false}
										onCheckedChange={handleToggleContact}
									/>
								</div>
							}
						>
							{(draft.contact?.enabled ?? false) &&
								SHADOW_CONTACT_FIELDS.map((field) => (
									<ShadowField
										key={field.key}
										field={field}
										idPrefix="shadow-contact"
										value={getFieldValue(field.key)}
										onChange={handleFieldChange}
									/>
								))}
						</SettingGroup>

						<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
							<CollapsibleSectionTrigger isOpen={advancedOpen}>
								Advanced
							</CollapsibleSectionTrigger>
							<CollapsibleContent className="space-y-4 pt-3">
								{SHADOW_ADVANCED_FIELDS.map((field) => (
									<ShadowField
										key={field.key}
										field={field}
										idPrefix="shadow-adv"
										value={getFieldValue(field.key)}
										onChange={handleFieldChange}
									/>
								))}

								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<Label htmlFor="shadow-ao-toggle" className="text-sm">
											Ambient occlusion
										</Label>
										<InfoTooltip content="Darkens crevices and tight gaps on the model itself (screen-space). Higher quality but runs every frame, so it costs GPU — best for hero shots on capable devices." />
									</div>
									<Switch
										id="shadow-ao-toggle"
										checked={draft.ao ?? false}
										onCheckedChange={handleToggleAo}
									/>
								</div>

								{(draft.ao ?? false) && (
									<ShadowField
										field={SHADOW_AO_INTENSITY_FIELD}
										idPrefix="shadow-adv"
										value={getFieldValue(SHADOW_AO_INTENSITY_FIELD.key)}
										onChange={handleFieldChange}
									/>
								)}
							</CollapsibleContent>
						</Collapsible>
					</div>
				)}
			</SidebarSectionContent>
		</SidebarSection>
	)
}

export default ShadowSettingsPanel
