import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { lazy, Suspense } from 'react'

const ProductSceneClient = lazy(() => import('./product-scene-client'))

const ProductScene = () => {
	if (import.meta.env.SSR) {
		return <div className="h-96 w-full" />
	}

	return (
		<Suspense
			fallback={
				<div className="flex h-96 w-full items-center justify-center">
					<LoadingSpinner />
				</div>
			}
		>
			<ProductSceneClient />
		</Suspense>
	)
}

export default ProductScene
