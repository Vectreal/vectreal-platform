import { lazy, Suspense } from 'react'

import { useIsClientMounted } from '../../hooks/use-is-client-mounted'
import CenteredSpinner from '../centered-spinner'

const HeroSceneClient = lazy(() => import('./hero-scene-client'))

interface HeroSceneProps {
	vertical?: boolean
}

const HeroScene = ({ vertical }: HeroSceneProps) => {
	const isMounted = useIsClientMounted()

	if (!isMounted) {
		return (
			<div className="relative h-full w-full overflow-hidden max-md:h-[50vh] max-md:min-h-[300px] max-sm:h-100" />
		)
	}

	return (
		<Suspense
			fallback={
				<div className="relative h-full w-full overflow-hidden max-md:h-[50vh] max-md:min-h-[300px] max-sm:h-100">
					<CenteredSpinner />
				</div>
			}
		>
			<HeroSceneClient vertical={vertical} />
		</Suspense>
	)
}

export default HeroScene
