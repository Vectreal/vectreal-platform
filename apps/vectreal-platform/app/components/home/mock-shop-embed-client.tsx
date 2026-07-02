import { cn } from '@shared/utils'
import { VectrealEmbed } from '@vctrl/embed'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ChevronsDown, MousePointerClick, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ChapterRail } from './mock-shop-chapter-rail'
import {
	CHAPTERS,
	chapterIdByPos,
	chapterIndexById,
	chapterPosFromProgress,
	chapterProgressByIndex,
	DEMO_SCENE_URL,
	type ChapterId
} from './mock-shop-chapters'
import { Filmstrip } from './mock-shop-filmstrip'

// Camera switches wait this long after the last scroll movement, so the camera
// only changes once scrolling settles (or the user blows past intermediate
// chapters) instead of thrashing continuously as the filmstrip glides.
const CAMERA_SETTLE_MS = 160

export default function MockShopEmbedClient() {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const embedRef = useRef<VectrealEmbed | null>(null)
	const sectionRef = useRef<HTMLDivElement>(null)

	// activeChapterRef: what the user is currently looking at (follows scroll).
	// cameraChapterRef: the last camera we actually activated (settle-debounced).
	const activeChapterRef = useRef<ChapterId>('default')
	const cameraChapterRef = useRef<ChapterId>('default')
	const interactiveModeRef = useRef(false)
	const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [activeChapter, setActiveChapter] = useState<ChapterId>('default')
	const [embedReady, setEmbedReady] = useState(false)
	const [interactiveMode, setInteractiveMode] = useState(false)

	const prefersReducedMotion = useReducedMotion()

	const { scrollYProgress } = useScroll({
		target: sectionRef,
		offset: ['start start', 'end end']
	})

	// Single source of truth: scroll progress. The visuals derive from it directly
	// via array-form transforms (compositor-driven, no per-frame JS). The camera
	// and aria — the discrete side — read the chapter position computed from the
	// same progress on demand, so nothing can drift apart.
	const chapterPosNow = () => chapterPosFromProgress(scrollYProgress.get())

	// Scroll hint fades out once the user leaves the first chapter.
	const hintOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0])

	// Activate a chapter's camera, de-duplicated against the last one activated.
	const activateCamera = (id: ChapterId) => {
		if (id === cameraChapterRef.current) return
		cameraChapterRef.current = id
		if (embedReady) embedRef.current?.activateCamera(id)
	}

	// Keep ref in sync so the scroll listener reads the current value.
	useEffect(() => {
		interactiveModeRef.current = interactiveMode
	}, [interactiveMode])

	// The aria/current chapter follows the rounded position (for the tab's
	// aria-current); the camera waits for the scroll to settle so it only commits
	// to a definite chapter once you stop or blow past intermediate steps.
	useMotionValueEvent(scrollYProgress, 'change', () => {
		// Track the current chapter without a re-render — the tab emphasis is a
		// motion transform, so nothing visual needs React state mid-scroll. Keeping
		// setState out of the per-frame path avoids reconciliation hitches while
		// free-scrolling; aria-current and the camera update on settle instead.
		activeChapterRef.current = chapterIdByPos(chapterPosNow())

		if (interactiveModeRef.current) return
		if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
		settleTimerRef.current = setTimeout(() => {
			if (interactiveModeRef.current) return
			const id = chapterIdByPos(chapterPosNow())
			activeChapterRef.current = id
			setActiveChapter(id)
			activateCamera(id)
		}, CAMERA_SETTLE_MS)
	})

	// Initialise embed SDK.
	useEffect(() => {
		if (!iframeRef.current) return
		const embed = new VectrealEmbed(iframeRef.current, { readyTimeout: 20_000 })
		embedRef.current = embed

		embed.ready().then(() => {
			setEmbedReady(true)
			embed.setControlsEnabled(false)
			embed.setTransition({ type: 'linear', duration: 1200, easing: 'ease_in_out' })
			embed.setAutoRotate(false)
		})

		return () => {
			embed.destroy()
			embedRef.current = null
		}
	}, [])

	// Re-sync camera when the page regains visibility (prevents drift after a tab switch).
	useEffect(() => {
		if (!embedReady) return
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				embedRef.current?.activateCamera(activeChapterRef.current)
				cameraChapterRef.current = activeChapterRef.current
			}
		}
		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () =>
			document.removeEventListener('visibilitychange', handleVisibilityChange)
	}, [embedReady])

	// Enable the section's vertical scroll-snap only while it is on screen, and
	// re-assert the camera on re-entry. scroll-snap-type lives on the document
	// element (the window scroller), so leaving it on globally makes the rest of
	// the page — notably the horizontal card carousels — feel stuck in vertical
	// snap on touch; gating it to visibility keeps snapping to the chapters only.
	// The camera re-assert fixes the embed resetting to its default while
	// offscreen (bypassing the activateCamera dedupe, which would otherwise skip).
	useEffect(() => {
		const section = sectionRef.current
		if (!section) return
		const html = document.documentElement
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					html.style.scrollSnapType = 'y proximity'
					if (embedReady && !interactiveModeRef.current) {
						const id = chapterIdByPos(chapterPosNow())
						cameraChapterRef.current = id
						embedRef.current?.activateCamera(id)
					}
				} else {
					html.style.scrollSnapType = ''
				}
			},
			{ threshold: 0 }
		)
		io.observe(section)
		return () => {
			io.disconnect()
			html.style.scrollSnapType = ''
		}
	}, [embedReady])

	// Lock body scroll on mobile when fullscreen interactive mode is active.
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

	// Tab click: jump straight to the chapter (user-initiated, so switch immediately).
	const handleSelectChapter = (id: ChapterId) => {
		if (interactiveMode) return
		activeChapterRef.current = id
		setActiveChapter(id)
		activateCamera(id)

		const section = sectionRef.current
		if (!section) return
		const sectionTop = section.getBoundingClientRect().top + window.scrollY
		const scrollable = section.offsetHeight - window.innerHeight
		const progress = chapterProgressByIndex(chapterIndexById(id))
		window.scrollTo({
			top: sectionTop + progress * scrollable,
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
		if (embedReady) embedRef.current?.activateCamera(activeChapterRef.current)
		cameraChapterRef.current = activeChapterRef.current
	}

	return (
		<div ref={sectionRef} className="relative" style={{ height: '300vh' }}>
			{/* Snap anchors — one per chapter at its scroll offset (scrollable range
			    is 200vh: the 300vh section minus the 100vh sticky stage) */}
			{CHAPTERS.map((c, i) => (
				<div
					key={`anchor-${c.id}`}
					aria-hidden
					className="pointer-events-none absolute left-0 h-px w-px"
					style={{
						top: `${chapterProgressByIndex(i) * 200}vh`,
						scrollSnapAlign: 'start'
					}}
				/>
			))}

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
										interactiveMode ? 'pointer-events-auto' : 'pointer-events-none'
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

								{/* Interact / Exit — inside canvas bounds, bottom-right. On mobile in
								    interactive mode this is hidden; a fixed sibling button handles exit. */}
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
								3D visualization powered by Vectreal · Concept demo, not for sale
							</p>

							{/* Mobile chapter rail — desktop uses the bottom rail instead */}
							<ChapterRail
								progress={scrollYProgress}
								activeChapter={activeChapter}
								onSelect={handleSelectChapter}
								className={cn(
									'mt-1 transition-opacity duration-300 md:hidden',
									interactiveMode && 'pointer-events-none opacity-30'
								)}
							/>
						</div>

						{/* ── Text column: scroll-tracked filmstrip ─────────────── */}
						<div
							className={cn(
								'transition-opacity duration-300',
								interactiveMode && 'pointer-events-none opacity-30'
							)}
						>
							<Filmstrip
								progress={scrollYProgress}
								reduced={!!prefersReducedMotion}
							/>
						</div>
					</div>

					{/* Desktop chapter rail */}
					<ChapterRail
						progress={scrollYProgress}
						activeChapter={activeChapter}
						onSelect={handleSelectChapter}
						className={cn(
							'w-full max-w-xl transition-opacity duration-300 max-md:hidden',
							interactiveMode && 'pointer-events-none opacity-30'
						)}
					/>

					{/* Scroll hint — fades out after first chapter */}
					<motion.div
						style={{ opacity: prefersReducedMotion ? undefined : hintOpacity }}
						className="pointer-events-none absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5"
					>
						<p className="text-[11px] tracking-widest text-white/30 uppercase">
							Scroll to explore
						</p>
						<ChevronsDown size={12} className="animate-bounce text-white/20" />
					</motion.div>
				</div>
			</div>

			{/* Mobile-only exit button — outside the iframe stacking context so touch events reach it */}
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
