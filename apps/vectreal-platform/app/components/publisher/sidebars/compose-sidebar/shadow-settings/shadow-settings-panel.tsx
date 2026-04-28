import { Button } from '@shared/components/ui/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger
} from '@shared/components/ui/collapsible'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { Switch } from '@shared/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom } from 'jotai/react'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import {
	ACCUMULATIVE_FIELDS,
	ACCUMULATIVE_LIGHT_FIELDS,
	CONTACT_FIELDS
} from './constants'
import {
	defaultAccumulativeShadowsOptions,
	defaultShadowOptions
} from '../../../../../constants/viewer-defaults'
import { shadowsAtom } from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'
import { EnhancedSettingSlider } from '../../../settings-components'

import type { RandomizedLightProps } from '@react-three/drei'
import type { ShadowsProps } from '@vctrl/core'

const variants = {
	initial: { opacity: 0, y: 24 },
	animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
	exit: { opacity: 0, y: -24, transition: { duration: 0.18 } }
}

const ShadowSettingsPanel = () => {
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [lightAdvancedOpen, setLightAdvancedOpen] = useState(false)
	const { type } = shadows
	const shadowsEnabled = shadows.enabled ?? false

	const handleToggleShadows = (enabled: boolean) => {
		setShadows((prev) => ({
			...prev,
			enabled
		}))
	}

	const handleTypeChange = (value: ShadowsProps['type']) => {
		setShadows((prev) => {
			const enabled = prev.enabled ?? false

			if (value === 'accumulative') {
				return {
					...defaultAccumulativeShadowsOptions,
					enabled
				}
			}

			return {
				...defaultShadowOptions,
				enabled
			}
		})
	}

	const handleFieldChange = (key: string, value: number | string) => {
		setShadows((prev) => ({
			...prev,
			[key]: value
		}))
	}

	const handleLightFieldChange = (key: string, value: number | string) => {
		setShadows((prev) => {
			const enabled = prev.enabled ?? false

			if (prev.type !== 'accumulative') {
				return {
					...defaultAccumulativeShadowsOptions,
					enabled,
					light: {
						...defaultAccumulativeShadowsOptions.light,
						[key]: value
					}
				}
			}

			return {
				...prev,
				light: {
					...(prev.light || defaultAccumulativeShadowsOptions.light),
					[key]: value
				}
			}
		})
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shadows</p>
				<div className="flex items-center gap-2">
					<InfoTooltip content="Configure the type and quality of shadows in your scene." />
					<Label htmlFor="shadows-enabled-toggle" className="text-sm">Enabled</Label>
					<Switch
						id="shadows-enabled-toggle"
						checked={shadowsEnabled}
						onCheckedChange={handleToggleShadows}
					/>
				</div>
			</div>
			<Separator />

			{shadowsEnabled && (
				<div className="space-y-1.5">
					<p className="text-xs text-muted-foreground">Shadow Type</p>
					<ToggleGroup
						type="single"
						value={type}
						onValueChange={(value) => {
							if (value) handleTypeChange(value as ShadowsProps['type'])
						}}
						variant="outline"
						className="w-full"
					>
						<ToggleGroupItem value="contact" className="flex-1 text-sm">Contact</ToggleGroupItem>
						<ToggleGroupItem value="accumulative" className="flex-1 text-sm">Soft</ToggleGroupItem>
					</ToggleGroup>
				</div>
			)}

			<AnimatePresence mode="wait" initial={false}>
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
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact Shadow</p>
							<InfoTooltip content="Contact shadows are fast, simple, and ideal for performance-focused scenes." />
						</div>
						<Separator />
						{CONTACT_FIELDS.map((field) => (
							<EnhancedSettingSlider
								key={field.key}
								id={`contact-${field.key}`}
								sliderProps={{
									min: field.min,
									max: field.max,
									step: field.step,
									value:
										(shadows[field.key as keyof ShadowsProps] as number) ??
										field.min,
									onChange: (value) => handleFieldChange(field.key, value)
								}}
								label={field.label}
								tooltip={field.tooltip}
								labelProps={{
									low: `${field.min}`,
									high: `${field.max}`
								}}
								formatValue={field.formatValue}
								valueMapping={field.valueMapping}
								allowDirectInput={true}
							/>
						))}
					</motion.div>
				)}

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
							<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Soft Shadow</p>
							<InfoTooltip content="Soft shadows blend multiple frames for a realistic, gentle effect." />
						</div>
						<Separator />
						{ACCUMULATIVE_FIELDS.map((field) => {
							return (
								<EnhancedSettingSlider
									key={field.key}
									id={`accumulative-${field.key}`}
									sliderProps={{
										min: field.min,
										max: field.max,
										step: field.step,
										value:
											(shadows[field.key as keyof ShadowsProps] as number) ??
											field.min,
										onChange: (value) => handleFieldChange(field.key, value)
									}}
									label={field.label}
									tooltip={field.tooltip}
									labelProps={{
										low: `${field.min}`,
										high: `${field.max}`
									}}
									formatValue={field.formatValue}
									valueMapping={field.valueMapping}
									allowDirectInput={true}
								/>
							)
						})}

						<Collapsible open={lightAdvancedOpen} onOpenChange={setLightAdvancedOpen}>
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="sm" className="w-full justify-between px-0 text-xs text-muted-foreground hover:text-foreground">
									Advanced light settings
									<ChevronDown className={`h-3.5 w-3.5 transition-transform ${lightAdvancedOpen ? 'rotate-180' : ''}`} />
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-4 pt-2">
								{ACCUMULATIVE_LIGHT_FIELDS.map((field) => {
									const defaultLightValue =
										defaultAccumulativeShadowsOptions.light?.[
											field.key as keyof RandomizedLightProps
										]
									const currentValue =
										shadows.type === 'accumulative'
											? shadows.light?.[field.key as keyof RandomizedLightProps]
											: undefined

									return (
										<EnhancedSettingSlider
											key={field.key}
											id={`light-${field.key}`}
											sliderProps={{
												min: field.min,
												max: field.max,
												step: field.step,
												value:
													(currentValue as number) ??
													(defaultLightValue as number) ??
													field.min,
												onChange: (value) =>
													handleLightFieldChange(field.key, value)
											}}
											label={field.label}
											tooltip={field.tooltip}
											labelProps={{
												low: `${field.min}`,
												high: `${field.max}`
											}}
											formatValue={field.formatValue}
											valueMapping={field.valueMapping}
											allowDirectInput={true}
										/>
									)
								})}
							</CollapsibleContent>
						</Collapsible>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ShadowSettingsPanel
