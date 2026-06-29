import { useAnimation } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'

interface UseInViewAnimationOptions {
	threshold?: number
	once?: boolean
	delay?: number
	rootMargin?: string
}

export function useInViewAnimation({
	threshold = 0.2,
	once = true,
	rootMargin = '0px'
}: UseInViewAnimationOptions = {}) {
	const ref = useRef<HTMLDivElement>(null)
	const controls = useAnimation()
	const isInView = useInView(ref, {
		once,
		amount: threshold,
		margin: rootMargin as `${number}px ${number}px ${number}px ${number}px`
	})

	useEffect(() => {
		if (isInView) {
			controls.start('visible')
		} else if (!once) {
			controls.start('hidden')
		}
	}, [isInView, controls, once])

	return { ref, controls }
}
