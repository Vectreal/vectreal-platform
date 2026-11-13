import { cn } from '@shared/utils'
import { useRef } from 'react'

import { prefersReducedMotion } from '../../lib/motion/motion-tokens'
import { useMountWhenVisibleAndIdle } from '../home/hero/use-mount-when-visible-and-idle'

/**
 * A short muted loop, poster first: the video is only fetched once its frame
 * is on screen and the browser is idle, so a phone that never scrolls to it
 * never downloads it. Under reduced motion the poster stays.
 */
export function IntakeLoop({
	src,
	poster,
	label,
	className
}: {
	src: string
	poster: string
	/** What the loop shows, for a screen reader. */
	label: string
	/** The frame's shape, when not the clips' 4:5. */
	className?: string
}) {
	const frameRef = useRef<HTMLDivElement>(null)
	const visible = useMountWhenVisibleAndIdle(frameRef)
	// Only ever true in the browser, so the server and hydration both render the poster.
	const plays = visible && !prefersReducedMotion()

	return (
		<div
			ref={frameRef}
			className={cn(
				'ds-sunken relative aspect-4/5 w-full min-w-0 overflow-hidden rounded-xl',
				className
			)}
		>
			{plays ? (
				<video
					src={src}
					poster={poster}
					autoPlay
					muted
					loop
					playsInline
					// Without controls a video is often skipped; as an image its label is still read.
					role="img"
					aria-label={label}
					className="absolute inset-0 h-full w-full object-cover"
				/>
			) : (
				<img
					src={poster}
					alt={label}
					loading="lazy"
					className="absolute inset-0 h-full w-full object-cover"
				/>
			)}
		</div>
	)
}
