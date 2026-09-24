/**
 * EmbedShowcase - an article-level wrapper for Vectreal iframe embeds.
 * Provides consistent caption, label, and sizing so embeds look intentional
 * rather than raw iframes dropped inline.
 *
 * The iframe mounts only once the figure comes near the viewport. An embed
 * pulls the viewer runtime plus a model, which is orders of magnitude heavier
 * than the rest of an article, so it must not load for readers who never
 * scroll to it. `loading="lazy"` alone was not enough: browsers apply it
 * loosely, and it still commits to the request far earlier than needed. The
 * box is reserved up front so mounting shifts nothing.
 *
 * Usage in MDX:
 *   import EmbedShowcase from './embed-showcase'
 *   <EmbedShowcase
 *     src="https://vectreal.com/embed/…?token=…"
 *     label="Linear transition · Ease in-out · 1000 ms"
 *     caption="Switch cameras to see the linear transition in action."
 *     height={420}
 *   />
 */
import { useEffect, useRef, useState } from 'react'

interface EmbedShowcaseProps {
	src: string
	label?: string
	caption?: string
	/** Container height in px. Default 420. */
	height?: number
}

export default function EmbedShowcase({
	src,
	label,
	caption,
	height = 420
}: EmbedShowcaseProps) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [shouldLoad, setShouldLoad] = useState(false)

	useEffect(() => {
		const element = containerRef.current

		if (!element || shouldLoad) {
			return
		}

		if (typeof IntersectionObserver === 'undefined') {
			setShouldLoad(true)
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setShouldLoad(true)
					observer.disconnect()
				}
			},
			{ rootMargin: '400px 0px' }
		)

		observer.observe(element)

		return () => observer.disconnect()
	}, [shouldLoad])

	return (
		<figure className="ds-raised my-6 overflow-hidden rounded-xl">
			{label && (
				<div className="px-4 py-2">
					<span className="text-muted-foreground font-mono text-xs">
						{label}
					</span>
				</div>
			)}

			<div ref={containerRef} style={{ height }} className="w-full">
				{shouldLoad ? (
					<iframe
						src={src}
						className="h-full w-full border-0"
						allow="autoplay; xr-spatial-tracking"
						allowFullScreen
						title={label ?? 'Vectreal 3D preview'}
					/>
				) : (
					<div
						aria-hidden
						className="text-muted-foreground flex h-full w-full items-center justify-center text-xs"
					>
						Loading interactive scene…
					</div>
				)}
			</div>

			{caption && (
				<figcaption className="text-muted-foreground px-4 py-2 text-xs">
					{caption}
				</figcaption>
			)}
		</figure>
	)
}
