import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { cn, withHostClasses } from './class-names'
import { useViewerMessages } from './viewer-messages'
import { useThumbnailEdgeBands } from '../hooks/use-thumbnail-edge-bands'

import type { ViewerLoadingThumbnail } from '../types/viewer-types'

interface LoadingThumbnailBackdropProps {
	thumbnail: ViewerLoadingThumbnail
	isLoaded: boolean
}

/**
 * `true` keeps the default blur, `false` drops it, a string replaces it. Kept
 * separate so the two falsy-ish cases stay distinguishable.
 */
const resolveBlurClass = (blur: ViewerLoadingThumbnail['blur']) => {
	if (blur === false) return null
	if (typeof blur === 'string') return blur
	return 'vv:blur-sm'
}

const LoadingThumbnailBackdrop = ({
	thumbnail,
	isLoaded
}: LoadingThumbnailBackdropProps) => {
	const messages = useViewerMessages()
	const [isEntered, setIsEntered] = useState(false)
	const bandsRef = useRef<HTMLCanvasElement>(null)
	const imageRef = useRef<HTMLImageElement>(null)
	const isContained = thumbnail.objectFit === 'contain'
	// The fill mirrors how the viewer lays the image out. A host's `className`
	// can restyle the image in ways the fill cannot follow (its box, transform,
	// filter or position), so a styled image keeps plain contain.
	const fillsBands = isContained && !thumbnail.className
	useThumbnailEdgeBands(bandsRef, imageRef, fillsBands, thumbnail.src)

	/*
	  Which source has settled, and how. Until the current one has loaded the
	  image is invisible: Safari draws its alt text and a broken-image icon
	  for an image that is still on its way, not only for one that failed.
	  One that fails is left out, so the loader shows over the stage alone.
	*/
	const [settled, setSettled] = useState<null | {
		src: string
		loaded: boolean
	}>(null)
	const status =
		settled?.src !== thumbnail.src
			? 'loading'
			: settled.loaded
				? 'loaded'
				: 'failed'
	// A cached image can finish before React attaches its `load` listener.
	useLayoutEffect(() => {
		const image = imageRef.current
		if (image?.complete && image.naturalWidth > 0) {
			setSettled({ src: thumbnail.src, loaded: true })
		}
	}, [thumbnail.src])

	useEffect(() => {
		const frameId = requestAnimationFrame(() => {
			setIsEntered(true)
		})

		return () => {
			cancelAnimationFrame(frameId)
		}
	}, [])

	// The bands carry the image's own blur and scale, so they stay continuous
	// with its edges through the entry transition.
	const motionClassName = cn(
		'vv:transition-transform vv:duration-700 vv:ease-out',
		resolveBlurClass(thumbnail.blur),
		isLoaded ? 'vv:scale-100' : isEntered ? 'vv:scale-105' : 'vv:scale-110'
	)
	const imageClassName = withHostClasses(
		cn(
			// Positioned, so it paints above the canvas that sits behind it.
			'vv:relative vv:h-full vv:w-full',
			isContained ? 'vv:object-contain' : 'vv:object-cover',
			motionClassName
		),
		thumbnail.className
	)

	return (
		<div
			className={cn(
				'vv:absolute vv:inset-0 vv:overflow-hidden vv:transition-opacity vv:duration-700 vv:ease-out',
				isLoaded
					? 'vv:opacity-0'
					: isEntered
						? 'vv:opacity-100'
						: 'vv:opacity-0'
			)}
		>
			{/*
			  Contained, the image leaves bands on any viewport that is not its
			  own aspect, and the scene's stage only paints once its settings
			  load. Its edges stretched across them fill the bands from the first
			  frame (`thumbnail-edge-bands.ts`).
			*/}
			{fillsBands && (
				<canvas
					ref={bandsRef}
					aria-hidden
					className={cn(
						'vv:absolute vv:inset-0 vv:h-full vv:w-full',
						motionClassName
					)}
				/>
			)}
			{status !== 'failed' && (
				<img
					ref={imageRef}
					src={thumbnail.src}
					alt={thumbnail.alt || messages.loadingThumbnailAlt}
					className={cn(imageClassName, status === 'loading' && 'vv:invisible')}
					onLoad={() => setSettled({ src: thumbnail.src, loaded: true })}
					onError={() => setSettled({ src: thumbnail.src, loaded: false })}
				/>
			)}
			{thumbnail.scrim !== false && (
				<>
					<div className="vv:bg-background/35 vv:absolute vv:inset-0" />
					<div className="vv:from-background/60 vv:via-background/15 vv:absolute vv:inset-0 vv:bg-gradient-to-b vv:to-transparent" />
				</>
			)}
		</div>
	)
}

export default LoadingThumbnailBackdrop
