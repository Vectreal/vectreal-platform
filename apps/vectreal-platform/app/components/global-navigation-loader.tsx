import { cn } from '@shared/utils'
import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router'

export function GlobalNavigationLoader() {
	const navigation = useNavigation()
	const [isVisible, setIsVisible] = useState(false)

	const isNavigating = navigation.state !== 'idle'

	useEffect(() => {
		if (isNavigating) {
			setIsVisible(true)
		} else {
			// Delay hiding to allow the animation to complete
			const timer = setTimeout(() => setIsVisible(false), 300)
			return () => clearTimeout(timer)
		}
	}, [isNavigating])

	if (!isVisible) return null

	return (
		/*
		  Above the nav, which is also fixed at top-0 and also z-50 (see
		  `desktop-nav.tsx` and `mobile-nav.tsx`). Equal z-index is resolved by DOM
		  order, and the nav renders later, so the bar was painted underneath it: the
		  1px strip sat behind a 52px header and showed only as a smear through the
		  header's own backdrop.

		  z-60 is the tier this repo already uses for "above the nav". Transient
		  surfaces stay higher on purpose - tooltips at 80, dropdowns and popovers at
		  100 - because a progress strip behind an open menu is correct.
		*/
		<div className="pointer-events-none fixed top-0 left-0 z-60 w-full">
			<div
				className={cn(
					/*
					  Only the fade is transitioned. `transition-all` also animated the
					  transform, and the exit sets `scale-x-100`, so the bar spent 300ms
					  growing from wherever the 2s `loading-bar` animation had reached.
					  Most navigations finish in well under 300ms, at which point that
					  animation is a few percent in, so the exit began at roughly
					  scaleX(0.02) and read as an orange dot sitting at the left edge,
					  fading as it stretched.

					  Snapping to full width and fading is also what a progress indicator
					  should do: reach 100%, then leave. The scale is driven by a fixed
					  2s animation with no relationship to how long the navigation
					  actually takes, so its mid-flight value is not worth preserving.
					*/
					'bg-orange h-1 w-full origin-left transition-opacity duration-300',
					isNavigating
						? 'animate-loading-bar opacity-100'
						: 'scale-x-100 opacity-0'
				)}
			>
				<div className="bg-orange/50 animate-loading-shimmer h-full w-full" />
			</div>
		</div>
	)
}
