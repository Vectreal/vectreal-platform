import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom } from 'jotai/react'
import { BatteryFull, BatteryLow, BatteryMedium, Check } from 'lucide-react'
import { useCallback, useEffect, type FC, type SVGProps } from 'react'

import { optimizationPresets } from '../../../constants/optimizations'
import { optimizationAtom } from '../../../lib/stores/scene-optimization-store'

export type OptimizationPreset = 'low' | 'medium' | 'high'

type PresetMeta = {
	icon: FC<SVGProps<SVGSVGElement>>
	label: string
	res: string
	quality: string
	description: string
	techniques: string[]
}

const PRESET_META: Record<OptimizationPreset, PresetMeta> = {
	low: {
		icon: BatteryLow,
		label: 'Base',
		res: '2K WebP',
		quality: '90%',
		description:
			'Preserves most details with a larger file size. Ideal for high-fidelity previews and final renders.',
		techniques: [
			'Mesh simplification',
			'Texture optimization',
			'Vertex quantization'
		]
	},
	medium: {
		icon: BatteryMedium,
		label: 'Balanced',
		res: '1K WebP',
		quality: '80%',
		description:
			'A well-balanced trade-off between quality and performance. Recommended for most use cases.',
		techniques: [
			'Mesh simplification',
			'Texture optimization',
			'Vertex quantization'
		]
	},
	high: {
		icon: BatteryFull,
		label: 'Performance',
		res: '512px WebP',
		quality: '70%',
		description:
			'Optimized for the smallest file size and fastest load times. Best for mobile and low-end hardware.',
		techniques: [
			'Mesh simplification',
			'Texture optimization',
			'Vertex quantization',
			'Duplicate removal'
		]
	}
}

const PRESET_ORDER: OptimizationPreset[] = ['low', 'medium', 'high']

const BasicPanel = () => {
	const [{ optimizationPreset }, setOptimizationConfig] =
		useAtom(optimizationAtom)

	const handleSelect = useCallback(
		(preset: OptimizationPreset) => {
			if (optimizationPreset === preset) return
			setOptimizationConfig((prev) => ({
				...prev,
				optimizationPreset: preset,
				optimizations: optimizationPresets[preset]
			}))
		},
		[optimizationPreset, setOptimizationConfig]
	)

	useEffect(() => {
		if (!optimizationPreset) {
			handleSelect('medium')
		}
	}, [optimizationPreset, handleSelect])

	return (
		<div className="space-y-2">
			{PRESET_ORDER.map((id) => {
				const meta = PRESET_META[id]
				const isSelected = optimizationPreset === id
				const Icon = meta.icon

				return (
					<button
						key={id}
						onClick={() => handleSelect(id)}
						className={cn(
							'group focus-visible:ring-ring w-full rounded-xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2',
							isSelected
								? 'border-accent/40 bg-accent/6'
								: 'bg-muted/40 hover:border-border hover:bg-muted/60 border-transparent'
						)}
					>
						{/* Always-visible header row */}
						<div className="flex items-center gap-3">
							{/* Radio dot */}
							<div
								className={cn(
									'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
									isSelected
										? 'border-accent bg-accent'
										: 'border-muted-foreground/30 group-hover:border-muted-foreground/60'
								)}
							>
								{isSelected && (
									<div className="bg-primary-foreground h-1.5 w-1.5 rounded-full" />
								)}
							</div>

							{/* Icon */}
							<div
								className={cn(
									'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
									isSelected
										? 'bg-accent/15 text-accent'
										: 'bg-background text-muted-foreground group-hover:text-foreground'
								)}
							>
								<Icon className="h-4 w-4" />
							</div>

							{/* Name */}
							<span
								className={cn(
									'min-w-0 flex-1 text-sm font-medium transition-colors duration-200',
									isSelected
										? 'text-foreground'
										: 'text-muted-foreground group-hover:text-foreground'
								)}
							>
								{meta.label}
							</span>

							{/* Specs — always visible for at-a-glance comparison */}
							<div className="flex shrink-0 items-center gap-1.5">
								<span className="text-muted-foreground text-xs tabular-nums">
									{meta.res}
								</span>
								<span className="text-muted-foreground/40 text-[10px]">·</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{meta.quality}
								</span>
							</div>
						</div>

						{/* Expanded detail — selected preset only */}
						<AnimatePresence initial={false}>
							{isSelected && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
									className="overflow-hidden"
								>
									<p className="text-muted-foreground mt-3 pl-[3.25rem] text-xs leading-relaxed">
										{meta.description}
									</p>

									<div className="mt-3 border-t pt-3 pl-[3.25rem]">
										<p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
											Applied techniques
										</p>
										<div className="flex flex-col gap-1.5">
											{meta.techniques.map((t) => (
												<div key={t} className="flex items-center gap-2">
													<Check className="text-accent h-3 w-3 shrink-0" />
													<span className="text-foreground/75 text-xs">
														{t}
													</span>
												</div>
											))}
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</button>
				)
			})}
		</div>
	)
}

export default BasicPanel
