import { RandomizedLightProps } from '@react-three/drei'
import { BaseShadowsProps, ShadowsProps } from '@vctrl/viewer'
import { Label } from '@vctrl-ui/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@vctrl-ui/ui/select'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom } from 'jotai'

import { InfoTooltip } from '../../../../../components/info-tooltip'
import { shadowsAtom } from '../../../../../lib/stores/publisher-config-store'
import { SettingSlider } from '../../../settings-components'

import {
	ACCUMULATIVE_FIELDS,
	ACCUMULATIVE_LIGHT_FIELDS,
	CONTACT_FIELDS
} from './constants'

const variants = {
	initial: { opacity: 0, y: 24 },
	animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
	exit: { opacity: 0, y: -24, transition: { duration: 0.18 } }
}

const ShadowSettingsPanel = () => {
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const { type } = shadows

	const handleTypeChange = (value: ShadowsProps['type']) => {
		setShadows(
			(prev) =>
				({
					...prev,
					type: value
				}) as BaseShadowsProps
		)
	}

	const handleFieldChange = (key: string, value: number | string) => {
		setShadows((prev) => ({
			...prev,
			[key]: value
		}))
	}

	const handleLightFieldChange = (key: string, value: number | string) => {
		setShadows((prev) => {
			// Only accumulative shadows have light property
			if (prev.type !== 'accumulative') {
				return {
					...prev,
					type: 'accumulative',
					light: { [key]: value }
				} as BaseShadowsProps
			}

			return {
				...prev,
				light: {
					...(prev.type === 'accumulative' && 'light' in prev
						? prev.light
						: {}),
					[key]: value
				}
			} as BaseShadowsProps
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
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Shadows</p>
					<InfoTooltip content="Configure the type and quality of shadows in your scene." />
				</div>

				<Label>Shadow Type</Label>
				<Select value={type} onValueChange={handleTypeChange}>
					<SelectTrigger className="w-full capitalize">
						<SelectValue placeholder="Select Shadow Type" />
					</SelectTrigger>
					<SelectContent>
						{' '}
						<SelectItem value="accumulative">Accumulative</SelectItem>
						<SelectItem value="contact">Contact</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<AnimatePresence mode="wait" initial={false}>
				{type === 'contact' && (
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
							<SettingSlider
								key={field.key}
								id={`contact-${field.key}`}
								sliderProps={{
									min: field.min,
									max: field.max,
									step: field.step,
									value:
										(shadows[field.key as keyof ShadowsProps] as number) ?? '',
									onChange: (value) => handleFieldChange(field.key, value)
								}}
								label={field.label}
								tooltip={field.tooltip}
								labelProps={{
									low: `${field.min}`,
									high: `${field.max}`
								}}
								formatValue={(value) => value?.toString()}
							/>
						))}
					</motion.div>
				)}

				{type === 'accumulative' && (
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
							{ACCUMULATIVE_FIELDS.map((field) => (
								<SettingSlider
									key={field.key}
									id={`accumulative-${field.key}`}
									sliderProps={{
										min: field.min,
										max: field.max,
										step: field.step,
										value:
											(shadows[field.key as keyof ShadowsProps] as number) ??
											'',
										onChange: (value) => handleFieldChange(field.key, value)
									}}
									label={field.label}
									tooltip={field.tooltip}
									labelProps={{
										low: `${field.min}`,
										high: `${field.max}`
									}}
									formatValue={(value) => value?.toString()}
								/>
							))}
						</div>
						<div className="bg-muted/50 space-y-4 rounded-xl p-4">
							<div className="flex items-center gap-2">
								<p className="text-lg font-medium">Randomized Light Settings</p>
								<InfoTooltip content="Adjust the properties of the randomized light used for accumulative shadows." />
							</div>
							{ACCUMULATIVE_LIGHT_FIELDS.map((field) => (
								<SettingSlider
									key={field.key}
									id={`light-${field.key}`}
									sliderProps={{
										min: field.min,
										max: field.max,
										step: field.step,
										value:
											(shadows.light?.[
												field.key as keyof RandomizedLightProps
											] as number) ?? '',
										onChange: (value) =>
											handleLightFieldChange(field.key, value)
									}}
									label={field.label}
									tooltip={field.tooltip}
									labelProps={{
										low: `${field.min}`,
										high: `${field.max}`
									}}
									formatValue={(value) => value?.toString()}
								/>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ShadowSettingsPanel
