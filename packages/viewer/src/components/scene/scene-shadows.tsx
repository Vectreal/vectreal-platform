import {
	AccumulativeShadows,
	ContactShadows,
	RandomizedLight
} from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import {
	AccumulativeShadowsProps,
	ContactShadowProps,
	ShadowsProps
} from '@vctrl/core'
import { memo, useMemo } from 'react'
import { Box3, Mesh, Vector3, Vector3Tuple } from 'three'

export const defaultShadowsOptions: ShadowsProps = {
	type: 'contact',
	enabled: false,
	opacity: 0.4,
	blur: 0.1,
	scale: 5,
	color: '#000000',
	smooth: true
}

export const defaultAccumulativeShadowsOptions: AccumulativeShadowsProps = {
	type: 'accumulative',
	enabled: false,
	temporal: false,
	frames: 30,
	alphaTest: 0.35,
	opacity: 1,
	scale: 10,
	resolution: 1024,
	colorBlend: 2,
	color: '#000000',
	light: {
		intensity: 1,
		amount: 5,
		radius: 7.5,
		ambient: 0.5,
		position: [5, 10, 5] as Vector3Tuple
	}
}

/**
 * Configures shadows for the Three.js scene.
 *
 * Accepts partial shadow configuration options and merges them with defaults.
 * Uses `Partial<ShadowsProps>` to allow optional properties, as defaults are
 * applied internally for any missing fields including the shadow type.
 *
 * @param {Partial<ShadowsProps>} props - Shadow configuration options (all fields optional).
 */
const SceneShadows = memo((props?: Partial<ShadowsProps>) => {
	const { scene } = useThree()

	// Calculate dynamic light position based on scene bounds
	const lightPosition = useMemo((): Vector3Tuple => {
		if (!props?.type || props.type !== 'accumulative') {
			return Array.from(
				defaultAccumulativeShadowsOptions.light?.position || [5, 10, 5]
			) as Vector3Tuple
		}
		const bbox = new Box3()
		const size = new Vector3()
		const center = new Vector3()

		// Compute bounding box from scene
		scene.traverse((child) => {
			if (child instanceof Mesh && child.name !== 'Grid') {
				try {
					bbox.expandByObject(child)
				} catch (error) {
					console.warn('Could not compute bounding box for mesh:', error)
				}
			}
		})

		bbox.getSize(size)
		bbox.getCenter(center)

		// Position light at upper corner (front-right-top) relative to bounding box
		// This creates natural shadows without extreme skewing
		const diagonal = Math.max(size.x, size.y, size.z)
		const offset = diagonal * 4

		return [
			center.x + offset, // Right
			center.y + offset * 2, // Top
			center.z + offset // Front
		]
	}, [scene, props?.type])
	// Merge defaults based on shadow type
	const baseDefaults =
		props && 'type' in props && props.type === 'accumulative'
			? defaultAccumulativeShadowsOptions
			: defaultShadowsOptions

	const shadowOptions = {
		...baseDefaults,
		...props,
		// Deep merge light properties for accumulative shadows
		...(props &&
			'type' in props &&
			props.type === 'accumulative' && {
				light: {
					...(baseDefaults.type === 'accumulative'
						? baseDefaults.light
						: undefined),
					...((props as AccumulativeShadowsProps).light || {}),
					// Use calculated position if not explicitly provided
					position:
						((props as AccumulativeShadowsProps).light
							?.position as Vector3Tuple) || lightPosition
				}
			})
	} as ShadowsProps

	if (!shadowOptions.enabled) {
		return null
	}

	if (shadowOptions.type === 'contact') {
		const {
			type: _contactType,
			enabled: _contactEnabled,
			...contactProps
		} = shadowOptions as ContactShadowProps

		return <ContactShadows {...contactProps} />
	}

	const accumulativeOptions = shadowOptions as AccumulativeShadowsProps

	return (
		<AccumulativeShadows
			temporal={accumulativeOptions.temporal ?? false}
			frames={accumulativeOptions.frames}
			alphaTest={accumulativeOptions.alphaTest}
			opacity={accumulativeOptions.opacity}
			scale={accumulativeOptions.scale}
			resolution={accumulativeOptions.resolution}
			colorBlend={accumulativeOptions.colorBlend}
			color={accumulativeOptions.color}
		>
			<RandomizedLight
				castShadow
				amount={accumulativeOptions.light?.amount}
				radius={accumulativeOptions.light?.radius}
				ambient={accumulativeOptions.light?.ambient}
				intensity={accumulativeOptions.light?.intensity}
				position={accumulativeOptions.light?.position}
				bias={accumulativeOptions.light?.bias}
			/>
		</AccumulativeShadows>
	)
})

SceneShadows.displayName = 'SceneShadows'

export default SceneShadows
