import { useEnvironment } from '@react-three/drei'
import { memo, Suspense, useMemo, useState } from 'react'
import { Object3D } from 'three'

import LoadFailureBoundary from '../load-failure-boundary'
import {
	environmentIrradiance,
	LIGHT_DISTANCE_FACTOR,
	lightDirection,
	litLights,
	shadowFilterRadius
} from './scene-lighting'
import { useModelMetrics } from './scene-shadows'

import type {
	NormalizationOptions,
	ResolvedLighting,
	ResolvedSceneLight
} from '@vctrl/core'

/** Shadow-map resolution for a light that shadows the model. */
const SHADOW_MAP_SIZE = 2048

/** Half-extent of each light's shadow camera, in model radii. */
const SHADOW_CAMERA_FACTOR = 1.2

/**
 * The irradiance the lights are measured against while the environment's own
 * map is unavailable and a local room lights the scene instead: a uniform sky
 * of radiance 1.
 */
const FALLBACK_IRRADIANCE = Math.PI

interface SceneLightsProps {
	lighting: ResolvedLighting
	/** The environment map the lights' strength is relative to. */
	environmentFiles: string | string[]
	/** The model the lights aim at and shadow; sizes their shadow cameras. */
	model?: Object3D
	/** Re-measures the model when normalization rescales it. */
	normalizationOptions?: NormalizationOptions
}

interface LightRigProps extends Omit<SceneLightsProps, 'environmentFiles'> {
	/** The environment's light on an up-facing surface, before its intensity. */
	irradiance: number
}

/**
 * The scene's studio lights: one directional light per light that is on,
 * lighting the model, giving it highlights and shadowing it. The ground's
 * shadow is baked from the same lights by `SceneShadows`.
 *
 * A light's strength is relative to the environment, so it is measured
 * against the environment map's own light. The measurement waits for the map,
 * which the scene waits for anyway, and falls back to a uniform sky when the
 * map cannot load.
 */
const SceneLights = memo(({ environmentFiles, ...props }: SceneLightsProps) => {
	if (litLights(props.lighting).length === 0) return null
	return (
		<LoadFailureBoundary
			key={String(environmentFiles)}
			onError={() => undefined}
			fallback={<LightRig {...props} irradiance={FALLBACK_IRRADIANCE} />}
		>
			<Suspense fallback={null}>
				<MeasuredLightRig {...props} environmentFiles={environmentFiles} />
			</Suspense>
		</LoadFailureBoundary>
	)
})

SceneLights.displayName = 'SceneLights'

/**
 * Reads the environment map from the loader cache `SceneEnvironment` fills, so
 * measuring it downloads nothing twice.
 */
const MeasuredLightRig = ({ environmentFiles, ...props }: SceneLightsProps) => {
	const texture = useEnvironment({ files: environmentFiles })
	const irradiance = useMemo(
		() => environmentIrradiance(texture) ?? FALLBACK_IRRADIANCE,
		[texture]
	)
	return <LightRig {...props} irradiance={irradiance} />
}

const LightRig = ({
	lighting,
	model,
	normalizationOptions,
	irradiance
}: LightRigProps) => {
	const { radius, height } = useModelMetrics(model, normalizationOptions)
	// The model sits on the ground, centered under the origin, so its center
	// is half its height up.
	const center = useMemo<[number, number, number]>(
		() => [0, height / 2, 0],
		[height]
	)
	const [target] = useState(() => new Object3D())

	return (
		<>
			<primitive object={target} position={center} />
			{litLights(lighting).map((light) => (
				<SceneLight
					key={light.role}
					light={light}
					rotation={lighting.environment.rotation}
					intensity={
						light.intensity * irradiance * lighting.environment.intensity
					}
					center={center}
					radius={radius}
					target={target}
				/>
			))}
		</>
	)
}

interface SceneLightProps {
	light: ResolvedSceneLight
	rotation: number
	/** In three's units: what the light delivers to a surface facing it. */
	intensity: number
	center: [number, number, number]
	radius: number
	target: Object3D
}

const SceneLight = ({
	light,
	rotation,
	intensity,
	center,
	radius,
	target
}: SceneLightProps) => {
	const [x, y, z] = lightDirection(light, rotation)
	const distance = LIGHT_DISTANCE_FACTOR * radius
	const extent = SHADOW_CAMERA_FACTOR * radius

	return (
		<directionalLight
			position={[
				center[0] + x * distance,
				center[1] + y * distance,
				center[2] + z * distance
			]}
			target={target}
			color={light.color}
			intensity={intensity}
			castShadow
			shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
			shadow-radius={shadowFilterRadius(light.size)}
			// In world units, so it scales with the model: enough to keep curved
			// surfaces from shadowing themselves in stripes.
			shadow-normalBias={radius * 0.004}
			shadow-bias={-0.0002}
		>
			<orthographicCamera
				attach="shadow-camera"
				args={[
					-extent,
					extent,
					extent,
					-extent,
					distance - extent * 1.5,
					distance + extent * 1.5
				]}
			/>
		</directionalLight>
	)
}

export default SceneLights
