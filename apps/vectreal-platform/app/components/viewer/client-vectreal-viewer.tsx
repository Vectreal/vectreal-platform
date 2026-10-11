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
		return <>{fallback}</>
	}

	return <ViewerComponent {...props} theme={theme ?? appColorScheme} />
}
