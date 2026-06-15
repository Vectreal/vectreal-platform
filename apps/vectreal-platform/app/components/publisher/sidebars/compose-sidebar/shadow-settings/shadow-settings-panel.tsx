import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { Switch } from '@shared/components/ui/switch'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
	ACCUMULATIVE_ADVANCED_FIELDS,
	ACCUMULATIVE_LIGHT_FIELDS,
	ACCUMULATIVE_PRIMARY_FIELDS,
	CONTACT_ADVANCED_FIELDS,
	CONTACT_PRIMARY_FIELDS
} from './constants'
import {
	defaultAccumulativeShadowsOptions,
	defaultShadowOptions
} from '../../../../../constants/viewer-defaults'
import { shadowsAtom } from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'
import { EnhancedSettingSlider } from '../../../settings-components'
import { PresetButton } from '../../../settings-components/preset-button'
import { CollapsibleSectionTrigger } from '../../accordion-components'

import type { FieldConfig } from '../../../../../types/settings-field'
import type { RandomizedLightProps } from '@react-three/drei'
import type { ShadowsProps } from '@vctrl/core'

const variants = {
	initial: { opacity: 0, y: 24 },
	animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
	exit: { opacity: 0, y: -24, transition: { duration: 0.18 } }
}

// ─── Reusable field renderer ─────────────────────────────────────────────────

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

// ─── Panel ───────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 180

