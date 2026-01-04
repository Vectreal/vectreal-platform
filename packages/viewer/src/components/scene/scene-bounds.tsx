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
	const { ...rest } = {
		...defaultBoundsOptions,
		...props
	}

	return <Bounds {...rest} />
})
export default SceneBounds
