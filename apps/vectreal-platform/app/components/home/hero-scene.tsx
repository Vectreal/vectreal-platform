import { cn } from '@shared/utils'
import { lazy, Suspense, useEffect, useState } from 'react'

import CenteredSpinner from '../centered-spinner'

const HeroSceneClient = lazy(() => import('./hero-scene-client'))

interface HeroSceneProps {
	vertical?: boolean
}

const HeroScene = ({ vertical }: HeroSceneProps) => {
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	if (!isMounted) {
		return (
			<div
				className={cn(
					'relative w-full overflow-hidden',
					vertical && 'h-full max-md:h-[50vh] max-md:min-h-[300px]'
				)}
			/>
		)
	}

	return (
		<Suspense
			fallback={
				<div
					className={cn(
						'relative w-full overflow-hidden',
						vertical && 'h-full max-md:h-[50vh] max-md:min-h-[300px]'
					)}
				>
					<CenteredSpinner />
				</div>
			}
		>
			<HeroSceneClient vertical={vertical} />
		</Suspense>
	)
}

export default HeroScene
