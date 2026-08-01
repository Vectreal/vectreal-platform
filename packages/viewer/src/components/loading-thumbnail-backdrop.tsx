import { cn } from '@shared/utils'
import { useEffect, useState } from 'react'

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
	return 'blur-sm'
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
				'absolute inset-0 overflow-hidden transition-opacity duration-700 ease-out',
				isLoaded ? 'opacity-0' : isEntered ? 'opacity-100' : 'opacity-0'
			)}
		>
			<img
				src={thumbnail.src}
				alt={thumbnail.alt || 'Viewer loading thumbnail'}
				className={cn(
					'h-full w-full transition-transform duration-700 ease-out',
					thumbnail.objectFit === 'contain' ? 'object-contain' : 'object-cover',
					resolveBlurClass(thumbnail.blur),
					isLoaded ? 'scale-100' : isEntered ? 'scale-105' : 'scale-110',
					// Last so a consumer's class wins any conflict through twMerge.
					thumbnail.className
				)}
			/>
			{thumbnail.scrim !== false && (
				<>
					<div className="bg-background/35 absolute inset-0" />
					<div className="from-background/60 via-background/15 absolute inset-0 bg-gradient-to-b to-transparent" />
				</>
			)}
		</div>
	)
}

export default LoadingThumbnailBackdrop
