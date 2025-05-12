import { cn } from '@vctrl-ui/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Battery, BatteryFull, BatteryMedium } from 'lucide-react'
import React from 'react'

import { PresetOptionProps } from './types'

const iconComponents = {
	'battery-full': BatteryFull,
	'battery-medium': BatteryMedium,
	'battery-low': Battery
} as const

export type IconType = keyof typeof iconComponents

const itemInfoVariants = {
	open: {
		height: 'auto',
		opacity: 1
	},
	closed: {
		height: 0,
		opacity: 0
	}
}

const PresetOption: React.FC<PresetOptionProps> = ({
	preset,
	isSelected,
	onSelect
}) => {
	const IconComponent = iconComponents[preset.icon as IconType]

	return (
		<button
			onClick={onSelect}
			className={cn(
				'group relative w-full rounded-xl px-3 py-2.5 text-left',
				'cursor-pointer select-none',
				!isSelected &&
					'hover:bg-primary/5 focus-visible:bg-primary/10 focus:outline-none',
				isSelected && 'bg-primary/10'
			)}
		>
			<div className="flex items-center gap-3">
				<div
					className={cn(
						'flex h-6 w-6 items-center justify-center rounded-md transition-all duration-300',
						isSelected
							? 'bg-primary text-primary-foreground fill-primary-foreground'
							: 'bg-muted text-muted-foreground fill-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
					)}
				>
					<IconComponent size={16} />
				</div>

				<span
					className={cn(
						'text-sm font-medium transition-colors duration-300',
						isSelected
							? 'text-primary'
							: 'text-muted-foreground group-hover:text-foreground'
					)}
				>
					{preset.label}
				</span>
			</div>

			<AnimatePresence mode="wait">
				{isSelected && (
					<motion.div
						layout
						key={preset.id}
						variants={itemInfoVariants}
						initial="closed"
						animate="open"
						exit="closed"
						className="overflow-hidden pl-9"
					>
						<p className="text-muted-foreground text-xs">
							{preset.description}
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</button>
	)
}

export default PresetOption
