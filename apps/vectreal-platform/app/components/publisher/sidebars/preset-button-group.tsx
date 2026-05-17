import { Button } from '@shared/components'
import { AnimatePresence, motion, Variants } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { memo, ReactNode, useState } from 'react'
/**
 * Wrapper for preset/toggle button groups with consistent typography and spacing.
 * Applies visual hierarchy where:
 * - Label is a subdued secondary text
 * - Controls are prominent primary elements
 * - Proper breathing room between sections
 */

interface PresetButtonGroupProps {
	label: string
	description?: string
	children: ReactNode
	sliderChildren?: ReactNode
	className?: string
}

const EXPAND_VARIANTS: Variants = {
	hidden: { height: 0, opacity: 0, visibility: 'hidden' },
	visible: { height: 'auto', opacity: 1, visibility: 'visible' },
	exit: { height: 0, opacity: 0, visibility: 'hidden' }
}

export const PresetButtonGroup = memo(
	({
		label,
		description,
		children,
		sliderChildren,
		className = ''
	}: PresetButtonGroupProps) => {
		const [isSliderOpen, setIsSliderOpen] = useState(false)

		const toggleSlider = () => {
			setIsSliderOpen(!isSliderOpen)
		}

		return (
			<div className={`space-y-2.5 ${className}`}>
				<div className="flex flex-col gap-0.5">
					<label className="text-muted-foreground text-xs font-medium">
						{label}
					</label>
					{description && (
						<p className="text-muted-foreground/70 text-xs">{description}</p>
					)}
				</div>
				<div>{children}</div>

				<AnimatePresence mode="wait">
					<motion.div
						variants={EXPAND_VARIANTS}
						initial="hidden"
						animate={isSliderOpen ? 'visible' : 'hidden'}
						exit="exit"
					>
						{sliderChildren}
					</motion.div>
				</AnimatePresence>

				{sliderChildren && (
					<Button
						variant="secondary"
						size="sm"
						className="z-100 w-full px-3 py-1"
						onClick={toggleSlider}
					>
						<span className="text-muted-foreground flex items-center text-xs font-medium">
							{isSliderOpen ? (
								<ChevronUp className="mr-1" />
							) : (
								<ChevronDown className="mr-1" />
							)}{' '}
							Fine Tune...
						</span>
					</Button>
				)}
			</div>
		)
	}
)

PresetButtonGroup.displayName = 'PresetButtonGroup'
