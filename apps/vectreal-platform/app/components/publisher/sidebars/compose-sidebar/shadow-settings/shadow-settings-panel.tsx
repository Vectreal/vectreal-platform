import { Button } from '@shared/components/ui/button'
import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { Switch } from '@shared/components/ui/switch'
import { cn } from '@shared/utils'
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
import { EnhancedSettingSlider } from '../../../settings-components'
import { CollapsibleSectionTrigger } from '../../accordion-components'

import type { FieldConfig } from '../../../../../types/settings-field'
import type { ShadowsProps } from '@vctrl/core'

type AccumulativeShadowConfig = Extract<ShadowsProps, { type: 'accumulative' }>

interface ShadowFieldProps {
	field: FieldConfig
	idPrefix: string
	value: number
	onChange: (key: string, value: number) => void
}

const ShadowField = ({ field, idPrefix, value, onChange }: ShadowFieldProps) => (
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
		const accumulative = draft as AccumulativeShadowConfig
		const next = {
			...draft,
			opacity: preset.values.opacity,
			light: {
				...accumulative.light,
				ambient: preset.values.light.ambient,
				radius: preset.values.light.radius,
				position: preset.values.light.position
			}
		} as ShadowsProps
		setDraft(next)
		setShadows(next)
	}

	// Boolean toggles commit immediately — a single click, not a drag, so there is
	// no per-tick re-bake to debounce.
	const handleToggleAo = (value: boolean) => {
		if (commitTimer.current) clearTimeout(commitTimer.current)
		const accumulative = draft as AccumulativeShadowConfig
		const next = {
			...draft,
			ao: value,
			// Seed a sensible strength the first time AO is turned on so its slider
			// (min 0.5) isn't left below range on scenes saved before AO existed.
			...(value && accumulative.aoIntensity == null ? { aoIntensity: 1.4 } : {})
		} as ShadowsProps
		setDraft(next)
		setShadows(next)
	}

	// The ground (contact) shadow's enabled flag is nested under `contact`.
	const handleToggleContact = (value: boolean) => {
		if (commitTimer.current) clearTimeout(commitTimer.current)
		const accumulative = draft as AccumulativeShadowConfig
		const next = {
			...draft,
			contact: { ...accumulative.contact, enabled: value }
		} as ShadowsProps
		setDraft(next)
		setShadows(next)
	}

	const current = draft as AccumulativeShadowConfig
	const activePresetId =
		SHADOW_PRESETS.find(
			(preset) =>
				preset.values.opacity === current.opacity &&
				preset.values.light.ambient === current.light?.ambient &&
				preset.values.light.radius === current.light?.radius
		)?.id ?? null

	const handleFieldChange = (key: string, value: number | string) => {
		// "Darkness" is a virtual control: it drives the bake light's ambient fill
		// (inverted — more darkness = less fill = a deeper shadow core).
		if (key === SHADOW_DARKNESS_KEY) {
			const accumulative = draft as AccumulativeShadowConfig
			scheduleCommit({
				...draft,
				light: {
					...accumulative.light,
					ambient: darknessToAmbient(value as number)
				}
			} as ShadowsProps)
			return
		}

		// Nested drei RandomizedLight params (e.g. "light.radius") are merged into
		// the accumulative shadow's light config; everything else is a top-level prop.
		if (key.startsWith('light.')) {
			const lightKey = key.slice('light.'.length)
			const accumulative = draft as AccumulativeShadowConfig
			scheduleCommit({
				...draft,
				light: { ...accumulative.light, [lightKey]: value }
			} as ShadowsProps)
			return
		}

		// Nested contact/ground-shadow params (e.g. "contact.blur").
		if (key.startsWith('contact.')) {
			const contactKey = key.slice('contact.'.length)
			const accumulative = draft as AccumulativeShadowConfig
			scheduleCommit({
				...draft,
				contact: { ...accumulative.contact, [contactKey]: value }
			} as ShadowsProps)
			return
		}

		scheduleCommit({ ...draft, [key]: value } as ShadowsProps)
	}

	const getFieldValue = (key: string) => {
		if (key === SHADOW_DARKNESS_KEY) {
			const accumulative = draft as AccumulativeShadowConfig
			return ambientToDarkness(accumulative.light?.ambient ?? 0.3)
		}

		if (key.startsWith('light.')) {
			const lightKey = key.slice('light.'.length)
			const accumulative = draft as AccumulativeShadowConfig
			return (
				(accumulative.light?.[
					lightKey as keyof NonNullable<typeof accumulative.light>
				] as number) ?? 0
			)
		}

		if (key.startsWith('contact.')) {
			const contactKey = key.slice('contact.'.length)
			const accumulative = draft as AccumulativeShadowConfig
			return (
				(accumulative.contact?.[
					contactKey as keyof NonNullable<typeof accumulative.contact>
				] as number) ?? 0
			)
		}

		return (draft[key as keyof ShadowsProps] as number) ?? 0
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					Shadows
				</p>
				<div className="flex items-center gap-2">
					<InfoTooltip content="Configure shadow quality in your scene." />
					<Label htmlFor="shadows-enabled-toggle" className="text-sm">
						Enabled
					</Label>
					<Switch
						id="shadows-enabled-toggle"
						checked={shadowsEnabled}
						onCheckedChange={handleToggleShadows}
					/>
				</div>
			</div>
			<Separator />

			{!shadowsEnabled && (
				<p className="text-muted-foreground py-2 text-xs">
					Enable shadows to configure shadow quality.
				</p>
			)}

			{shadowsEnabled && (
				<div className="space-y-4">
					<div className="space-y-2">
						<p className="text-muted-foreground text-xs font-medium">Presets</p>
						<div className="grid grid-cols-3 gap-2">
							{SHADOW_PRESETS.map((preset) => (
								<Button
									key={preset.id}
									type="button"
									variant={
										activePresetId === preset.id ? 'default' : 'secondary'
									}
									size="sm"
									className={cn(
										'h-auto py-2 text-xs font-medium',
										activePresetId !== preset.id && 'text-muted-foreground'
									)}
									title={preset.description}
									onClick={() => handleApplyPreset(preset)}
								>
									{preset.label}
								</Button>
							))}
						</div>
					</div>

					<Separator />

					<div className="space-y-4">
						<p className="text-muted-foreground text-xs font-medium">
							Directional shadow
						</p>
						{SHADOW_PRIMARY_FIELDS.map((field) => (
							<ShadowField
								key={field.key}
								field={field}
								idPrefix="shadow"
								value={getFieldValue(field.key)}
								onChange={handleFieldChange}
							/>
						))}
					</div>

					<Separator />

					<div className="space-y-4">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<p className="text-muted-foreground text-xs font-medium">
									Ground shadow
								</p>
								<InfoTooltip content="A soft shadow pooled under the model that approximates the ambient occlusion it casts on the floor. It's independent of the directional light, so the model stays grounded even when the main shadow is cast off to the side. Raise Softness to keep it diffuse." />
							</div>
							<Switch
								id="shadow-ground-toggle"
								checked={current.contact?.enabled ?? false}
								onCheckedChange={handleToggleContact}
							/>
						</div>

						{(current.contact?.enabled ?? false) &&
							SHADOW_CONTACT_FIELDS.map((field) => (
								<ShadowField
									key={field.key}
									field={field}
									idPrefix="shadow-contact"
									value={getFieldValue(field.key)}
									onChange={handleFieldChange}
								/>
							))}
					</div>

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
									checked={current.ao ?? false}
									onCheckedChange={handleToggleAo}
								/>
							</div>

							{(current.ao ?? false) && (
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
		</div>
	)
}

export default ShadowSettingsPanel
