import { Bounds } from '@react-three/drei'
import { BoundsProps } from '@vctrl/core'
import { memo } from 'react'

export const defaultBoundsOptions = {
	fit: true,
	clip: true,
	margin: 1.5,
	maxDuration: 0
} satisfies BoundsProps

const SceneBounds = memo((props: BoundsProps) => {
	const { enable, children, ...rest } = {
		...defaultBoundsOptions,
		...props
	}

	// Always render <Bounds> to keep the useBounds() context alive for SceneCamera.
	// Disable declarative fit entirely — SceneCamera drives all fitting imperatively
	// via bounds.reset().fit() so timing is fully controlled.
	return (
		<Bounds {...rest} fit={false}>
			{children}
		</Bounds>
	)
})
export default SceneBounds
