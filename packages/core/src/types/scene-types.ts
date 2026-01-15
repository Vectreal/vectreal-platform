/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */
import {
	OrbitControlsProps,
	RandomizedLightProps,
	AccumulativeShadowsProps as ThreeAccumulativeShadowsProps,
	BoundsProps as ThreeBoundsProps,
	ContactShadowsProps as ThreeContactShadowsProps,
	EnvironmentProps as ThreeEnvironmentProps,
	GridProps as ThreeGridProps
} from '@react-three/drei'
import { CameraProps as ThreeCameraProps } from '@react-three/fiber'

import type {
	DedupOptions,
	NormalsOptions,
	QuantizeOptions,
	SimplifyOptions,
	TextureCompressOptions
} from '../model-optimizer'

/**
 * Metadata for a 3D scene.
 * Contains scene name, thumbnail, and extensible custom properties.
 */
export interface SceneMeta {
	/** Name of the scene */
	sceneName?: string
	/** URL to the scene thumbnail image */
	thumbnailUrl?: string | null
	/** Additional custom metadata properties */
	[key: string]: string | null | undefined
}

/**
 * Props for configuring the camera in a 3D scene.
 */
export type CameraProps = ThreeCameraProps

/**
 * Props for the SceneBounds component, extending ThreeBoundsProps from '@react-three/drei'.
 */
export type BoundsProps = ThreeBoundsProps

/**
 * Props for the SceneControls component, extending OrbitControlsProps from '@react-three/drei'.
 */
export interface ControlsProps extends OrbitControlsProps {
	/**
	 * The timeout duration in milliseconds before enabling the controls.
	 */
	controlsTimeout?: number
}

/**
 * Props for the SceneGrid component, extending ThreeGridProps from '@react-three/drei'.
 */
export interface GridProps extends ThreeGridProps {
	/**
	 * Whether to show the grid.
	 */
	showGrid?: boolean

	/**
	 * Snap grid position to bottom of scene bounding box (y axis).
	 */
	snapToBottom?: boolean
}

/**
 * The environment key is mapped to the categories and label used as naming
 * for environment files in the resource bucket.
 */
export type EnvironmentKey =
	| 'nature-moonlit'
	| 'nature-park'
	| 'nature-park-overcast'
	| 'nature-snow'
	| 'night-building'
	| 'night-city'
	| 'night-pure-sky'
	| 'night-stars'
	| 'outdoor-golden-hour'
	| 'outdoor-noon'
	| 'outdoor-overcast'
	| 'outdoor-sky'
	| 'studio-key'
	| 'studio-natural'
	| 'studio-soft'

/**
 * Types/Categories of environment maps available.
 */
export type EnvironmentType = 'nature' | 'night' | 'outdoor' | 'studio'

/**
 * Resolutions available for environment maps.
 */
export type EnvironmentResolution = '1k' | '4k'

/**
 * Definition of an environment map with its properties.
 */
export interface EnvironmentMap {
	id: EnvironmentKey
	type: EnvironmentType
	resolution: EnvironmentResolution
}

/**
 * Mapping of environment keys to their corresponding environment map definitions.
 * Used for easy lookup and retrieval of environment map details.
 */
export type EnvironmentMaps = Record<EnvironmentKey, EnvironmentMap>

/**
 * Props inherited from Three.js Environment component.
 */
type InheritedEnvProps = Pick<
	ThreeEnvironmentProps,
	| 'background'
	| 'backgroundBlurriness'
	| 'environmentIntensity'
	| 'ground'
	| 'scene'
	| 'files'
	| 'backgroundIntensity'
>

/**
 * Props for the SceneEnvironment component, extending inherited Three.js Environment props.
 */
export interface EnvironmentProps extends InheritedEnvProps {
	preset?: EnvironmentKey
	environmentResolution?: EnvironmentResolution
}

/**
 * Base interface for shadow properties.
 */
export interface ShadowTypePropBase {
	type: 'accumulative' | 'contact'
}

/**
 * Props for Accumulative Shadows.
 */
export interface AccumulativeShadowsProps
	extends ShadowTypePropBase,
		ThreeAccumulativeShadowsProps {
	type: 'accumulative'
	light?: RandomizedLightProps
}

/**
 * Props for Contact Shadows.
 */
export interface ContactShadowProps
	extends ShadowTypePropBase,
		ThreeContactShadowsProps {
	type: 'contact'
}

/**
 * Union type for shadow properties.
 */
export type ShadowsProps = AccumulativeShadowsProps | ContactShadowProps

/**
 * Scene settings containing viewer configuration.
 * Used for persisting and restoring scene appearance and behavior.
 */
export interface SceneSettings {
	/** Bounds settings */
	bounds?: BoundsProps
	/** Camera settings */
	camera?: CameraProps
	/** Camera controls configuration */
	controls?: ControlsProps
	/** Environment/lighting configuration */
	environment?: EnvironmentProps
	/** Shadow rendering settings */
	shadows?: ShadowsProps
	/** Scene metadata */
	meta?: SceneMeta
}
export interface TextureOptimization
	extends BaseOptimization<'texture'>,
		TextureCompressOptions {}

export type OptimizationNames =
	| 'simplification'
	| 'texture'
	| 'quantize'
	| 'dedup'
	| 'normals'

export interface BaseOptimization<Name = OptimizationNames> {
	name: Name
	enabled: boolean
}

export interface SimplificationOptimization
	extends BaseOptimization<'simplification'>,
		SimplifyOptions {}

export interface QuantizeOptimization
	extends BaseOptimization<'quantize'>,
		QuantizeOptions {}

export interface DedupOptimization
	extends BaseOptimization<'dedup'>,
		DedupOptions {}

export interface NormalsOptimization
	extends BaseOptimization<'normals'>,
		NormalsOptions {}

export type Optimizations = {
	simplification: SimplificationOptimization
	texture: TextureOptimization
	quantize: QuantizeOptimization
	dedup: DedupOptimization
	normals: NormalsOptimization
}
