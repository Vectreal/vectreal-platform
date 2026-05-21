import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { VectrealEmbed } from '@vctrl/embed'
import { ChevronsDown } from 'lucide-react'
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
		description: 'Built from full-carbon to carve through technical terrain at speed.'
	},
	{
		id: 'camera-1779054230007-lg5mbd',
		label: 'Drivetrain',
		description: 'SRAM GX Eagle keeps you shifting precisely across every pitch.'
	},
	{
		id: 'camera-1779320332512-tded3h',
		label: 'Profile',
		description: 'Geometry tuned for rowdy descents. Capable enough to earn them.'
	},
	{
		id: 'camera-1779320572791-qm1tv5',
		label: 'Cockpit',
		description: 'Carbon cockpit, 12.4 kg. Nothing extra, nothing missing.'
	}
] as const

type ChapterId = (typeof CHAPTERS)[number]['id']

// ---------------------------------------------------------------------------

export default function MockShopEmbedClient() {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const embedRef = useRef<VectrealEmbed | null>(null)
	const sectionRef = useRef<HTMLDivElement>(null)
	const lastChapterRef = useRef<ChapterId>('default')
	const [activeChapter, setActiveChapter] = useState<ChapterId>('default')
	const [embedReady, setEmbedReady] = useState(false)

	const chapter = CHAPTERS.find((c) => c.id === activeChapter) ?? CHAPTERS[0]

	// Fade-swap state for description — opacity out → swap text → opacity in
	const [displayedDesc, setDisplayedDesc] = useState(chapter.description)
	const [descFading, setDescFading] = useState(false)

	useEffect(() => {
		if (chapter.description === displayedDesc) return
		setDescFading(true)
		const t = setTimeout(() => {
			setDisplayedDesc(chapter.description)
			setDescFading(false)
		}, 180)
		return () => clearTimeout(t)
	}, [chapter.description])

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

	const activateChapter = (id: ChapterId) => {
		setActiveChapter(id)
		lastChapterRef.current = id
		if (embedReady) embedRef.current?.activateCamera(id)
	}

	const descStyle = {
		transition: 'opacity 0.18s ease',
		opacity: descFading ? 0 : 1
	}

	return (
		// Sticky scroll container — 4× viewport height gives comfortable pacing
		<div ref={sectionRef} className="relative" style={{ height: '400vh' }}>
			<div className="sticky top-0 h-screen overflow-hidden bg-black">
				{/* Fullscreen iframe — hidden until embed is ready to prevent HDR flash */}
				<iframe
					ref={iframeRef}
					src={DEMO_SCENE_URL}
					className={cn(
						'pointer-events-none absolute inset-0 h-full w-full border-0 transition-opacity duration-1000',
						embedReady ? 'opacity-100' : 'opacity-0'
					)}
					allow="autoplay; xr-spatial-tracking"
					allowFullScreen
					title="Alpine X3 Pro — interactive 3D preview"
				/>

				{/* Touch passthrough — lets vertical scroll reach the page on mobile */}
				<div
					className="absolute inset-0 z-[1]"
					style={{ touchAction: 'pan-y' }}
				/>

				{/* Vignettes */}
				<div className="pointer-events-none absolute inset-0 z-[2] bg-linear-to-r from-black/55 via-transparent to-black/15" />
				<div className="pointer-events-none absolute inset-0 z-[2] bg-linear-to-b from-black/30 via-transparent to-black/75" />

				{/* Powered by Vectreal — top-left, offset below nav on mobile */}
				<div className="absolute top-20 left-6 z-10 lg:top-6">
					<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
						<span className="bg-accent h-1.5 w-1.5 rounded-full" />
						<span className="text-xs font-medium tracking-wide text-white/60">
							Powered by Vectreal
						</span>
					</div>
				</div>

				{/* ── Desktop layout ─────────────────────────────────────────── */}

				{/* Product card — bottom-left */}
				<div className="absolute bottom-14 left-6 z-10 hidden max-w-xs md:block">
					<div className="rounded-2xl border border-white/10 bg-black/45 p-5 shadow-2xl backdrop-blur-md">
						<p className="text-[10px] font-medium tracking-[0.18em] text-white/30 uppercase">
							Mountain Bike · Carbon
						</p>

						<h3 className="mt-2 text-xl leading-snug font-semibold tracking-tight text-white">
							Alpine X3 Pro
						</h3>

						<p className="mt-1 text-[10px] tracking-wider text-white/25 uppercase">
							140mm · 12.4 kg · GX Eagle
						</p>

						<p className="text-accent mt-4 text-2xl font-bold tracking-tight">
							$1,299.99
						</p>

						{/* Fixed min-height prevents layout shift across description lengths */}
						<div className="mt-3 min-h-[3rem]">
							<p
								style={descStyle}
								className="text-sm leading-relaxed text-white/60"
							>
								{displayedDesc}
							</p>
						</div>

						<Button
							disabled
							className="mt-4 w-full border-white/10 bg-white/6 text-white/50 hover:bg-white/10"
							variant="outline"
							size="sm"
						>
							Add to Cart
						</Button>

						<p className="mt-2.5 text-center text-[11px] text-white/20">
							Concept demo · Not for sale
						</p>
					</div>
				</div>

				{/* Chapter indicator — bottom-right */}
				<div className="absolute right-6 bottom-14 z-10 hidden flex-col items-end gap-2.5 md:flex">
					{CHAPTERS.map((c) => (
						<button
							key={c.id}
							onClick={() => activateChapter(c.id)}
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
							{/* Fixed-width container prevents label shift on dot resize */}
							<span className="flex w-6 shrink-0 items-center justify-end">
								<span
									className={cn(
										'block rounded-full transition-all duration-300',
										activeChapter === c.id
											? 'bg-accent/85 h-2 w-6'
											: 'h-2 w-1.5 bg-white/25 group-hover:bg-white/55'
									)}
								/>
							</span>
						</button>
					))}
				</div>

				{/* Scroll hint — desktop */}
				<div
					className={cn(
						'pointer-events-none absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1.5 transition-opacity duration-700 md:flex',
						activeChapter !== 'default' ? 'opacity-0' : 'opacity-100'
					)}
				>
					<p className="text-[11px] tracking-widest text-white/35 uppercase">
						Scroll to explore
					</p>
					<ChevronsDown size={13} className="animate-bounce text-white/25" />
				</div>

				{/* ── Mobile layout ──────────────────────────────────────────── */}

				<div className="absolute inset-x-0 bottom-10 z-10 flex flex-col gap-4 px-4 md:hidden">
					{/* Scroll hint */}
					<div
						className={cn(
							'pointer-events-none flex flex-col items-center gap-1.5 transition-opacity duration-700',
							activeChapter !== 'default' ? 'opacity-0' : 'opacity-100'
						)}
					>
						<p className="text-[11px] tracking-widest text-white/35 uppercase">
							Scroll to explore
						</p>
						<ChevronsDown size={13} className="animate-bounce text-white/25" />
					</div>

					{/* Chapter indicators — centered */}
					<div className="flex justify-center gap-6">
						{CHAPTERS.map((c) => (
							<button
								key={c.id}
								onClick={() => activateChapter(c.id)}
								className="group flex flex-col items-center gap-1"
								aria-label={`View ${c.label}`}
							>
								<span
									className={cn(
										'text-[10px] font-medium tracking-wide transition-all duration-300',
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
											? 'bg-accent/85 h-1.5 w-5'
											: 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/55'
									)}
								/>
							</button>
						))}
					</div>

					{/* Compact product bar */}
					<div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md">
						<div className="min-w-0 flex-1 pr-4">
							<p className="text-sm font-semibold text-white">Alpine X3 Pro</p>
							<p
								style={descStyle}
								className="truncate text-[11px] text-white/40"
							>
								{displayedDesc}
							</p>
						</div>
						<p className="text-accent shrink-0 text-base font-bold">$1,299.99</p>
					</div>
				</div>
			</div>
		</div>
	)
}
