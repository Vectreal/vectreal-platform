/**
 * The onboarding visual: the rocket turning over the drafting floor.
 *
 * Lazy-loads the R3F scene so no Three.js code is imported server-side. The
 * floor is the site's, calmed for a product surface, so onboarding is made of
 * the same material as the pages that led to it.
 */
import { lazy, Suspense } from 'react'

import { DraftingBackdrop } from '../../components/layout-components/drafting-backdrop'
import { useIsClientMounted } from '../../hooks/use-is-client-mounted'

const OnboardingWelcomeScene = lazy(() => import('./onboarding-welcome-client'))

export function WelcomeVisual() {
	const mounted = useIsClientMounted()

	return (
		<div className="relative isolate h-full w-full overflow-hidden">
			<DraftingBackdrop calm focusX={0.5} horizon={0.55} phoneHorizon={0.55} />

			{mounted && (
				<Suspense fallback={null}>
					<OnboardingWelcomeScene />
				</Suspense>
			)}
		</div>
	)
}
