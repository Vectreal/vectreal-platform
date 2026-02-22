import { type ComponentType, useEffect, useState } from 'react'

import type { VectrealViewerProps } from '@vctrl/viewer'

interface ClientVectrealViewerProps extends VectrealViewerProps {
	fallback?: React.ReactNode
}

export const ClientVectrealViewer = ({
	fallback = null,
	...props
}: ClientVectrealViewerProps) => {
	const [ViewerComponent, setViewerComponent] = useState<
		ComponentType<VectrealViewerProps> | null
	>(null)

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

	return <ViewerComponent {...props} />
}
