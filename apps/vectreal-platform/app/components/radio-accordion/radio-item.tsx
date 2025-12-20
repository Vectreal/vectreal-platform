import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'

import { RadioAccordionOptionProps } from './types'

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

const selectedTextVariants = {
	show: {
		y: 0,
		opacity: 1,
		transition: { delay: 0.2, ease: 'anticipate' }
	},
	initial: {
		y: 5,
		opacity: 0
	},
	hide: {
		y: -5,
		opacity: 0
	}
}

const RadioAccordionItem = <T extends string>(
	props: RadioAccordionOptionProps<T>
) => {
	const { option, isSelected, onSelect } = props

	return (
		<button
			onClick={onSelect}
			className={cn(
				'group relative w-full rounded-xl border border-transparent p-2 text-left',
				'select-none',
				!isSelected &&
					'hover:bg-accent/5 focus-visible:bg-accent/10 bg-muted/25 focus:outline-none',
				isSelected && 'bg-accent/10 border-accent/50'
			)}
		>
			<div className="flex items-center gap-2">
				<div
					className={cn(
						'flex h-6 w-6 items-center justify-center rounded-md transition-all duration-500',
						isSelected
							? 'bg-accent text-primary-foreground fill-primary-foreground'
							: 'bg-muted text-muted-foreground fill-muted-foreground group-hover:bg-accent/20 group-hover:text-accent'
					)}
				>
					{option.icon}
				</div>

				<span
					className={cn(
						'text-sm font-medium transition-colors duration-300',
						isSelected
							? 'text-primary'
							: 'text-muted-foreground group-hover:text-foreground'
					)}
				>
					{option.label}
				</span>
				<AnimatePresence mode="wait">
					{isSelected && (
						<motion.small
							variants={selectedTextVariants}
							key="selected-text"
							initial="initial"
							animate="show"
							exit="hide"
							className="text-muted-foreground/75"
						>
							selected
						</motion.small>
					)}
				</AnimatePresence>
			</div>
			<AnimatePresence>
				{isSelected && (
					<motion.div
						key={option.id}
						variants={itemInfoVariants}
						initial="closed"
						animate="open"
						exit="closed"
						className="overflow-hidden pl-8"
					>
						<p className="text-muted-foreground pt-2 text-xs">
							{option.description}
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</button>
	)
}

export default RadioAccordionItem
