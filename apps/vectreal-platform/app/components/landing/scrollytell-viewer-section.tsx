// app/components/landing/scrollytell-viewer-section.tsx
import { fadeUp, staggerContainer } from '@shared/components/motion'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { cn } from '@shared/utils'
import {
	motion,
	useInView,
	useReducedMotion,
	useScroll,
	useTransform
} from 'framer-motion'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const MockShopEmbedClient = lazy(
	() => import('../home/mock-shop-embed-client')
)

const ANNOTATION_CHIPS = [
	{ label: 'Drag & drop upload', position: 'top-[15%] left-[8%]' },
	{ label: 'Real-time optimization', position: 'top-[40%] right-[6%]' },
	{ label: 'One-click embed', position: 'bottom-[18%] left-[12%]' }
]

export function ScrollytellViewerSection() {
	const sectionRef = useRef<HTMLDivElement>(null)
	const viewerRef = useRef<HTMLDivElement>(null)
	const prefersReducedMotion = useReducedMotion()
	const [isMounted, setIsMounted] = useState(false)

	const isNearView = useInView(sectionRef, {
		once: true,
		margin: '200px 0px'
	})
	const isViewerVisible = useInView(viewerRef, {
		once: true,
		amount: 0.3
	})

	useEffect(() => {
		if (isNearView) setIsMounted(true)
	}, [isNearView])

	const { scrollYProgress } = useScroll({
		target: sectionRef,
		offset: ['start end', 'end start']
	})

	const scale = useTransform(
		scrollYProgress,
		[0, 0.3],
		prefersReducedMotion ? [1, 1] : [0.94, 1]
	)
	const opacity = useTransform(
		scrollYProgress,
		[0, 0.2],
		prefersReducedMotion ? [1, 1] : [0, 1]
	)

	return (
		<section ref={sectionRef} aria-label="Live 3D product demo">
			{/* Section heading */}
			<div className="from-background to-background/0 relative z-10 bg-linear-to-b px-4 py-20">
				<div className="mx-auto max-w-7xl">
					<div
						className={cn(
							'border-accent/20 bg-accent/5 text-accent/70 mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-widest uppercase'
						)}
					>
						<span className="bg-accent/60 h-1.5 w-1.5 rounded-full" />
						Live Embed
					</div>
					<h2
						className="text-foreground font-black leading-none"
						style={{
							fontSize: 'var(--text-headline)',
							letterSpacing: 'var(--tracking-headline)'
						}}
					>
						Explore the product,
						<br className="hidden sm:block" /> not a photo of it.
					</h2>
					<p className="text-muted-foreground mt-4 max-w-xl text-lg">
						Scroll through a live Vectreal embed. Each chapter reveals a
						different camera angle — triggered by a single SDK call.
					</p>
				</div>
			</div>

			{/* Scroll-animated viewer wrapper */}
			<motion.div
				ref={viewerRef}
				style={prefersReducedMotion ? undefined : { scale, opacity }}
				className="relative mx-auto"
			>
				{isMounted ? (
					<Suspense
						fallback={
							<div className="flex h-screen w-full items-center justify-center bg-black">
								<LoadingSpinner className="text-white" />
							</div>
						}
					>
						<MockShopEmbedClient />
					</Suspense>
				) : (
					<div className="h-screen w-full bg-black" />
				)}

				{/* Annotation chips — appear once viewer is visible */}
				{isViewerVisible && !prefersReducedMotion && (
					<motion.div
						variants={staggerContainer}
						initial="hidden"
						animate="visible"
						className="pointer-events-none absolute inset-0 hidden md:block"
						aria-hidden="true"
					>
						{ANNOTATION_CHIPS.map((chip) => (
							<motion.div
								key={chip.label}
								variants={fadeUp}
								className={cn(
									'bg-surface-2/90 border-surface-border absolute rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md',
									'text-foreground/80',
									chip.position
								)}
							>
								{chip.label}
							</motion.div>
						))}
					</motion.div>
				)}
			</motion.div>

			<div className="from-background/0 to-background h-16 bg-linear-to-b" />
		</section>
	)
}
