import { Switch } from '@vctrl-ui/ui/switch'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@vctrl-ui/ui/tooltip'
import { useAtom } from 'jotai'
import { Info } from 'lucide-react'

import { optimizationAtom } from '../../../../../lib/stores/publisher-config-store'

interface ToggleSettingProps {
	type: 'quantize' | 'dedup' | 'normals'
	title: string
	description: string
	info: string
}

const descriptions = {
	quantize: 'Reduces color precision to lower file size',
	dedup: 'Removes duplicate vertices and geometry',
	normals: 'Optimizes normal vectors for smoother appearance'
}

const tooltips = {
	quantize:
		'Reduces the number of bits used to store vertex positions and attributes, resulting in smaller file sizes but potentially introducing minor visual artifacts.',
	dedup:
		'Identifies and merges duplicate vertices, materials, and textures to reduce redundancy and decrease file size.',
	normals:
		'Recalculates and optimizes normal vectors to improve lighting appearance while reducing file size.'
}

export function ToggleSetting({
	type,
	title,
	description,
	info
}: ToggleSettingProps) {
	const [{ plannedOptimizations }, setOptimization] = useAtom(optimizationAtom)
	const { enabled } = plannedOptimizations[type]

	const setEnabled = (checked: boolean) => {
		setOptimization((optimization) => ({
			...optimization,
			plannedOptimizations: {
				...optimization.plannedOptimizations,
				[type]: {
					...optimization.plannedOptimizations[type],
					enabled: checked
				}
			}
		}))
	}

	return (
		<div className="flex items-start justify-between px-2">
			<div className="space-y-1">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">{title}</p>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="text-muted-foreground h-4 w-4 cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-80">
								<p>{info}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			<Switch checked={enabled} onCheckedChange={setEnabled} className="mt-1" />
		</div>
	)
}

export function QuantizeSetting() {
	return (
		<ToggleSetting
			type="quantize"
			title="Quantize Vertices"
			description={descriptions.quantize}
			info={tooltips.quantize}
		/>
	)
}

export function DedupSetting() {
	return (
		<ToggleSetting
			type="dedup"
			title="Remove Duplicates"
			description={descriptions.dedup}
			info={tooltips.dedup}
		/>
	)
}

export function NormalsSetting() {
	return (
		<ToggleSetting
			type="normals"
			title="Optimize Normals"
			description={descriptions.normals}
			info={tooltips.normals}
		/>
	)
}
