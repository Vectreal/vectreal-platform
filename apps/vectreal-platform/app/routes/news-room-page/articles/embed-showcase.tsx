/**
 * EmbedShowcase - an article-level wrapper for Vectreal iframe embeds.
 * Provides consistent caption, label, and sizing so embeds look intentional
 * rather than raw iframes dropped inline.
 *
 * Usage in MDX:
 *   import EmbedShowcase from './embed-showcase'
 *   <EmbedShowcase
 *     src="https://vectreal.com/preview/fullscreen/…?token=…"
 *     label="Linear transition · Ease in-out · 1000 ms"
 *     caption="Switch cameras to see the linear transition in action."
 *     height={420}
 *   />
 */

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
	return (
		<figure className="my-6 overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
			{label && (
				<div className="border-b border-white/10 bg-white/5 px-4 py-2">
					<span className="font-mono text-xs text-white/50">{label}</span>
				</div>
			)}
			<div style={{ height }} className="w-full">
				<iframe
					src={src}
					className="h-full w-full border-0"
					allow="autoplay; xr-spatial-tracking"
					allowFullScreen
					loading="lazy"
					title={label ?? 'Vectreal 3D preview'}
				/>
			</div>
			{caption && (
				<figcaption className="border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-white/40">
					{caption}
				</figcaption>
			)}
		</figure>
	)
}
