import {
	AccumulativeShadows,
	ContactShadows,
	RandomizedLight,
	RandomizedLightProps,
	AccumulativeShadowsProps as ThreeAccumulativeShadowsProps,
	ContactShadowsProps as ThreeContactShadowsProps
} from '@react-three/drei'

export interface BaseShadowsProps {
	type: 'accumulative' | 'contact'
}

export interface AccumulativeShadowsProps
	extends BaseShadowsProps,
		ThreeAccumulativeShadowsProps {
	type: 'accumulative'
	light?: RandomizedLightProps
}

export interface ContactShadowProps
	extends BaseShadowsProps,
		ThreeContactShadowsProps {
	type: 'contact'
}

export type ShadowsProps = AccumulativeShadowsProps | ContactShadowProps

export const defaultShadowsOptions: ShadowsProps | BaseShadowsProps = {
	type: 'accumulative',
	temporal: true,
	frames: 100,
	alphaTest: 0.8,
	scale: 5,
	colorBlend: 2,
	color: 'black',
	toneMapped: true,
	opacity: 1,
	light: {
		intensity: Number(Math.PI.toFixed(2)),
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
const SceneShadows = (props?: ShadowsProps | object) => {
	const { ...shadowOptions } = { ...defaultShadowsOptions, ...props }

	return shadowOptions.type === 'accumulative' ? (
		<AccumulativeShadows {...shadowOptions}>
			<RandomizedLight {...shadowOptions.light} />
		</AccumulativeShadows>
	) : shadowOptions.type === 'contact' ? (
		<ContactShadows {...shadowOptions} />
	) : null
}

export default SceneShadows
