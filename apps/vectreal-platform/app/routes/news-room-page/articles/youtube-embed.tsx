import { Link } from 'react-router'

import { useConsent } from '../../../components/consent/consent-context'

interface YoutubeEmbedProps {
	videoId: string
	caption?: string
	/** Container height in px. Default 420. */
	height?: number
}

export default function YoutubeEmbed({
	videoId,
	caption,
	height = 420
}: YoutubeEmbedProps) {
	const { consent, setPreferencesOpen } = useConsent()

	return (
		<figure className="my-6 overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
			{consent?.marketing ? (
				<div style={{ height }} className="w-full">
					<iframe
						src={`https://www.youtube-nocookie.com/embed/${videoId}`}
						className="h-full w-full border-0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						allowFullScreen
						loading="lazy"
						title="YouTube video"
					/>
				</div>
			) : (
				<div
					style={{ height }}
					className="flex w-full flex-col items-center justify-center gap-4 px-6 text-center"
				>
					<svg
						className="h-10 w-10 text-white/20"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
					</svg>
					<p className="max-w-sm text-sm text-white/50">
						This video is hosted on YouTube. To watch it here, marketing cookies
						must be enabled.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-2">
						<button
							onClick={() => setPreferencesOpen(true)}
							className="rounded-md bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
						>
							Update cookie preferences
						</button>
						<Link
							to="/privacy-policy"
							className="text-xs text-white/40 underline underline-offset-2 hover:text-white/60"
						>
							Privacy Policy
						</Link>
					</div>
				</div>
			)}
			{caption && (
				<figcaption className="border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-white/40">
					{caption}
				</figcaption>
			)}
		</figure>
	)
}
