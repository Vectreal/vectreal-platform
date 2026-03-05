import { cn } from '@shared/utils'
import { useEffect, useState } from 'react'

import type { ViewerLoadingThumbnail } from '../types/viewer-types'

interface LoadingThumbnailBackdropProps {
	thumbnail: ViewerLoadingThumbnail
	isLoaded: boolean
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
					'h-full w-full object-cover blur-xl transition-transform duration-700 ease-out',
					isLoaded ? 'scale-100' : isEntered ? 'scale-105' : 'scale-110'
				)}
			/>
			<div className="bg-background/35 absolute inset-0" />
			<div className="from-background/60 via-background/15 absolute inset-0 bg-gradient-to-b to-transparent" />
		</div>
	)
}

export default LoadingThumbnailBackdrop
