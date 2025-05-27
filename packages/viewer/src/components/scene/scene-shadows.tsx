import {
	AccumulativeShadows,
	ContactShadows,
	RandomizedLight,
	RandomizedLightProps,
	AccumulativeShadowsProps as ThreeAccumulativeShadowsProps,
	ContactShadowsProps as ThreeContactShadowsProps
} from '@react-three/drei'

export interface AccumulativeShadowsProps
	extends ThreeAccumulativeShadowsProps {
	type: 'accumulative'
	light?: RandomizedLightProps
}

export interface SoftShadowsProps extends ThreeContactShadowsProps {
	type: 'soft'
}

export type ShadowsProps = AccumulativeShadowsProps | SoftShadowsProps

export const defaultShadowsOptions: ShadowsProps = {
	type: 'accumulative',
	temporal: true,
	frames: 100,
	alphaTest: 0.8,
	scale: 10,
	colorBlend: 2,
	color: 'black',
	toneMapped: true,
	opacity: 1,
	light: {
		intensity: Math.PI,
		amount: 10,
		radius: 25,
		ambient: 0.75,
		position: [5, 5, 2.5],
		bias: 0.001
	}
}

/**
 * Configures shadows for the Three.js scene.
 *
 * @param {ShadowsProps} props - Shadow configuration options.
 */
const SceneShadows = (props: ShadowsProps) => {
	const { ...shadowOptions } = { ...defaultShadowsOptions, ...props }
	console.debug('SceneShadows', shadowOptions)

	return shadowOptions.type === 'accumulative' ? (
		<AccumulativeShadows {...shadowOptions}>
			<RandomizedLight {...shadowOptions.light} />
		</AccumulativeShadows>
	) : shadowOptions.type === 'soft' ? (
		<ContactShadows {...shadowOptions} />
	) : null
}

export default SceneShadows
