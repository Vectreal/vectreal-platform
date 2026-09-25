import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { memo, useEffect, useState } from 'react'

const LOADING_MESSAGES = [
	'Preparing the Publisher...',
	'Adjusting the lighting...',
	'Cleaning the lenses...',
	'Loading geometry data...',
	'Calibrating the viewer...'
]

/**
 * The publisher's one loading screen, from the moment a model is on its way
 * until it is on screen.
 *
 * Three things take turns on that path: the stage waiting for the load, the
 * viewer's code arriving, and the viewer reading the model. Each used to draw
 * its own spinner with its own words, 40ms apart, so opening a sample flashed
 * "Loading Scene...", "Loading Publisher..." and "Initializing..." in turn.
 * They all draw this now, so a handoff between them draws the same thing.
 *
 * `initial={false}` is what makes that hold: a handoff mounts this afresh, and
 * a message that faded in on mount would dip at every one of them. Only a
 * change of message fades.
 */
export const PublisherLoading = memo(() => {
	const [messageIndex, setMessageIndex] = useState(0)
	const reduceMotion = useReducedMotion()

	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | undefined

		const timeout = setTimeout(() => {
			interval = setInterval(() => {
				setMessageIndex((index) => (index + 1) % LOADING_MESSAGES.length)
			}, 6000)
		}, 3000)

		return () => {
			if (interval) clearInterval(interval)
			clearTimeout(timeout)
		}
	}, [])

	const message = LOADING_MESSAGES[messageIndex]

	return (
		<SpinnerWrapper>
			<LoadingSpinner />
			<AnimatePresence mode="wait" initial={false}>
				<motion.p
					key={message}
					className="text-muted-foreground mt-4 text-center"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.5 }}
				>
					{message}
				</motion.p>
			</AnimatePresence>
		</SpinnerWrapper>
	)
})
