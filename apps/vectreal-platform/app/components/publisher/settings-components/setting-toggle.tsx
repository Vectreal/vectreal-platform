import { Label } from '@shared/components/ui/label'
import { Switch } from '@shared/components/ui/switch'

import { InfoTooltip } from '../../info-tooltip'

interface SettingToggleProps {
	enabled: boolean
	onToggle: (checked: boolean) => void
	title: string
	description: string
	info?: string
}

function SettingToggle({
	enabled,
	onToggle,
	title,
	description,
	info
}: SettingToggleProps) {
	const id = `setting-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`
	return (
		<div className="flex items-start justify-between">
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<Label htmlFor={id}>{title}</Label>
					{info && <InfoTooltip content={info} />}{' '}
				</div>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			<Switch
				id={id}
				checked={enabled}
				onCheckedChange={onToggle}
				className="mt-1"
			/>
		</div>
	)
}

export default SettingToggle
