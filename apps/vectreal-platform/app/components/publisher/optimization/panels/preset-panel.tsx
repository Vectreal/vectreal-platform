import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Feather, Gem, Scale, SlidersHorizontal } from 'lucide-react'

import { optimizationPresets } from '../../../../constants/optimizations'
import { getOptimizationDefinition, listEnabledKeys } from '../model'
import { useOptimizationSettings } from '../use-optimization-settings'

import type { PresetId } from '../../../../types/scene-optimization'
import type { FC, SVGProps } from 'react'

interface PresetMeta {
	icon: FC<SVGProps<SVGSVGElement>>
	label: string
	description: string
}

const PRESET_META: Record<PresetId, PresetMeta> = {
	quality: {
		icon: Gem,
		label: 'Maximum quality',
		description:
			'Keeps textures large and detail intact. Best for hero shots and close inspection, at the cost of a bigger download.'
	},
	balanced: {
		icon: Scale,
		label: 'Balanced',
		description:
			'The trade-off most scenes want: sharp on desktop, quick to load, no visible loss at normal viewing distance.'
	},
	smallest: {
		icon: Feather,
		label: 'Smallest',
		description:
			'Smallest file and fastest first paint. Best for mobile, slow connections, and scenes viewed at a distance.'
	}
}

const PRESET_ORDER: PresetId[] = ['quality', 'balanced', 'smallest']

/**
 * Reads the summary off the preset itself, so a card can never advertise a
 * technique the preset does not actually run. These used to be hand-written
 * arrays that had already fallen out of date.
 */
function describePreset(preset: PresetId) {
	const optimizations = optimizationPresets[preset]
	const [width] = optimizations.texture.resize ?? []

	return {
		resolution: width ? `${width >= 1024 ? `${width / 1024}K` : width}px` : '—',
		quality: `${optimizations.texture.quality ?? 0}%`,
		techniques: listEnabledKeys(optimizations).map(
			(key) => getOptimizationDefinition(key).title
		)
	}
}

export const PresetPanel: FC = () => {
	const { optimizationPreset, selectPreset } = useOptimizationSettings()
	const isCustom = optimizationPreset === 'custom'

	return (
		<div className="space-y-2">
			{PRESET_ORDER.map((id) => {
				const meta = PRESET_META[id]
				const { resolution, quality, techniques } = describePreset(id)
				const isSelected = optimizationPreset === id
				const Icon = meta.icon

				return (
					<button
						key={id}
						onClick={() => selectPreset(id, optimizationPresets[id])}
						className={cn(
							'publisher-shell-focus group w-full rounded-xl border p-4 text-left transition-all duration-200',
							isSelected
								? 'border-accent/35 bg-shell-surface'
								: 'border-shell-border-soft bg-shell-surface-soft hover:border-shell-border-strong hover:bg-shell-surface'
						)}
					>
						<div className="flex items-center gap-3">
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

							<div
								className={cn(
									'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
									isSelected
										? 'bg-accent/15 text-accent'
										: 'bg-shell-surface text-muted-foreground group-hover:text-foreground'
								)}
							>
								<Icon className="h-4 w-4" />
							</div>

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

							<div className="flex shrink-0 items-center gap-1.5">
								<span className="text-muted-foreground text-xs tabular-nums">
									{resolution}
								</span>
								<span className="text-muted-foreground/40 text-[10px]">·</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{quality}
								</span>
							</div>
						</div>

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

									<div className="border-shell-border-soft mt-3 border-t pt-3 pl-[3.25rem]">
										<p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
											Applied techniques
										</p>
										<div className="flex flex-col gap-1.5">
											{techniques.map((technique) => (
												<div key={technique} className="flex items-center gap-2">
													<Check className="text-accent h-3 w-3 shrink-0" />
													<span className="text-foreground/75 text-xs">
														{technique}
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

			{/*
			  Settings that match no preset used to fall back to the middle card,
			  which left it highlighted as though it were still in effect.
			*/}
			{isCustom && (
				<motion.div
					initial={{ opacity: 0, y: -4 }}
					animate={{ opacity: 1, y: 0 }}
					className="border-accent/35 bg-shell-surface flex items-center gap-3 rounded-xl border p-4"
				>
					<div className="bg-accent/15 text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
						<SlidersHorizontal className="h-4 w-4" />
					</div>
					<div className="min-w-0">
						<p className="text-sm font-medium">Custom</p>
						<p className="text-muted-foreground text-xs">
							Your settings do not match a preset. Pick one above to reset them.
						</p>
					</div>
				</motion.div>
			)}
		</div>
	)
}

export default PresetPanel
