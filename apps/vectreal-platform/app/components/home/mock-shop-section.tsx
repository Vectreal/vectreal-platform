import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { lazy, Suspense, useEffect, useState } from 'react'

const MockShopEmbedClient = lazy(() => import('./mock-shop-embed-client'))

const MockShopSection = () => {
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	return (
		<section aria-label="Interactive 3D product demo">
			{/* Section heading - sits above the sticky scroll area */}
			<div className="from-background to-background/0 relative z-10 bg-linear-to-b px-4 py-16">
				<div className="mx-auto max-w-7xl">
					<div className="border-accent/20 bg-accent/5 text-accent/70 mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
						<span className="bg-accent/60 h-1.5 w-1.5 rounded-full" />
						Live Embed
					</div>
					<h2>
						Explore the product,
						<br className="hidden sm:block" /> not a photo of it.
					</h2>
					<p className="text-foreground/60 mt-4 max-w-xl text-lg md:text-xl">
						Scroll through a live Vectreal embed. Each chapter reveals a
						different camera angle — triggered by a single SDK call.
					</p>
				</div>
			</div>

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
				// SSR placeholder - prevents layout shift
				<div className="h-screen w-full bg-black" />
			)}

			<div className="from-background/0 to-background h-16 bg-linear-to-b" />
		</section>
	)
}

export default MockShopSection
