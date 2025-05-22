import {
	AccumulativeShadows,
	PerspectiveCameraProps,
	RandomizedLight,
	SoftShadows
} from '@react-three/drei'

export interface ShadowProps {
	type: 'accumulative' | 'soft'
}

export const defaultShadowOptions: ShadowProps = {
	type: 'accumulative'
}

/**
 * Configures shadows for the Three.js scene.
 *
 * @param {ShadowProps & PerspectiveCameraProps} props - Shadow configuration options.
 */
const SceneShadows = (props: PerspectiveCameraProps) => {
	const { ...shadowOptions } = { ...defaultShadowOptions, ...props }

	return shadowOptions.type === 'accumulative' ? (
		<AccumulativeShadows
			temporal
			frames={100}
			alphaTest={0.8}
			scale={10}
			colorBlend={2}
			color="black"
			toneMapped={true}
			opacity={1}
		>
			<RandomizedLight
				intensity={Math.PI}
				amount={10}
				radius={25}
				ambient={0.75}
				position={[5, 5, 2.5]}
				bias={0.001}
			/>
		</AccumulativeShadows>
	) : shadowOptions.type === 'soft' ? (
		<SoftShadows size={10} focus={0.5} samples={8} />
	) : null
}

export default SceneShadows
