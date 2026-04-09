import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Switch } from '@shared/components/ui/switch'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom } from 'jotai'

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

			// When switching to accumulative, use the defaults
			if (value === 'accumulative') {
				return {
					...defaultAccumulativeShadowsOptions,
					enabled
				}
			}

			// When switching to contact, use contact defaults
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

			// Only accumulative shadows have light property
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
			<p className="px-2">
				Customize how shadows are rendered in your scene for optimal realism or
				performance.
			</p>
			<small className="text-muted-foreground/75 mt-2 mb-6 block px-2">
				Choose a shadow type and fine-tune its appearance to match your model
				and environment.
			</small>

			<div className="bg-muted/50 space-y-4 rounded-xl p-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<p className="text-lg font-medium">Shadows</p>
						<InfoTooltip content="Configure the type and quality of shadows in your scene." />
					</div>
					<div className="flex items-center gap-2">
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

				{shadowsEnabled && (
					<>
						<Label>Shadow Type</Label>
						<Select value={type} onValueChange={handleTypeChange}>
							<SelectTrigger className="w-full capitalize">
								<SelectValue placeholder="Select Shadow Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="accumulative">Accumulative</SelectItem>
								<SelectItem value="contact">Contact</SelectItem>
							</SelectContent>
						</Select>
					</>
				)}
			</div>

			<AnimatePresence mode="wait" initial={false}>
				{shadowsEnabled && type === 'contact' && (
					<motion.div
						key="contact"
						variants={variants}
						initial="initial"
						animate="animate"
						exit="exit"
						className="bg-muted/50 space-y-4 rounded-xl p-4"
					>
						<div className="flex items-center gap-2">
							<p className="text-lg font-medium">Contact Shadow Settings</p>
							<InfoTooltip content="Contact shadows are fast, simple, and ideal for performance-focused scenes." />
						</div>
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
						<div className="bg-muted/50 space-y-4 rounded-xl p-4">
							<div className="flex items-center gap-2">
								<p className="text-lg font-medium">
									Accumulative Shadow Settings
								</p>
								<InfoTooltip content="Accumulative shadows provide soft, realistic shadowing by blending multiple frames." />
							</div>
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
						</div>
						<div className="bg-muted/50 space-y-4 rounded-xl p-4">
							<div className="flex items-center gap-2">
								<p className="text-lg font-medium">Randomized Light Settings</p>
								<InfoTooltip content="Adjust the properties of the randomized light used for accumulative shadows." />
							</div>
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
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ShadowSettingsPanel
