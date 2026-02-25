import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { lazy, Suspense, useEffect, useState } from 'react'

const ProductSceneClient = lazy(() => import('./product-scene-client'))

const ProductScene = () => {
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	if (!isMounted) {
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
