import { lazy, Suspense } from 'react'

import { useIsClientMounted } from '../../hooks/use-is-client-mounted'
import CenteredSpinner from '../centered-spinner'

const HeroSceneClient = lazy(() => import('./hero-scene-client'))

interface HeroSceneProps {
	vertical?: boolean
}

/*
  The frame is owned here, once, for all three states. The server render, the
  loading fallback and the loaded scene each drew their own, and on a phone the
  first two were 25rem while the scene was half the viewport, so the page jumped
  when the model arrived. `svh` rather than `vh`, so the frame is measured
  against the viewport with the browser's toolbars shown, the one that is
  actually on screen when the page opens.
*/
const HeroScene = ({ vertical }: HeroSceneProps) => {
	const isMounted = useIsClientMounted()

	return (
		<div className="relative h-full w-full overflow-hidden max-md:h-[50svh] max-md:min-h-[300px]">
			{isMounted ? (
				<Suspense fallback={<CenteredSpinner />}>
					<HeroSceneClient vertical={vertical} />
				</Suspense>
			) : null}
		</div>
	)
}

export default HeroScene
