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
		<div className="pointer-events-none fixed top-0 left-0 z-50 w-full">
			<div
				className={cn(
					'bg-accent h-1 w-full origin-left transition-all duration-300',
					isNavigating
						? 'animate-loading-bar opacity-100'
						: 'scale-x-100 opacity-0'
				)}
			>
				<div className="bg-accent/50 animate-loading-shimmer h-full w-full" />
			</div>
		</div>
	)
}
