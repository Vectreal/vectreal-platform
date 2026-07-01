import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { VectrealEmbed } from '@vctrl/embed'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronsDown, MousePointerClick, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Scene configuration
// ---------------------------------------------------------------------------

const DEMO_SCENE_URL =
	typeof import.meta !== 'undefined' &&
	(import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string | undefined)
		? (import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string)
		: `https://vectreal.com/preview/fullscreen/395a09f0-9340-42f2-ac98-03339cf27c9c/488bd4a1-46d3-4ee1-8497-25f68a5d6fa2?token=${import.meta.env.VITE_PUBLIC_VECTREAL_API_KEY_PROD}`

const CHAPTERS = [
	{
		id: 'default',
		label: 'Shop View',
		heading: '911 GT3',
		description:
			'A real product listing powered by Vectreal. Customers scroll through camera presets to inspect every detail — no plugin required.',
		type: 'shop' as const,
		code: null,
		threshold: 0
	},
	{
		id: 'side-view',
		label: 'Camera Presets',
		heading: 'Guided views,\nzero extra code.',
		description:
			'Define named camera positions in the Vectreal editor. Switch between them at runtime with one SDK call — smooth interpolation included.',
		type: 'feature' as const,
		code: "embed.activateCamera('drivetrain')",
		threshold: 0.25
	},
	{
		id: 'light-closeup',
		label: 'React SDK',
		heading: 'Drop in.\nConfigure from JSX.',
		description:
			'The Vectreal React component renders photorealistic 3D in any React or Next.js project. Lighting, materials, and controls — all as props.',
		type: 'feature' as const,
		code: '<VectrealViewer src={modelUrl} />',
		threshold: 0.5
	},
	{
		id: 'back-side',
		label: 'Embed',
		heading: 'One iframe.\nAny platform.',
		description:
			'Paste an <iframe> into Shopify, Webflow, or WordPress. Drive cameras and events via the Vectreal JS SDK — no framework needed.',
		type: 'feature' as const,
		code: '<iframe src="vectreal.com/preview/…" />',
		threshold: 0.75
	}
] as const

type ChapterId = (typeof CHAPTERS)[number]['id']

// Single source of truth for threshold → scroll position mapping
const chapterThresholds = Object.fromEntries(
	CHAPTERS.map((c) => [c.id, c.threshold])
) as Record<ChapterId, number>

// ---------------------------------------------------------------------------

