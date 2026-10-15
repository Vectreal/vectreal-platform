import { Checkbox } from '@shared/components/ui/checkbox'

import {
	CONVERT_OPTIONS,
	type ConvertOption
} from '../../lib/convert/convert-pairs'

interface Props {
	options: readonly ConvertOption[]
	active: readonly ConvertOption[]
	onToggle: (option: ConvertOption) => void
}

/** The passes this page can apply before a download, ticked or not. */
export function ConversionOptions({ options, active, onToggle }: Props) {
	return (
		<fieldset>
			<legend className="text-muted-foreground text-eyebrow mb-3">
				Before you download
			</legend>
			<div className="flex flex-col gap-3">
				{options.map((option) => (
					<label key={option} className="flex cursor-pointer items-start gap-3">
						<Checkbox
							checked={active.includes(option)}
							onCheckedChange={() => onToggle(option)}
							className="mt-0.5"
						/>
						<span className="min-w-0">
							<span className="text-foreground block text-sm font-medium">
								{CONVERT_OPTIONS[option].label}
							</span>
							<span className="text-muted-foreground block text-sm">
								{CONVERT_OPTIONS[option].description}
							</span>
						</span>
					</label>
				))}
			</div>
		</fieldset>
	)
}
