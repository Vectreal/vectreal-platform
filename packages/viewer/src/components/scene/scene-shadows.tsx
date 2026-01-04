import {
	AccumulativeShadows,
	ContactShadows,
	RandomizedLight
} from '@react-three/drei'
import {
	AccumulativeShadowsProps,
	ContactShadowProps,
	ShadowsProps
} from '@vctrl/core'
import { memo } from 'react'

export const defaultShadowsOptions: ShadowsProps = {
	type: 'contact'
}

/**
 * Configures shadows for the Three.js scene.
 *
 * @param {ShadowsProps} props - Shadow configuration options.
 */
const SceneShadows = memo((props?: ShadowsProps | object) => {
	const { ...shadowOptions } = { ...defaultShadowsOptions, ...props }

	return shadowOptions.type === 'contact' ? (
		<ContactShadows {...(shadowOptions as ContactShadowProps)} />
	) : shadowOptions.type === 'accumulative' ? (
		<AccumulativeShadows {...(shadowOptions as AccumulativeShadowsProps)}>
			<RandomizedLight {...shadowOptions.light} />
		</AccumulativeShadows>
	) : null
})

export default SceneShadows