const ShadowSettingsPanel = () => {
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [advancedOpen, setAdvancedOpen] = useState(false)

	// Local draft: sliders write here immediately for responsive UI.
	// For accumulative shadows, writes to the atom are debounced so
	// AccumulativeShadows doesn't re-accumulate all 40 frames on every
	// slider tick (which causes noticeable lag).
	const [draft, setDraft] = useState<ShadowsProps>(shadows)
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	// Track the last value we wrote to the atom so we can ignore the
	// resulting atom update (avoid resetting draft mid-drag).
	const lastWritten = useRef<ShadowsProps>(shadows)

	// Sync draft when atom changes from an external source (scene load, reset).
	useEffect(() => {
		if (shadows !== lastWritten.current) {
			setDraft(shadows)
			lastWritten.current = shadows
		}
	}, [shadows])

	// Cancel pending debounce on unmount.
	useEffect(
		() => () => {
			if (flushTimer.current) clearTimeout(flushTimer.current)
		},
		[]
	)

	const flush = useCallback(
		(value: ShadowsProps) => {
			if (flushTimer.current) clearTimeout(flushTimer.current)
			flushTimer.current = null
			lastWritten.current = value
			setShadows(value)
		},
		[setShadows]
	)

	// Write to atom immediately for non-accumulative types and structural
	// changes (enable/disable, type switch). Debounce only accumulative
	// numeric fields to prevent expensive re-accumulation on every tick.
	const schedule = useCallback(
		(value: ShadowsProps, immediate = false) => {
			setDraft(value)
			if (flushTimer.current) clearTimeout(flushTimer.current)
			if (immediate || value.type !== 'accumulative') {
				flush(value)
			} else {
				flushTimer.current = setTimeout(() => flush(value), DEBOUNCE_MS)
			}
		},
		[flush]
	)

	const { type } = draft
	const shadowsEnabled = draft.enabled ?? false

	const handleToggleShadows = (enabled: boolean) =>
		schedule({ ...draft, enabled }, true)

	const handleTypeChange = (value: ShadowsProps['type']) => {
		const enabled = draft.enabled ?? false
		schedule(
			value === 'accumulative'
				? { ...defaultAccumulativeShadowsOptions, enabled }
				: { ...defaultShadowOptions, enabled },
			true
		)
	}

	const handleFieldChange = (key: string, value: number | string) =>
		schedule({ ...draft, [key]: value })

	const handleLightFieldChange = (key: string, value: number | string) => {
		const enabled = draft.enabled ?? false
		const next: ShadowsProps =
			draft.type !== 'accumulative'
				? {
						...defaultAccumulativeShadowsOptions,
						enabled,
						light: {
							...defaultAccumulativeShadowsOptions.light,
							[key]: value
						}
					}
				: {
						...draft,
						light: {
							...(draft.light || defaultAccumulativeShadowsOptions.light),
							[key]: value
						}
					}
		schedule(next)
	}

	const getFieldValue = (key: string) =>
		(draft[key as keyof ShadowsProps] as number) ?? 0

	const getLightFieldValue = (key: string) => {
		if (draft.type !== 'accumulative') return 0
		const defaultLightValue =
			defaultAccumulativeShadowsOptions.light?.[
				key as keyof RandomizedLightProps
			]
		return (
			(draft.light?.[key as keyof RandomizedLightProps] as number) ??
			(defaultLightValue as number) ??
			0
		)
	}

	return (
		<div className="space-y-4">
			{/* Header + enable toggle */}
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					Shadows
				</p>
				<div className="flex items-center gap-2">
					<InfoTooltip content="Configure the type and quality of shadows in your scene." />
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
					Enable shadows to configure shadow type and quality.
				</p>
			)}

			{shadowsEnabled && (
				<div className="space-y-1.5">
					<p className="text-muted-foreground text-xs">Shadow Type</p>
					<div className="grid grid-cols-2 gap-1.5">
						{(
							[
								{ value: 'contact', label: 'Contact' },
								{ value: 'accumulative', label: 'Soft' }
							] as Array<{ value: ShadowsProps['type']; label: string }>
						).map((option) => (
							<PresetButton
								key={option.value}
								label={option.label}
								isActive={type === option.value}
								onClick={() => handleTypeChange(option.value)}
							/>
						))}
					</div>
				</div>
			)}

			<AnimatePresence mode="wait" initial={false}>
				{/* ── Contact ─────────────────────────────────────────────── */}
				{shadowsEnabled && type === 'contact' && (
					<motion.div
						key="contact"
						variants={variants}
						initial="initial"
						animate="animate"
						exit="exit"
						className="space-y-4"
					>
						<div className="flex items-center gap-2">
							<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								Contact Shadow
							</p>
							<InfoTooltip content="Contact shadows are fast, simple, and ideal for performance-focused scenes." />
						</div>
						<Separator />

						{CONTACT_PRIMARY_FIELDS.map((field) => (
							<ShadowField
								key={field.key}
								field={field}
								idPrefix="contact"
								value={getFieldValue(field.key)}
								onChange={handleFieldChange}
							/>
						))}

						<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
							<CollapsibleSectionTrigger isOpen={advancedOpen}>
								Advanced
							</CollapsibleSectionTrigger>
							<CollapsibleContent className="space-y-4 pt-3">
								{CONTACT_ADVANCED_FIELDS.map((field) => (
									<ShadowField
										key={field.key}
										field={field}
										idPrefix="contact-adv"
										value={getFieldValue(field.key)}
										onChange={handleFieldChange}
									/>
								))}
							</CollapsibleContent>
						</Collapsible>
					</motion.div>
				)}

				{/* ── Soft / Accumulative ──────────────────────────────────── */}
				{shadowsEnabled && type === 'accumulative' && (
					<motion.div
						key="accumulative"
						variants={variants}
						initial="initial"
						animate="animate"
						exit="exit"
						className="space-y-4"
					>
						<div className="flex items-center gap-2">
							<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								Soft Shadow
							</p>
							<InfoTooltip content="Soft shadows blend multiple frames for a realistic, gentle effect." />
						</div>
						<Separator />

						{ACCUMULATIVE_PRIMARY_FIELDS.map((field) => (
							<ShadowField
								key={field.key}
								field={field}
								idPrefix="accum"
								value={getFieldValue(field.key)}
								onChange={handleFieldChange}
							/>
						))}

						<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
							<CollapsibleSectionTrigger isOpen={advancedOpen}>
								Advanced
							</CollapsibleSectionTrigger>
							<CollapsibleContent className="space-y-4 pt-3">
								{ACCUMULATIVE_ADVANCED_FIELDS.map((field) => (
									<ShadowField
										key={field.key}
										field={field}
										idPrefix="accum-adv"
										value={getFieldValue(field.key)}
										onChange={handleFieldChange}
									/>
								))}

								<p className="text-muted-foreground pt-1 text-xs font-medium">
									Light Source
								</p>

								{ACCUMULATIVE_LIGHT_FIELDS.map((field) => (
									<ShadowField
										key={field.key}
										field={field}
										idPrefix="light"
										value={getLightFieldValue(field.key)}
										onChange={handleLightFieldChange}
									/>
								))}
							</CollapsibleContent>
						</Collapsible>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ShadowSettingsPanel
