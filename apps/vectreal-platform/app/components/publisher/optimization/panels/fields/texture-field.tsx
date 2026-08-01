import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Switch } from '@shared/components/ui/switch'
import { cn } from '@shared/utils'

import { InfoTooltip } from '../../../../info-tooltip'
import { ToggleButtonGroup } from '../../../settings-components'
import { getOptimizationDefinition } from '../../model'
import { useOptimizationSettings } from '../../use-optimization-settings'

import type { ToggleButtonGroupOption } from '../../../settings-components'
import type { FC } from 'react'

const TEXTURE_SIZE_OPTIONS = [256, 512, 768, 1024, 2048]

const QUALITY_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 70, label: 'Performance', subLabel: 'Faster loading' },
	{ value: 80, label: 'Balanced', subLabel: 'Best default' },
	{ value: 90, label: 'Max detail', subLabel: 'Highest fidelity' }
]

function getClosestQuality(current: number): number {
	return QUALITY_PRESETS.reduce((closest, option) =>
		Math.abs(option.value - current) < Math.abs(closest.value - current)
			? option
			: closest
	).value
}

/**
 * Texture resizing and re-encoding. Second in the panel: on texture-heavy
 * models this outweighs every geometry saving combined.
 */
export const TextureField: FC = () => {
	const { optimizations, update } = useOptimizationSettings()
	const definition = getOptimizationDefinition('texture')
	const {
		enabled,
		resize: [resize] = [1024, 1024],
		quality = 80,
		targetFormat
	} = optimizations.texture

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-3 px-1">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<Label className="text-sm font-semibold">{definition.title}</Label>
						<InfoTooltip content={definition.tooltip} />
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{definition.description}
					</p>
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={(checked) => update('texture', { enabled: checked })}
					className="mt-1"
				/>
			</div>

			<div
				className={cn(
					'bg-shell-surface-soft/50 space-y-5 rounded-xl p-4 text-sm shadow-sm',
					!enabled && 'pointer-events-none opacity-50'
				)}
			>
				<div className="space-y-3">
					<Label htmlFor="texture-size">Maximum size</Label>
					<Select
						value={resize.toString()}
						onValueChange={(value) =>
							update('texture', {
								resize: [Number.parseInt(value), Number.parseInt(value)]
							})
						}
					>
						<SelectTrigger id="texture-size" className="w-full">
							<SelectValue placeholder="Select texture size" />
						</SelectTrigger>
						<SelectContent>
							{TEXTURE_SIZE_OPTIONS.map((size) => (
								<SelectItem key={size} value={size.toString()}>
									{size}×{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<Label className="text-sm font-semibold">Compression profile</Label>
						<span className="text-orange text-xs font-medium">
							{getClosestQuality(quality)}%
						</span>
					</div>
					<ToggleButtonGroup
						options={QUALITY_PRESETS}
						isActive={(value) => getClosestQuality(quality) === value}
						onChange={(value) => update('texture', { quality: value })}
					/>
				</div>

				<div className="space-y-3">
					<Label htmlFor="texture-format" className="text-sm font-semibold">
						Format
					</Label>
					<Select
						value={targetFormat}
						onValueChange={(value) =>
							update('texture', {
								targetFormat: value as 'webp' | 'jpeg' | 'png'
							})
						}
					>
						<SelectTrigger id="texture-format" className="w-full">
							<SelectValue placeholder="Select texture format" />
						</SelectTrigger>
						<SelectContent>
							{(['png', 'jpeg', 'webp'] as const).map((format) => (
								<SelectItem key={format} value={format}>
									{format === 'jpeg' ? 'JPG' : format.toUpperCase()}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	)
}
