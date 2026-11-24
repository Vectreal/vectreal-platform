import { cn } from '@shared/utils'
import { type ComponentType, useEffect, useState } from 'react'

import { useAppColorScheme } from '../../hooks/use-app-color-scheme'

import type { VectrealViewerProps } from '@vctrl/viewer'

interface ClientVectrealViewerProps extends VectrealViewerProps {
	fallback?: React.ReactNode
}

export const ClientVectrealViewer = ({
	fallback = null,
	theme,
	...props
}: ClientVectrealViewerProps) => {
	// Inside our own chrome the viewer wears the page's scheme, so its controls
	// match the Publisher's around it. A caller that means otherwise says so.
	const appColorScheme = useAppColorScheme()
	const [ViewerComponent, setViewerComponent] =
		useState<ComponentType<VectrealViewerProps> | null>(null)

	useEffect(() => {
		let active = true

		import('@vctrl/viewer').then((module) => {
			if (active) {
				setViewerComponent(() => module.VectrealViewer)
			}
		})

		return () => {
			active = false
		}
	}, [])

	if (import.meta.env.SSR || !ViewerComponent) {
		// The viewer's box, with its fallback in the middle, as the viewer
		// draws its own loader: placed by its parent instead, a flex row put
		// the fallback against the left edge until the viewer arrived.
		return fallback === null ? null : (
			<div
				className={cn(
					'flex h-full w-full flex-col items-center justify-center',
					props.className
				)}
			>
				{fallback}
			</div>
		)
	}

	return <ViewerComponent {...props} theme={theme ?? appColorScheme} />
}
