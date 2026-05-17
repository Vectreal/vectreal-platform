import { Bounds } from '@react-three/drei'
import { BoundsProps } from '@vctrl/core'
import { memo } from 'react'

export const defaultBoundsOptions = {
	enable: true,
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
	// When disabled, suppress auto-framing by overriding fit and clip.
	return (
		<Bounds {...rest} fit={enable && rest.fit} clip={enable && rest.clip}>
			{children}
		</Bounds>
	)
})
export default SceneBounds
