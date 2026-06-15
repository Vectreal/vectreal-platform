import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { Switch } from '@shared/components/ui/switch'
import { useAtom } from 'jotai/react'
import { useState } from 'react'

import {
	CONTACT_ADVANCED_FIELDS,
	CONTACT_PRIMARY_FIELDS
} from './constants'
import { shadowsAtom } from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'
import { EnhancedSettingSlider } from '../../../settings-components'
import { CollapsibleSectionTrigger } from '../../accordion-components'

import type { FieldConfig } from '../../../../../types/settings-field'
import type { ShadowsProps } from '@vctrl/core'

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

const ShadowSettingsPanel = () => {
	const [shadows, setShadows] = useAtom(shadowsAtom)
	const [advancedOpen, setAdvancedOpen] = useState(false)

	const shadowsEnabled = shadows.enabled ?? false

	const handleToggleShadows = (enabled: boolean) =>
		setShadows({ ...shadows, enabled })

	const handleFieldChange = (key: string, value: number | string) =>
		setShadows({ ...shadows, [key]: value } as ShadowsProps)

	const getFieldValue = (key: string) =>
		(shadows[key as keyof ShadowsProps] as number) ?? 0

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
				</div>
			)}
		</div>
	)
}

export default ShadowSettingsPanel
