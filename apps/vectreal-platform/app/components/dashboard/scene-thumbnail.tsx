import { cn } from '@shared/utils'
import { Box } from 'lucide-react'
import { useState } from 'react'

interface SceneThumbnailProps {
	/** `scenes.thumbnailUrl` - an internal API path, and often null. */
	src?: null | string
	className?: string
	/** Rendered at card size by default; `sm` suits table rows. */
	size?: 'sm' | 'md'
}

/**
 * A scene's thumbnail, or a stand-in for it.
 *
 * A missing thumbnail is the normal case, not the exception: `thumbnailUrl` is
 * only written when a scene has been saved through the publisher after a
 * viewport capture, so every scene predating that has none. A load failure is
 * treated identically - by the time the image 404s the reason no longer matters
 * to the person looking at it.
 */
export function SceneThumbnail({
	src,
	className,
	size = 'md'
}: SceneThumbnailProps) {
	const [failed, setFailed] = useState(false)
	const showPlaceholder = !src || failed

	return (
		<div
			className={cn(
				// `shrink-0` because the small variant sits in a flex row beside a
				// scene name of arbitrary length, and a flex item shrinks by default -
				// a long name squeezed the thumbnail out of square.
				'ds-sunken relative shrink-0 overflow-hidden',
				size === 'sm' ? 'size-9 rounded-lg' : 'aspect-video w-full rounded-xl',
				className
			)}
		>
			{/*
			  A neutral well, not a per-scene colour.

			  This first cycled six hues keyed off the scene name. That colour
			  encoded nothing - the name sits right next to it - so it was decoration
			  in six directions, and it put magenta and green into a product whose
			  palette is one accent over neutrals. The surface ladder already says
			  "nothing here yet"; it does not need help.
			*/}
			{showPlaceholder ? (
				<div
					className="flex h-full w-full items-center justify-center"
					aria-hidden="true"
				>
					<Box
						className={cn(
							'text-muted-foreground/50',
							size === 'sm' ? 'size-4' : 'size-7'
						)}
					/>
				</div>
			) : (
				<img
					src={src}
					alt=""
					loading="lazy"
					onError={() => setFailed(true)}
					className="h-full w-full object-cover object-center"
				/>
			)}
		</div>
	)
}
