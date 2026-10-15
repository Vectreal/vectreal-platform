/**
 * The onboarding visual: the site's grain rising from the left edge, and the
 * rocket turning in front of it.
 *
 * Lazy-loads the R3F scene so no Three.js code is imported server-side. The
 * grain is the page hero's, not a blurred glow, so onboarding is made of the
 * same material as the pages that led to it.
 */
import { lazy, Suspense } from 'react'

import { DitherGrain } from '../../components/layout-components/dither-grain'
import { useIsClientMounted } from '../../hooks/use-is-client-mounted'

const OnboardingWelcomeScene = lazy(() => import('./onboarding-welcome-client'))

export function WelcomeVisual() {
	const mounted = useIsClientMounted()

	return (
		<div className="relative isolate h-full w-full overflow-hidden">
			<DitherGrain origin="left" />

			{mounted && (
				<Suspense fallback={null}>
					<OnboardingWelcomeScene />
				</Suspense>
			)}
		</div>
	)
}
