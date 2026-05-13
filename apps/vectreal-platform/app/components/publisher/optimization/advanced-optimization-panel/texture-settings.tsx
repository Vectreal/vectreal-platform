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
import { useAtom } from 'jotai/react'

import { optimizationAtom } from '../../../../lib/stores/scene-optimization-store'
import { InfoTooltip } from '../../../info-tooltip'
import { ToggleButtonGroup } from '../../settings-components'

import type { ToggleButtonGroupOption } from '../../settings-components'
import type { TextureOptimization } from '@vctrl/core'
import type { FC } from 'react'

const TEXTURE_SIZE_OPTIONS: ToggleButtonGroupOption<number>[] = [
	{ value: 256, label: '256' },
	{ value: 512, label: '512' },
	{ value: 768, label: '768' },
	{ value: 1024, label: '1024' },
	{ value: 2048, label: '2048' }
]

const QUALITY_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 68, label: 'Performance', subLabel: 'Faster loading' },
	{ value: 80, label: 'Balanced', subLabel: 'Best default' },
	{ value: 92, label: 'Max detail', subLabel: 'Highest fidelity' }
]

function getClosestQuality(current: number): number {
	return QUALITY_PRESETS.reduce((closest, o) =>
		Math.abs(o.value - current) < Math.abs(closest.value - current)
			? o
			: closest
	).value
}

export const TextureSettings: FC = () => {
	const [{ optimizations: plannedOptimizations }, setOptimization] =
		useAtom(optimizationAtom)
	const {
		enabled,
		resize: [resize] = [1024, 1024],
		quality = 80,
		targetFormat
	} = plannedOptimizations.texture

	function setTexture(updates: Partial<TextureOptimization>) {
		setOptimization((optimization) => ({
			...optimization,
			optimizations: {
				...optimization.optimizations,
				texture: {
					...optimization.optimizations.texture,
					...updates
				}
			}
		}))
	}

	return (
		<>
			<div className="mb-4 flex items-center justify-between px-2">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Texture Optimization</p>
					<InfoTooltip content="Resizes and compresses textures to reduce file size. Smaller textures and higher compression will reduce visual quality." />
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={(checked) => setTexture({ enabled: checked })}
				/>
			</div>

			<div
				className={cn(
					'bg-shell-surface-soft space-y-5 rounded-xl p-4 text-sm shadow-sm',
					!enabled && 'pointer-events-none opacity-50'
				)}
			>
				<div className="space-y-3">
					<Label htmlFor="texture-size">Texture Size</Label>
					<Select
						value={resize.toString()}
						onValueChange={(value) =>
							setTexture({ resize: [parseInt(value), parseInt(value)] })
						}
					>
						<SelectTrigger id="texture-size" className="w-full">
							<SelectValue placeholder="Select texture size" />
						</SelectTrigger>
						<SelectContent>
							{TEXTURE_SIZE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value.toString()}>
									{option.value}×{option.value}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<Label className="text-sm font-semibold">Compression profile</Label>
						<span className="text-accent text-xs font-medium">
							{getClosestQuality(quality)}%
						</span>
					</div>
					<ToggleButtonGroup
						options={QUALITY_PRESETS}
						isActive={(v) => getClosestQuality(quality) === v}
						onChange={(v) => setTexture({ quality: v })}
					/>
				</div>

				<div className="space-y-3">
					<Label htmlFor="texture-format" className="text-sm font-semibold">
						Texture format
					</Label>
					<Select
						value={targetFormat}
						onValueChange={(value) =>
							setTexture({ targetFormat: value as 'webp' | 'jpeg' | 'png' })
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
		</>
	)
}
