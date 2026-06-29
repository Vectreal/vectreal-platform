// app/components/landing/scrollytell-viewer-section.tsx
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const MockShopEmbedClient = lazy(() => import('../home/mock-shop-embed-client'))

export function ScrollytellViewerSection() {
	const sectionRef = useRef<HTMLDivElement>(null)
	const viewerRef = useRef<HTMLDivElement>(null)
	const prefersReducedMotion = useReducedMotion()
	const [isMounted, setIsMounted] = useState(false)

	const isNearView = useInView(sectionRef, {
		once: true,
		margin: '200px 0px'
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
		prefersReducedMotion ? [1, 1] : [0.96, 1]
	)
	const opacity = useTransform(
		scrollYProgress,
		[0, 0.2],
		prefersReducedMotion ? [1, 1] : [0, 1]
	)

	return (
		<section ref={sectionRef} aria-label="Live 3D product demo">
			{/* Section heading */}
			<div className="from-background to-background/0 relative z-10 bg-linear-to-b px-4 py-16">
				<div className="mx-auto max-w-7xl">
					<div className="border-accent/20 bg-accent/5 text-accent/70 mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-widest uppercase">
						<span className="bg-accent/60 h-1.5 w-1.5 rounded-full" />
						Live Embed
					</div>
					<h2
						className="text-foreground font-medium text-balance"
						style={{
							fontSize: 'var(--text-headline)',
							letterSpacing: 'var(--tracking-headline)',
							lineHeight: 1.1
						}}
					>
						Explore the product, not a photo of it.
					</h2>
					<p className="text-muted-foreground mt-4 max-w-xl text-lg text-pretty">
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
			</motion.div>

			<div className="from-background/0 to-background h-16 bg-linear-to-b" />
		</section>
	)
}
