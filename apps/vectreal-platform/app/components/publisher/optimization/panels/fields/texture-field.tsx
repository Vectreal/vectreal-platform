import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'

import { StepBlock, StepToggle } from './optimization-step'
import {
	closestPreset,
	NearestPresetGroup
} from '../../../sidebars/nearest-preset-group'
import { SettingGroup } from '../../../sidebars/sidebar-section'
import { useOptimizationSettings } from '../../use-optimization-settings'

import type { SliderPreset } from '@shared/components/ui/slider'
import type { FC } from 'react'

const TEXTURE_SIZE_OPTIONS = [256, 512, 768, 1024, 2048]

const QUALITY_PRESETS: SliderPreset[] = [
	{ value: 70, label: 'Performance' },
	{ value: 80, label: 'Balanced' },
	{ value: 90, label: 'Max detail' }
]

/**
 * Texture resizing and re-encoding. Second in the panel: on texture-heavy
 * models this outweighs every geometry saving combined.
 */
export const TextureField: FC = () => {
	const { optimizations, update } = useOptimizationSettings()
	const {
		enabled,
		resize: [resize] = [1024, 1024],
		quality = 80,
		targetFormat
	} = optimizations.texture

	return (
		<StepBlock>
			<StepToggle
				step="texture"
				checked={enabled}
				onCheckedChange={(checked) => update('texture', { enabled: checked })}
			/>

			{enabled && (
				<>
					<SettingGroup label="Maximum size" htmlFor="texture-size">
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
					</SettingGroup>

					<SettingGroup
						label="Compression profile"
						value={`${closestPreset(QUALITY_PRESETS, quality).value}%`}
					>
						<NearestPresetGroup
							label="Compression profile"
							presets={QUALITY_PRESETS}
							value={quality}
							onChange={(value) => update('texture', { quality: value })}
						/>
					</SettingGroup>

					<SettingGroup label="Format" htmlFor="texture-format">
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
					</SettingGroup>
				</>
			)}
		</StepBlock>
	)
}
