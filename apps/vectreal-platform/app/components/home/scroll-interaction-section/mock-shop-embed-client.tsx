import { cn } from '@shared/utils'
import { VectrealEmbed } from '@vctrl/embed'
import {
	motion,
	useMotionValueEvent,
	useReducedMotion,
	useScroll,
	useTransform
} from 'framer-motion'
import { ChevronsDown, MousePointerClick, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

interface MockShopEmbedClientProps {
	isMobileViewport?: boolean
}

export default function MockShopEmbedClient({
	isMobileViewport
}: MockShopEmbedClientProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const embedRef = useRef<VectrealEmbed | null>(null)
	const sectionRef = useRef<HTMLDivElement>(null)
	const lockScrollYRef = useRef(0)
	const bodyStyleSnapshotRef = useRef<{
		position: string
		top: string
		left: string
		right: string
		width: string
		overflow: string
	} | null>(null)
	const isProgrammaticSnapRef = useRef(false)

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

	const getChapterTop = (id: ChapterId) => {
		const section = sectionRef.current
		if (!section) return null
		const sectionTop = section.getBoundingClientRect().top + window.scrollY
		const scrollable = section.offsetHeight - window.innerHeight
		const progress = chapterProgressByIndex(chapterIndexById(id))
		return sectionTop + progress * scrollable
	}

	const snapToChapter = (
		id: ChapterId,
		behavior: ScrollBehavior = 'smooth'
	) => {
		const top = getChapterTop(id)
		if (top === null) return
		if (Math.abs(window.scrollY - top) < 2) return
		isProgrammaticSnapRef.current = true
		window.scrollTo({ top, behavior })
		window.setTimeout(() => {
			isProgrammaticSnapRef.current = false
		}, 260)
	}

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
			if (isProgrammaticSnapRef.current) return
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

	// Re-assert the camera when the section enters the viewport. This keeps the
	// embed and chapter state in sync without mutating global scroll-snap on the
	// root scroller, which can feel sticky on iOS Safari.
	useEffect(() => {
		const section = sectionRef.current
		if (!section) return
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					if (embedReady && !interactiveModeRef.current) {
						const id = chapterIdByPos(chapterPosNow())
						cameraChapterRef.current = id
						embedRef.current?.activateCamera(id)
					}
				}
			},
			{ threshold: 0 }
		)
		io.observe(section)
		return () => {
			io.disconnect()
		}
	}, [embedReady])

	// Lock body scroll on mobile when fullscreen interactive mode is active.
	// iOS Safari is more reliable with position locking than touch-action toggles.
	useEffect(() => {
		if (!isMobileViewport) return

		const body = document.body

		if (interactiveMode) {
			if (!bodyStyleSnapshotRef.current) {
				bodyStyleSnapshotRef.current = {
					position: body.style.position,
					top: body.style.top,
					left: body.style.left,
					right: body.style.right,
					width: body.style.width,
					overflow: body.style.overflow
				}
			}
			lockScrollYRef.current = window.scrollY
			body.style.position = 'fixed'
			body.style.top = `-${lockScrollYRef.current}px`
			body.style.left = '0'
			body.style.right = '0'
			body.style.width = '100%'
			body.style.overflow = 'hidden'
		} else {
			const snapshot = bodyStyleSnapshotRef.current
			if (snapshot) {
				body.style.position = snapshot.position
				body.style.top = snapshot.top
				body.style.left = snapshot.left
				body.style.right = snapshot.right
				body.style.width = snapshot.width
				body.style.overflow = snapshot.overflow
				window.scrollTo({ top: lockScrollYRef.current, behavior: 'auto' })
				bodyStyleSnapshotRef.current = null
			}
		}

		return () => {
			const snapshot = bodyStyleSnapshotRef.current
			if (snapshot) {
				body.style.position = snapshot.position
				body.style.top = snapshot.top
				body.style.left = snapshot.left
				body.style.right = snapshot.right
				body.style.width = snapshot.width
				body.style.overflow = snapshot.overflow
				bodyStyleSnapshotRef.current = null
			}
		}
	}, [interactiveMode, isMobileViewport])

	// Tab click: jump straight to the chapter (user-initiated, so switch immediately).
	const handleSelectChapter = (id: ChapterId) => {
		if (interactiveMode) return
		activeChapterRef.current = id
		setActiveChapter(id)
		activateCamera(id)
		snapToChapter(id, prefersReducedMotion ? 'auto' : 'smooth')
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

	const shouldUseMobileOverlay = interactiveMode && isMobileViewport

	const viewerFrame = (
		<>
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

			{!interactiveMode && (
				<div
					className="absolute inset-0 z-1"
					style={{ touchAction: 'pan-y' }}
				/>
			)}

			<div className="absolute top-3 left-3 z-10">
				<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 backdrop-blur-sm">
					<span className="bg-accent h-1.5 w-1.5 rounded-full" />
					<span className="text-xs font-medium tracking-wide text-white/55">
						Powered by Vectreal
					</span>
				</div>
			</div>

			<button
				onClick={
					interactiveMode ? handleExitInteractive : handleEnterInteractive
				}
				disabled={!embedReady}
				className={cn(
					'border-primary/10 bg-background/30 absolute right-3 bottom-3 z-10 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-medium tracking-[0.08em] uppercase backdrop-blur-sm transition-all duration-200',
					interactiveMode
						? 'border-primary/20 text-primary/80 hover:text-primary'
						: 'text-primary/50 hover:border-primary/20 hover:text-primary/90',
					!embedReady && 'pointer-events-none opacity-0',
					shouldUseMobileOverlay && 'hidden md:flex'
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
		</>
	)

	return (
		<div ref={sectionRef} className="relative h-[300vh] md:h-[300dvh]">
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
			<div className="bg-background sticky top-0 h-[100dvh] overflow-hidden">
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
										!isMobileViewport &&
										'fixed inset-0 z-50 aspect-auto rounded-none md:relative md:inset-auto md:z-auto md:aspect-4/3 md:rounded-2xl',
									shouldUseMobileOverlay && 'pointer-events-none opacity-0'
								)}
							>
								{!shouldUseMobileOverlay && viewerFrame}
							</div>

							{/* Caption — sits directly below the viewer */}
							<p className="text-foreground/20 px-0.5 text-[10px] leading-relaxed">
								3D visualization powered by Vectreal · Concept demo, not for
								sale
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

			{shouldUseMobileOverlay &&
				typeof document !== 'undefined' &&
				createPortal(
					<div className="fixed inset-0 z-60 bg-black/95">
						<div className="relative h-[100dvh] w-screen overflow-hidden">
							{viewerFrame}
							<div
								className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
								style={{
									background:
										'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))'
								}}
							/>
							<div
								className="absolute inset-x-0 z-20 flex justify-center"
								style={{
									bottom: 'max(1.25rem, env(safe-area-inset-bottom))'
								}}
							>
								<button
									onClick={handleExitInteractive}
									className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-medium tracking-[0.08em] text-white/90 uppercase backdrop-blur-md"
								>
									<X size={14} />
									<span>Exit</span>
								</button>
							</div>
						</div>
					</div>,
					document.body
				)}
		</div>
	)
}
