import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { VectrealEmbed } from '@vctrl/embed'
import { Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Scene configuration
// ---------------------------------------------------------------------------

// Replace DEMO_SCENE_URL with your published bike scene's fullscreen preview URL.
// e.g. https://vectreal.com/preview/fullscreen/{orgId}/{sceneId}?token={token}
//
// Camera IDs must match cameras saved in the Publisher:
//   hero    — 3/4 front, FOV 50°  (landing view)
//   detail  — close on key feature, FOV 30°
//   side    — profile, FOV 55°
//   context — pulled back, FOV 65°
//
// Until the bike scene is published, the component falls back to the demo
// scene used in the article (same bike model, no camera presets configured).

const DEMO_SCENE_URL =
	typeof import.meta !== 'undefined' &&
	(import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string | undefined)
		? (import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string)
		: `https://vectreal.com/preview/fullscreen/395a09f0-9340-42f2-ac98-03339cf27c9c/bae36111-22da-46a4-85c5-2d9bfdbb8f4f?token=${import.meta.env.VITE_PUBLIC_VECTREAL_API_KEY_PROD}`

const CHAPTERS = [
	{
		id: 'hero',
		label: 'Overview',
		description: 'Full-suspension carbon frame. Race geometry.'
	},
	{
		id: 'detail',
		label: 'Detail',
		description: 'GX Eagle 12-speed drivetrain. SRAM precision.'
	},
	{
		id: 'side',
		label: 'Profile',
		description: '140mm travel. Built for technical descents.'
	},
	{
		id: 'context',
		label: 'Scale',
		description: '12.4 kg. Light enough to climb, strong enough to descend.'
	}
] as const

type ChapterId = (typeof CHAPTERS)[number]['id']

// ---------------------------------------------------------------------------

const Stars = ({ count = 4 }: { count?: number }) => (
	<div className="flex">
		{Array.from({ length: 5 }).map((_, i) => (
			<Star
				key={i}
				size={14}
				className={
					i < count ? 'fill-amber-400 text-amber-400' : 'text-white/20'
				}
			/>
		))}
	</div>
)

export default function MockShopEmbedClient() {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const embedRef = useRef<VectrealEmbed | null>(null)
	const sectionRef = useRef<HTMLDivElement>(null)
	const lastChapterRef = useRef<ChapterId>('hero')
	const [activeChapter, setActiveChapter] = useState<ChapterId>('hero')
	const [embedReady, setEmbedReady] = useState(false)

	const chapter = CHAPTERS.find((c) => c.id === activeChapter) ?? CHAPTERS[0]

	// Initialise embed SDK
	useEffect(() => {
		if (!iframeRef.current) return
		const embed = new VectrealEmbed(iframeRef.current, {
			readyTimeout: 20_000
		})
		embedRef.current = embed

		embed.ready().then(() => {
			setEmbedReady(true)
			// Smooth transition for subsequent camera switches
			embed.setTransition({
				type: 'linear',
				duration: 1200,
				easing: 'ease_in_out'
			})
			embed.setAutoRotate(false)
		})

		return () => {
			embed.destroy()
			embedRef.current = null
		}
	}, [])

	// Scroll → camera switching
	useEffect(() => {
		const section = sectionRef.current
		if (!section) return

		const handleScroll = () => {
			const rect = section.getBoundingClientRect()
			const scrollable = rect.height - window.innerHeight
			if (scrollable <= 0) return
			const progress = Math.max(0, Math.min(1, -rect.top / scrollable))

			const thresholds: [ChapterId, number][] = [
				['hero', 0],
				['detail', 0.28],
				['side', 0.56],
				['context', 0.82]
			]

			let next: ChapterId = 'hero'
			for (const [id, t] of thresholds) {
				if (progress >= t) next = id
			}

			if (next !== lastChapterRef.current) {
				lastChapterRef.current = next
				setActiveChapter(next)
				if (embedReady) embedRef.current?.activateCamera(next)
			}
		}

		window.addEventListener('scroll', handleScroll, { passive: true })
		return () => window.removeEventListener('scroll', handleScroll)
	}, [embedReady])

	return (
		// Sticky scroll container — 4× viewport height gives comfortable pacing
		<div ref={sectionRef} className="relative" style={{ height: '400vh' }}>
			<div className="sticky top-0 h-screen overflow-hidden bg-black">
				{/* Fullscreen iframe */}
				<iframe
					ref={iframeRef}
					src={DEMO_SCENE_URL}
					className="absolute inset-0 h-full w-full border-0"
					allow="autoplay; xr-spatial-tracking"
					allowFullScreen
					title="Alpine X3 Pro — interactive 3D preview"
				/>

				{/* Subtle vignette so UI text is legible */}
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/20" />
				<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

				{/* Top-left category badge */}
				<div className="absolute top-6 left-6 z-10">
					<Badge
						variant="outline"
						className="border-white/20 bg-black/30 px-3 py-1 text-xs text-white backdrop-blur-sm"
					>
						Live 3D Preview — Powered by Vectreal
					</Badge>
				</div>

				{/* Product card — bottom-left */}
				<div className="absolute bottom-12 left-6 z-10 max-w-xs">
					<div
						key={chapter.id}
						className="rounded-xl border border-white/10 bg-black/40 p-5 shadow-2xl backdrop-blur-md transition-all duration-500"
					>
						<div className="mb-3 flex items-center gap-3">
							<Badge className="bg-accent border-0 text-white">
								Limited Edition
							</Badge>
							<Stars />
						</div>

						<h3 className="text-xl leading-snug font-semibold text-white">
							Alpine X3 Pro
						</h3>
						<p className="mt-0.5 text-sm text-white/50">Mountain Bike</p>

						<p className="text-accent mt-4 text-2xl font-bold">$1,299.99</p>

						<p className="mt-3 text-sm leading-relaxed text-white/70">
							{chapter.description}
						</p>

						<Button
							disabled
							className="mt-4 w-full border-white/20 bg-white/10 text-white hover:bg-white/20"
							variant="outline"
						>
							Add to Cart
						</Button>
					</div>
				</div>

				{/* Chapter indicator — bottom-right */}
				<div className="absolute right-6 bottom-12 z-10 flex flex-col items-end gap-3">
					{CHAPTERS.map((c) => (
						<button
							key={c.id}
							onClick={() => {
								setActiveChapter(c.id)
								lastChapterRef.current = c.id
								if (embedReady) embedRef.current?.activateCamera(c.id)
							}}
							className="group flex items-center gap-2"
							aria-label={`View ${c.label}`}
						>
							<span
								className={`text-xs font-medium transition-all duration-300 ${
									activeChapter === c.id
										? 'text-white'
										: 'text-white/30 group-hover:text-white/60'
								}`}
							>
								{c.label}
							</span>
							<span
								className={`block h-2 rounded-full transition-all duration-300 ${
									activeChapter === c.id
										? 'bg-accent w-6'
										: 'w-2 bg-white/30 group-hover:bg-white/60'
								}`}
							/>
						</button>
					))}
				</div>

				{/* Scroll hint — fades out once user starts scrolling */}
				<div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center">
					<p className="animate-bounce text-xs text-white/40">
						Scroll to explore
					</p>
				</div>
			</div>
		</div>
	)
}
