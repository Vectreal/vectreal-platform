import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Switch } from '@shared/components/ui/switch'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { useAtom } from 'jotai'
import { Info } from 'lucide-react'


import { SettingSlider } from '../../../../../components'
import { optimizationAtom } from '../../../../../lib/stores/scene-optimization-store'

import type { TextureOptimization } from '@vctrl/core'
import type { FC } from 'react'

const textureSize = [
	{ value: 256, label: '256×256' },
	{ value: 512, label: '512×512' },
	{ value: 768, label: '768×768' },
	{ value: 1024, label: '1024×1024' },
	{ value: 2048, label: '2048×2048' }
]

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
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="text-muted-foreground h-4 w-4 cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-80">
								<p>
									Resizes and compresses textures to reduce file size. Smaller
									textures and higher compression will reduce visual quality.
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={(checked) => setTexture({ enabled: checked })}
				/>
			</div>

			<div
				className={cn(
					'bg-muted/25 space-y-6 rounded-xl p-4 text-sm',
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
							{textureSize.map((option) => (
								<SelectItem key={option.value} value={option.value.toString()}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<SettingSlider
					id="quality-slider"
					label="Quality"
					sliderProps={{
						value: quality,
						min: 30,
						max: 100,
						step: 1,
						onChange: (value) => setTexture({ quality: value })
					}}
					labelProps={{
						low: 'Lower quality',
						high: 'Higher quality'
					}}
					formatValue={(value) => `${value}%`}
				/>

				<div className="space-y-3">
					<Label htmlFor="texture-size">Texture format</Label>
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
							{['png', 'jpg', 'webp'].map((format) => (
								<SelectItem key={format} value={format}>
									{format.toUpperCase()}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</>
	)
}