export default function MockShopEmbedClient() {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const embedRef = useRef<VectrealEmbed | null>(null)
	const sectionRef = useRef<HTMLDivElement>(null)
	const lastChapterRef = useRef<ChapterId>('default')
	const suppressScrollRef = useRef(false)
	const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const snapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const interactiveModeRef = useRef(false)

	const [activeChapter, setActiveChapter] = useState<ChapterId>('default')
	const [embedReady, setEmbedReady] = useState(false)
	const [interactiveMode, setInteractiveMode] = useState(false)

	const chapter = CHAPTERS.find((c) => c.id === activeChapter) ?? CHAPTERS[0]

	// Keep ref in sync so scroll handler reads current value without stale closure
	useEffect(() => {
		interactiveModeRef.current = interactiveMode
	}, [interactiveMode])

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

	// Re-sync camera when the page regains visibility (prevents drift after tab switch)
	useEffect(() => {
		if (!embedReady) return
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				embedRef.current?.activateCamera(lastChapterRef.current)
			}
		}
		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () =>
			document.removeEventListener('visibilitychange', handleVisibilityChange)
	}, [embedReady])

	// Scroll → camera switching + snap-to-chapter on settle
	useEffect(() => {
		const section = sectionRef.current
		if (!section) return

		const handleScroll = () => {
			if (suppressScrollRef.current) return
			if (interactiveModeRef.current) return

			const rect = section.getBoundingClientRect()
			const scrollable = rect.height - window.innerHeight
			if (scrollable <= 0) return

			// Outside sticky range — cancel any queued snap and leave page scroll alone
			if (rect.top > 0 || rect.bottom < window.innerHeight) {
				if (snapDebounceRef.current) clearTimeout(snapDebounceRef.current)
				return
			}

			const progress = Math.max(0, Math.min(1, -rect.top / scrollable))

			let next: ChapterId = CHAPTERS[0].id
			for (const c of CHAPTERS) {
				if (progress >= c.threshold) next = c.id
			}

			if (next !== lastChapterRef.current) {
				lastChapterRef.current = next
				setActiveChapter(next)
				if (embedReady) embedRef.current?.activateCamera(next)
			}

			// After scroll settles, snap exactly to the chapter's scroll position
			if (snapDebounceRef.current) clearTimeout(snapDebounceRef.current)
			snapDebounceRef.current = setTimeout(() => {
				if (interactiveModeRef.current) return
				const sectionTop = section.getBoundingClientRect().top + window.scrollY
				const targetY =
					sectionTop + chapterThresholds[lastChapterRef.current] * scrollable

				suppressScrollRef.current = true
				if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
				suppressTimerRef.current = setTimeout(() => {
					suppressScrollRef.current = false
				}, 1000)

				window.scrollTo({ top: targetY, behavior: 'smooth' })
			}, 80)
		}

		window.addEventListener('scroll', handleScroll, { passive: true })
		return () => window.removeEventListener('scroll', handleScroll)
	}, [embedReady])

	const activateChapter = (id: ChapterId) => {
		if (interactiveMode) return

		setActiveChapter(id)
		lastChapterRef.current = id
		if (embedReady) embedRef.current?.activateCamera(id)

		const section = sectionRef.current
		if (!section) return

		suppressScrollRef.current = true
		if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
		suppressTimerRef.current = setTimeout(() => {
			suppressScrollRef.current = false
		}, 1000)

		const sectionTop = section.getBoundingClientRect().top + window.scrollY
		const scrollable = section.offsetHeight - window.innerHeight
		window.scrollTo({
			top: sectionTop + chapterThresholds[id] * scrollable,
			behavior: 'smooth'
		})
	}

	const handleEnterInteractive = () => {
		if (!embedReady) return
		setInteractiveMode(true)
		embedRef.current?.setControlsEnabled(true)
	}

	const handleExitInteractive = () => {
		setInteractiveMode(false)
		embedRef.current?.setControlsEnabled(false)
		if (embedReady) embedRef.current?.activateCamera(lastChapterRef.current)
	}

	// Lock body scroll on mobile when fullscreen interactive mode is active
	useEffect(() => {
		const isMobile = window.matchMedia('(max-width: 767px)').matches
		if (!isMobile) return

		if (interactiveMode) {
			document.body.style.overflow = 'hidden'
			document.body.style.touchAction = 'none'
		} else {
			document.body.style.overflow = ''
			document.body.style.touchAction = ''
		}

		return () => {
			document.body.style.overflow = ''
			document.body.style.touchAction = ''
		}
	}, [interactiveMode])

	return (
		<div ref={sectionRef} className="relative" style={{ height: '300vh' }}>
			{/* Sticky stage */}
			<div className="bg-background sticky top-0 h-screen overflow-hidden">
				<div className="mx-auto flex h-full w-full max-w-[2000px] flex-col items-center justify-center gap-16 px-5 py-16 md:px-10 md:py-10 lg:px-14">
					<div className="grid grid-cols-1 gap-5 md:grid-cols-[3fr_2fr] md:items-center md:gap-8 lg:gap-12">
						{/* ── Scene ─────────────────────────────────────────────── */}
						<div className="flex flex-col gap-2">
							<div
								onClick={
									!interactiveMode && embedReady
										? handleEnterInteractive
										: undefined
								}
								className={cn(
									'relative aspect-4/3 overflow-hidden rounded-2xl bg-white/4 shadow-2xl transition-all duration-500',
									!interactiveMode &&
										embedReady &&
										'md:hover:bg-muted/50 md:cursor-pointer md:hover:scale-[1.015]',
									interactiveMode &&
										'fixed inset-0 z-50 aspect-auto rounded-none md:relative md:inset-auto md:z-auto md:aspect-4/3 md:rounded-2xl'
								)}
							>
								<iframe
									ref={iframeRef}
									src={DEMO_SCENE_URL}
									className={cn(
										'absolute inset-0 h-full w-full border-0',
										interactiveMode
											? 'pointer-events-auto'
											: 'pointer-events-none'
									)}
									allow="autoplay; xr-spatial-tracking"
									allowFullScreen
									title="Porsche 911 GT3 - interactive 3D preview"
								/>

								{/* Touch passthrough — lets vertical scroll reach the page */}
								{!interactiveMode && (
									<div
										className="absolute inset-0 z-1"
										style={{ touchAction: 'pan-y' }}
									/>
								)}

								{/* Powered by Vectreal — top-left */}
								<div className="absolute top-3 left-3 z-10">
									<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
										<span className="bg-accent h-1.5 w-1.5 rounded-full" />
										<span className="text-xs font-medium tracking-wide text-white/55">
											Powered by Vectreal
										</span>
									</div>
								</div>

								{/* Interact / Exit — inside canvas bounds, bottom-right */}
								{/* On mobile in interactive mode, this button is hidden; a fixed sibling button handles exit instead */}
								<button
									onClick={
										interactiveMode
											? handleExitInteractive
											: handleEnterInteractive
									}
									disabled={!embedReady}
									className={cn(
										'border-primary/10 bg-background/30 absolute z-10 items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-medium tracking-[0.08em] uppercase backdrop-blur-sm transition-all duration-200',
										interactiveMode ? 'hidden md:flex' : 'flex',
										interactiveMode
											? 'border-primary/20 text-primary/80 hover:text-primary right-3 bottom-3'
											: 'text-primary/50 hover:border-primary/20 hover:text-primary/90 right-3 bottom-3',
										!embedReady && 'pointer-events-none opacity-0'
									)}
									aria-label={
										interactiveMode
											? 'Exit interactive mode'
											: 'Click and drag to orbit the model'
									}
								>
									{interactiveMode ? (
										<>
											<X size={11} />
											<span>Exit</span>
										</>
									) : (
										<>
											<MousePointerClick size={11} />
											<span>Interact</span>
										</>
									)}
								</button>
							</div>

							{/* Caption — sits directly below the viewer */}
							<p className="text-foreground/20 px-0.5 text-[10px] leading-relaxed">
								3D visualization powered by Vectreal · Concept demo, not for
								sale
							</p>
							{
								<div
									className={cn(
										'flex flex-wrap gap-x-5 gap-y-1 transition-opacity duration-300 md:gap-x-6',
										interactiveMode && 'pointer-events-none opacity-30',
										'md:invisible md:hidden' // Hidden on smaller screens to save space (scrolling is easier than clicking tabs on mobile anyway)
									)}
								>
									{CHAPTERS.map((c) => (
										<button
											key={c.id}
											onClick={() => activateChapter(c.id)}
											className="group relative pb-2.5"
											aria-label={`View ${c.label}`}
										>
											<span
												className={cn(
													'text-[10px] font-medium tracking-[0.12em] uppercase transition-colors duration-300',
													activeChapter === c.id
														? 'text-foreground'
														: 'text-foreground/25 group-hover:text-foreground/55'
												)}
											>
												{c.label}
											</span>
											<span
												className={cn(
													'absolute right-0 bottom-0 left-0 h-px rounded-full transition-opacity duration-500',
													activeChapter === c.id
														? 'bg-accent opacity-100'
														: 'opacity-0'
												)}
											/>
										</button>
									))}
								</div>
							}
						</div>

						{/* ── Text column ───────────────────────────────────────── */}
						<div
							className={cn(
								'flex flex-col gap-5 transition-opacity duration-300 md:gap-6',
								interactiveMode && 'pointer-events-none opacity-30'
							)}
						>
							{/* Animated chapter content */}
							<AnimatePresence mode="wait">
								<motion.div
									key={activeChapter}
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -12 }}
									transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.55 }}
									className="flex flex-col gap-3"
								>
									{/* Eyebrow label */}
									<p className="text-accent/80 text-[10px] font-semibold tracking-[0.22em] uppercase">
										{chapter.label}
									</p>

									{/* Heading — each \n becomes a block span for line-break control */}
									<h4 className="text-foreground text-[1.75rem] leading-[1.1] tracking-tight md:text-3xl lg:text-[2.125rem]">
										{chapter.heading.split('\n').map((line, i) => (
											<span key={i} className="block">
												{line}
											</span>
										))}
									</h4>

									{/* Description */}
									<p className="text-foreground/50 text-sm leading-relaxed md:text-[0.9375rem]">
										{chapter.description}
									</p>

									{/* Conditional: shop CTA vs SDK code snippet */}
									{chapter.type === 'shop' ? (
										<div className="mt-1 flex flex-col gap-3">
											<div>
												<p className="text-foreground/25 text-[10px] tracking-[0.18em] uppercase">
													Coupe · 4.0L Flat-6 · 510 HP · Jet Black Metallic
												</p>
												<p className="text-accent mt-1 text-2xl font-bold tracking-tight">
													$182,900
												</p>
											</div>
											<Button
												disabled
												className="border-foreground/10 bg-foreground/5 text-foreground/40 w-full"
												variant="outline"
												size="sm"
											>
												Configure
											</Button>
											<p className="text-foreground/20 text-[11px]">
												Concept demo · Not for sale
											</p>
										</div>
									) : (
										<div className="border-foreground/[0.07] bg-foreground/3 mt-1 rounded-xl border px-4 py-3">
											<code className="text-foreground/55 font-mono text-[11px] break-all md:text-xs">
												{chapter.code}
											</code>
										</div>
									)}
								</motion.div>
							</AnimatePresence>
						</div>
					</div>

					{/* Chapter tab rail */}
					{
						<div
							className={cn(
								'flex flex-wrap gap-x-5 gap-y-1 transition-opacity duration-300 md:gap-x-6',
								interactiveMode && 'pointer-events-none opacity-30',
								'max-md:invisible max-md:hidden' // Hidden on smaller screens
							)}
						>
							{CHAPTERS.map((c) => (
								<button
									key={c.id}
									onClick={() => activateChapter(c.id)}
									className="group relative pb-2.5"
									aria-label={`View ${c.label}`}
								>
									<span
										className={cn(
											'text-[10px] font-medium tracking-[0.12em] uppercase transition-colors duration-300',
											activeChapter === c.id
												? 'text-foreground'
												: 'text-foreground/25 group-hover:text-foreground/55'
										)}
									>
										{c.label}
									</span>
									<span
										className={cn(
											'absolute right-0 bottom-0 left-0 h-px rounded-full transition-opacity duration-500',
											activeChapter === c.id
												? 'bg-accent opacity-100'
												: 'opacity-0'
										)}
									/>
								</button>
							))}
						</div>
					}

					{/* Scroll hint — fades out after first chapter */}
					<div
						className={cn(
							'pointer-events-none absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 transition-opacity duration-700'
						)}
					>
						<p className="text-[11px] tracking-widest text-white/30 uppercase">
							Scroll to explore
						</p>
						<ChevronsDown size={12} className="animate-bounce text-white/20" />
					</div>
				</div>
			</div>

			{/* Mobile-only exit button — rendered outside the iframe stacking context so touch events reach it reliably */}
			{interactiveMode && (
				<div className="fixed right-0 bottom-8 left-0 z-60 flex justify-center md:hidden">
					<button
						onClick={handleExitInteractive}
						className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-5 py-3 text-sm font-medium tracking-[0.08em] text-white/90 uppercase backdrop-blur-md"
					>
						<X size={14} />
						<span>Exit</span>
					</button>
				</div>
			)}
		</div>
	)
}
