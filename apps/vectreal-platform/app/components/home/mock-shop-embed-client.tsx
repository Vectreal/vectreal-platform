import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { VectrealEmbed } from '@vctrl/embed'
import { ChevronsDown, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Scene configuration
// ---------------------------------------------------------------------------

const DEMO_SCENE_URL =
	typeof import.meta !== 'undefined' &&
	(import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string | undefined)
		? (import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string)
		: `https://vectreal.com/preview/fullscreen/395a09f0-9340-42f2-ac98-03339cf27c9c/bae36111-22da-46a4-85c5-2d9bfdbb8f4f?token=${import.meta.env.VITE_PUBLIC_VECTREAL_API_KEY_PROD}`

const CHAPTERS = [
	{
		id: 'default',
		label: 'Overview',
		description: 'Full-suspension carbon frame. Race geometry.'
	},
	{
		id: 'camera-1779054230007-lg5mbd',
		label: 'Detail',
		description: 'GX Eagle 12-speed drivetrain. SRAM precision.'
	},
	{
		id: 'camera-1779320332512-tded3h',
		label: 'Profile',
		description: '140mm travel. Built for technical descents.'
	},
	{
		id: 'camera-1779320572791-qm1tv5',
		label: 'Handlebars',
		description: '12.4 kg. Light enough to climb, strong enough to descend.'
	}
] as const

type ChapterId = (typeof CHAPTERS)[number]['id']

// ---------------------------------------------------------------------------

const Stars = ({ count = 4 }: { count?: number }) => (
	<div className="flex gap-0.5">
		{Array.from({ length: 5 }).map((_, i) => (
			<Star
				key={i}
				size={12}
				className={
					i < count ? 'fill-amber-400 text-amber-400' : 'text-white/15'
				}
			/>
		))}
	</div>
)

export default function MockShopEmbedClient() {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const embedRef = useRef<VectrealEmbed | null>(null)
	const sectionRef = useRef<HTMLDivElement>(null)
	const lastChapterRef = useRef<ChapterId>('default')
	const [activeChapter, setActiveChapter] = useState<ChapterId>('default')
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
			embed.setControlsEnabled(false)
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
				['default', 0],
				['camera-1779054230007-lg5mbd', 0.28],
				['camera-1779320332512-tded3h', 0.56],
				['camera-1779320572791-qm1tv5', 0.82]
			]

			let next: ChapterId = 'default'
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
				{/* Fullscreen iframe — pointer-events-none so scroll reaches parent */}
				<iframe
					ref={iframeRef}
					src={DEMO_SCENE_URL}
					className="pointer-events-none absolute inset-0 h-full w-full border-0"
					allow="autoplay; xr-spatial-tracking"
					allowFullScreen
					title="Alpine X3 Pro — interactive 3D preview"
				/>

				{/* Vignettes */}
				<div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/55 via-transparent to-black/15" />
				<div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/30 via-transparent to-black/75" />

				{/* Powered by Vectreal — top-left */}
				<div className="absolute top-6 left-6 z-10">
					<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
						<span className="bg-accent h-1.5 w-1.5 rounded-full" />
						<span className="text-xs font-medium tracking-wide text-white/60">
							Powered by Vectreal
						</span>
					</div>
				</div>

				{/* Product card — bottom-left */}
				<div className="absolute bottom-12 left-6 z-10 max-w-xs">
					<div
						key={chapter.id}
						className="rounded-2xl border border-white/10 bg-black/45 p-5 shadow-2xl backdrop-blur-md transition-all duration-500"
					>
						<div className="mb-3 flex items-center gap-3">
							<Badge className="bg-accent/90 border-0 px-2 py-0.5 text-[11px] text-white">
								Limited Edition
							</Badge>
							<Stars />
						</div>

						<h3 className="text-xl leading-snug font-semibold tracking-tight text-white">
							Alpine X3 Pro
						</h3>
						<p className="mt-0.5 text-xs font-medium tracking-widest text-white/40 uppercase">
							Mountain Bike
						</p>

						<p className="text-accent mt-4 text-2xl font-bold tracking-tight">
							$1,299.99
						</p>

						<p className="mt-3 text-sm leading-relaxed text-white/65">
							{chapter.description}
						</p>

						<Button
							disabled
							className="mt-4 w-full border-white/15 bg-white/8 text-white/70 hover:bg-white/15"
							variant="outline"
							size="sm"
						>
							Add to Cart
						</Button>

						<p className="mt-2.5 text-center text-[11px] text-white/25">
							Concept demo · Not for sale
						</p>
					</div>
				</div>

				{/* Chapter indicator — bottom-right */}
				<div className="absolute right-6 bottom-12 z-10 flex flex-col items-end gap-2.5">
					{CHAPTERS.map((c) => (
						<button
							key={c.id}
							onClick={() => {
								setActiveChapter(c.id)
								lastChapterRef.current = c.id
								if (embedReady) embedRef.current?.activateCamera(c.id)
							}}
							className="group flex items-center gap-2.5"
							aria-label={`View ${c.label}`}
						>
							<span
								className={cn(
									'text-xs font-medium tracking-wide transition-all duration-300',
									activeChapter === c.id
										? 'text-white'
										: 'text-white/30 group-hover:text-white/55'
								)}
							>
								{c.label}
							</span>
							<span
								className={cn(
									'block rounded-full transition-all duration-300',
									activeChapter === c.id
										? 'bg-accent/85 h-2 w-6'
										: 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/55'
								)}
							/>
						</button>
					))}
				</div>

				{/* Scroll hint — fades once user advances past first chapter */}
				<div
					className={cn(
						'pointer-events-none absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 transition-opacity duration-700',
						activeChapter !== 'default' ? 'opacity-0' : 'opacity-100'
					)}
				>
					<p className="text-[11px] tracking-widest text-white/35 uppercase">
						Scroll to explore
					</p>
					<ChevronsDown size={13} className="animate-bounce text-white/25" />
				</div>
			</div>
		</div>
	)
}
