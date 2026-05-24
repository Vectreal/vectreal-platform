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
						Interactive Demo
					</div>
					<h2>Real Store, Real Product, Real Impact</h2>
					<p className="text-foreground/90 mt-4 max-w-xl text-lg md:text-xl">
						See how Vectreal powers interactive 3D e-commerce - scroll to
						explore the model
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

			<div className="from-background/0 to-background bg-gradient-to-b px-4 py-8 text-center">
				<p className="text-muted-foreground/60 text-sm">
					Interactive 3D product visualization powered by Vectreal
				</p>
				<p className="text-muted-foreground/35 mt-1 text-xs">
					Demo product - not available for purchase
				</p>
			</div>
		</section>
	)
}

export default MockShopSection
