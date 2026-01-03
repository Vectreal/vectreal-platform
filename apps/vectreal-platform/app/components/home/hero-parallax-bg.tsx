import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

import starsBackground from '../../assets/images/stars.webp'

const HeroParallaxBg = () => {
	const isMobile = useIsMobile()

	// Mouse position values for desktop
	const mouseX = useMotionValue(0)
	const mouseY = useMotionValue(0)

	// Smooth spring animation
	const springConfig = { damping: 20, stiffness: 50 }
	const movementRange = 20
	const x = useSpring(
		useTransform(mouseX, [0, 1], [movementRange, -movementRange]),
		springConfig
	)
	const y = useSpring(
		useTransform(mouseY, [0, 1], [movementRange, -movementRange]),
		springConfig
	)

	// Scroll-based parallax for mobile
	const scrollY = useMotionValue(0)
	const scrollParallax = useSpring(
		useTransform(scrollY, [0, 500], [0, -50]),
		springConfig
	)

	useEffect(() => {
		if (isMobile) {
			// Handle scroll on mobile
			const handleScroll = () => {
				scrollY.set(window.scrollY)
			}

			window.addEventListener('scroll', handleScroll)
			return () => window.removeEventListener('scroll', handleScroll)
		} else {
			// Handle mouse movement on desktop
			const handleMouseMove = (e: MouseEvent) => {
				const { clientX, clientY } = e
				const { innerWidth, innerHeight } = window

				// Normalize to 0-1 range
				mouseX.set(clientX / innerWidth)
				mouseY.set(clientY / innerHeight)
			}

			window.addEventListener('mousemove', handleMouseMove)
			return () => window.removeEventListener('mousemove', handleMouseMove)
		}
	}, [isMobile, mouseX, mouseY, scrollY])

	return (
		<motion.img
			src={starsBackground}
			alt="Stars background"
			className="absolute inset-0 -z-10 h-full w-full object-cover opacity-75 mix-blend-lighten"
			style={isMobile ? { y: scrollParallax } : { x, y }}
		/>
	)
}

export default HeroParallaxBg
