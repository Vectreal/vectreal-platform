import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

type ShimmerRotatingTextProps = {
	phrases: string[]
	className?: string
	intervalMs?: number
	ariaLabel?: string
}

export function ShimmerRotatingText({
	phrases,
	className,
	intervalMs = 8400,
	ariaLabel = 'Cycle footer note'
}: ShimmerRotatingTextProps) {
	const stablePhrases = useMemo(() => phrases.filter(Boolean), [phrases])
	const [index, setIndex] = useState(0)
	const [isHovered, setIsHovered] = useState(false)
	const prefersReducedMotion = useReducedMotion()

	const advancePhrase = () => {
		setIndex((prev) => (prev + 1) % stablePhrases.length)
	}

	useEffect(() => {
		if (stablePhrases.length <= 1 || prefersReducedMotion || isHovered) {
			return
		}

		const id = window.setInterval(() => {
			setIndex((prev) => (prev + 1) % stablePhrases.length)
		}, intervalMs)

		return () => window.clearInterval(id)
	}, [intervalMs, isHovered, prefersReducedMotion, stablePhrases.length])

	if (stablePhrases.length === 0) {
		return null
	}

	return (
		<motion.button
			type="button"
			onClick={advancePhrase}
			onMouseEnter={advancePhrase}
			onMouseLeave={() => setIsHovered(false)}
			onHoverStart={() => setIsHovered(true)}
			onFocus={advancePhrase}
			className={
				className ||
				'text-muted-foreground/80 hover:text-foreground/95 focus-visible:ring-ring/60 relative isolate overflow-hidden rounded-full border border-transparent px-4 py-1.5 text-xs tracking-[0.18em] transition-colors focus-visible:ring-1 focus-visible:outline-none'
			}
			aria-label={ariaLabel}
			whileHover={
				prefersReducedMotion
					? undefined
					: {
							scale: 1.02,
							y: -1,
							transition: {
								type: 'spring',
								stiffness: 280,
								damping: 20
							}
						}
			}
		>
			<AnimatePresence mode="wait" initial={false}>
				<motion.span
					key={index}
					className="relative z-10 inline-grid"
					initial={
						prefersReducedMotion
							? { opacity: 1 }
							: { opacity: 0, y: 8, filter: 'blur(3px)' }
					}
					animate={
						prefersReducedMotion
							? { opacity: 1 }
							: { opacity: 1, y: 0, filter: 'blur(0px)' }
					}
					exit={
						prefersReducedMotion
							? { opacity: 0 }
							: { opacity: 0, y: -8, filter: 'blur(2px)' }
					}
					transition={{ duration: 0.84, delay: 0.5, ease: [0.19, 1, 0.22, 1] }}
				>
					<span className="text-muted-foreground/75 col-start-1 row-start-1">
						{stablePhrases[index]}
					</span>
					{!prefersReducedMotion && (
						<motion.span
							aria-hidden
							className="pointer-events-none col-start-1 row-start-1 [background-clip:text] text-transparent [-webkit-background-clip:text]"
							style={{
								backgroundImage:
									'linear-gradient(105deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.9) 48%, rgba(255,255,255,0) 72%)',
								backgroundSize: '220% 100%'
							}}
							animate={{
								backgroundPosition: ['120% 0%', '-120% 0%'],
								opacity: [0.16, 0.42, 0.16]
							}}
							transition={{
								duration: 3.2,
								repeat: Number.POSITIVE_INFINITY,
								ease: 'easeInOut'
							}}
						>
							{stablePhrases[index]}
						</motion.span>
					)}
				</motion.span>
			</AnimatePresence>
		</motion.button>
	)
}
