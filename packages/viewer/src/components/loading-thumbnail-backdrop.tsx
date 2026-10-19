import { useEffect, useState } from 'react'

import { cn, withHostClasses } from './class-names'

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
	const [isEntered, setIsEntered] = useState(false)

	useEffect(() => {
		const frameId = requestAnimationFrame(() => {
			setIsEntered(true)
		})

		return () => {
			cancelAnimationFrame(frameId)
		}
	}, [])

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
			<img
				src={thumbnail.src}
				alt={thumbnail.alt || 'Viewer loading thumbnail'}
				className={withHostClasses(
					cn(
						'vv:h-full vv:w-full vv:transition-transform vv:duration-700 vv:ease-out',
						thumbnail.objectFit === 'contain'
							? 'vv:object-contain'
							: 'vv:object-cover',
						resolveBlurClass(thumbnail.blur),
						isLoaded
							? 'vv:scale-100'
							: isEntered
								? 'vv:scale-105'
								: 'vv:scale-110'
					),
					thumbnail.className
				)}
			/>
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
