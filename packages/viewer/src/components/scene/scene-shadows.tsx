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
	opacity: 0.4,
	blur: 0.1,
	scale: 5,
	color: '#000000',
	smooth: true
}

export const defaultAccumulativeShadowsOptions: AccumulativeShadowsProps = {
	type: 'accumulative',
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

	// Generate key from critical props to force remount when they change
	// This prevents shadow layering/accumulation issues

	return shadowOptions.type === 'contact' ? (
		<ContactShadows {...(shadowOptions as ContactShadowProps)} />
	) : shadowOptions.type === 'accumulative' ? (
		<AccumulativeShadows
			temporal={(shadowOptions as AccumulativeShadowsProps).temporal ?? false}
			frames={(shadowOptions as AccumulativeShadowsProps).frames}
			alphaTest={(shadowOptions as AccumulativeShadowsProps).alphaTest}
			opacity={(shadowOptions as AccumulativeShadowsProps).opacity}
			scale={(shadowOptions as AccumulativeShadowsProps).scale}
			resolution={(shadowOptions as AccumulativeShadowsProps).resolution}
			colorBlend={(shadowOptions as AccumulativeShadowsProps).colorBlend}
			color={(shadowOptions as AccumulativeShadowsProps).color}
		>
			<RandomizedLight
				castShadow
				amount={(shadowOptions as AccumulativeShadowsProps).light?.amount}
				radius={(shadowOptions as AccumulativeShadowsProps).light?.radius}
				ambient={(shadowOptions as AccumulativeShadowsProps).light?.ambient}
				intensity={(shadowOptions as AccumulativeShadowsProps).light?.intensity}
				position={(shadowOptions as AccumulativeShadowsProps).light?.position}
				bias={(shadowOptions as AccumulativeShadowsProps).light?.bias}
			/>
		</AccumulativeShadows>
	) : null
})

export default SceneShadows
