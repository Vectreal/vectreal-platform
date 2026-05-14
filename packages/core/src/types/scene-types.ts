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
import { JSONDocument } from '@gltf-transform/core'
import {
	OrbitControlsProps,
	RandomizedLightProps,
	AccumulativeShadowsProps as ThreeAccumulativeShadowsProps,
	BoundsProps as ThreeBoundsProps,
	ContactShadowsProps as ThreeContactShadowsProps,
	EnvironmentProps as ThreeEnvironmentProps,
	GridProps as ThreeGridProps
} from '@react-three/drei'
import { PerspectiveCameraProps } from '@react-three/drei'

import type {
	DedupOptions,
	NormalsOptions,
	QuantizeOptions,
	SimplifyOptions,
	TextureCompressOptions
} from '../model-optimizer'
import type { SceneInteractionDefinition } from './interaction-types'

/**
 * Camera classification used for inspector grouping and publish filtering.
 * 'scene' cameras appear in the scene camera inspector list.
 * 'hotspot' cameras are linked to a hotspot and shown in a separate section.
 */
export type CameraKind = 'scene' | 'hotspot'

/**
 * Controls how the default (initial-load) camera is automatically resolved
 * when no explicit defaultCameraId is set.
 */
export type DefaultCameraStrategy = 'first' | 'last' | 'manual'

/**
 * Transition mode when switching between two camera states.
 */
export type CameraTransitionType = 'linear' | 'object_avoidance' | 'none'

/**
 * Optional easing presets for serializable transition definitions.
 */
export type CameraTransitionEasing =
	| 'linear'
	| 'ease_in'
	| 'ease_out'
	| 'ease_in_out'

/**
 * Object-avoidance transition parameters.
 */
export interface CameraObjectAvoidanceConfig {
	/**
	 * Adds additional radius around the avoidance sphere.
	 */
	clearance?: number
	/**
	 * Relative arc height used to build spline control points.
	 */
	arcHeight?: number
	/**
	 * Number of interpolation samples along the spline.
	 */
	samples?: number
	/**
	 * Catmull-Rom tension parameter.
	 */
	tension?: number
}

/**
 * Transition configuration for camera-state switches.
 */
export interface CameraTransitionConfig {
	type: CameraTransitionType
	duration?: number
	easing?: CameraTransitionEasing
	objectAvoidance?: CameraObjectAvoidanceConfig
}

/**
 * Configuration for a camera in the 3D scene.
 */
export type CameraConfig = PerspectiveCameraProps & {
	cameraId: string
	name: string
	/**
	 * Camera classification. 'scene' cameras appear in the scene camera list;
	 * 'hotspot' cameras are linked to a hotspot and shown in a separate section.
	 * Defaults to 'scene' when absent.
	 */
	kind?: CameraKind
	initial?: boolean // Indicates if this camera should be the default view when the scene loads
	target?: [number, number, number]
}

/**
 * Props for configuring the camera in a 3D scene.
 */
export interface CameraProps {
	/**
	 * Canonical active camera selection.
	 */
	activeCameraId?: string
	cameras?: CameraConfig[]
	/**
	 * Scene-global transition applied when switching cameras.
	 * Replaces per-camera CameraConfig.transition in new saves.
	 */
	sceneTransition?: CameraTransitionConfig
	/**
	 * Controls how the default camera is automatically resolved when defaultCameraId is absent.
	 * Defaults to 'first'.
	 */
	defaultCameraStrategy?: DefaultCameraStrategy
	/**
	 * Explicitly selected default camera ID. Takes precedence over defaultCameraStrategy.
	 */
	defaultCameraId?: string
}

/**
 * Props for the SceneBounds component, extending ThreeBoundsProps from '@react-three/drei'.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BoundsProps extends ThreeBoundsProps {}

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
	enabled?: boolean
}

/**
 * Props for Accumulative Shadows.
 */
export interface AccumulativeShadowsProps
	extends ShadowTypePropBase, ThreeAccumulativeShadowsProps {
	type: 'accumulative'
	light?: RandomizedLightProps
}

/**
 * Props for Contact Shadows.
 */
export interface ContactShadowProps
	extends ShadowTypePropBase, ThreeContactShadowsProps {
	type: 'contact'
}

/**
 * Union type for shadow properties.
 */
export type ShadowsProps = AccumulativeShadowsProps | ContactShadowProps

// ---------------------------------------------------------------------------
// Hotspot types
// ---------------------------------------------------------------------------

/** MVP hotspot style presets. Full arbitrary HTML/Lottie support is deferred. */
export type HotspotStylePreset = 'dot' | 'image' | 'svg'

/**
 * A single point-of-interest hotspot anchored to a world-space position.
 * Linked to a camera entity with kind='hotspot'.
 */
export interface HotspotDefinition {
	id: string
	name: string
	/** World-space 3D position [x, y, z]. */
	worldPosition: [number, number, number]
	/**
	 * ID of the camera with kind='hotspot' linked to this hotspot.
	 * The camera must exist in CameraProps.cameras.
	 */
	linkedCameraId?: string
	/** Whether the hotspot dot/overlay is visible to the end user. */
	visible: boolean
	/**
	 * If true the hotspot is only rendered inside the publisher editor.
	 * It is excluded from the published/embed runtime payload.
	 * The authoring data is always retained.
	 */
	internalOnly: boolean
	/**
	 * 0-based position in the optional hotspot navigation sequence.
	 * undefined = not part of any sequence.
	 */
	sequenceIndex?: number
	stylePreset: HotspotStylePreset
	/**
	 * URL or inline data URI for 'image' and 'svg' presets.
	 * Unused when stylePreset === 'dot'.
	 */
	payloadUrl?: string
}

// ---------------------------------------------------------------------------
// Scene settings
// ---------------------------------------------------------------------------

/**
 * Scene settings containing viewer configuration.
 * Used for persisting and restoring scene appearance and behavior.
 */
export interface SceneSettings {
	/** Bounds settings */
	bounds?: BoundsProps
	/** Camera settings */
	camera?: CameraProps
	/** Declarative scene interactions */
	interactions?: SceneInteractionDefinition[]
	/** Camera controls configuration */
	controls?: ControlsProps
	/** Environment/lighting configuration */
	environment?: EnvironmentProps
	/** Shadow rendering settings */
	shadows?: ShadowsProps
	/** Hotspot definitions. internalOnly hotspots are excluded from the published runtime payload. */
	hotspots?: HotspotDefinition[]
}

/** Extended GLTF document including optional persisted asset metadata. */
export interface ExtendedGLTFDocument extends JSONDocument {
	readonly assetIds?: string[]
	readonly asset?: {
		readonly extensions?: {
			readonly VECTREAL_asset_metadata?: {
				readonly assetIds: string[]
			}
		}
	}
}

/** Serialized scene asset payload used in API transport. */
export interface SceneAssetDataEntry {
	/** Binary data as array of numbers or base64 string */
	data: number[] | string
	/** Original filename of the asset */
	fileName: string
	/** MIME type of the asset */
	mimeType: string
	/** Optional transfer encoding metadata */
	encoding?: 'base64'
}

/** Serialized scene asset map keyed by asset identifier. */
export type SerializedSceneAssetDataMap = Record<string, SceneAssetDataEntry>

/** Optional scene metadata payload persisted with scene settings. */
export interface SceneMetaData {
	name?: string
	description?: string
	thumbnailUrl?: string
}

/** Raw API payload contract for scene loading. */
export interface ServerScenePayload {
	/** Optional scene metadata payload. */
	meta?: SceneMetaData
	/** Optional nested scene settings payload. */
	settings?: SceneSettings | null
	/** Legacy flattened settings fields. */
	bounds?: SceneSettings['bounds']
	camera?: SceneSettings['camera']
	controls?: SceneSettings['controls']
	environment?: SceneSettings['environment']
	shadows?: SceneSettings['shadows']
	/** The GLTF JSON structure. */
	gltfJson: ExtendedGLTFDocument | null
	/** Binary asset data keyed by asset identifier. */
	assetData: SerializedSceneAssetDataMap | null
}

/** Resolved scene data contract consumed by loaders and viewer clients. */
export interface ServerSceneData extends SceneSettings {
	/** Optional scene metadata payload. */
	meta?: SceneMetaData
	/** The GLTF JSON structure. */
	gltfJson: ExtendedGLTFDocument
	/** Binary asset data keyed by asset identifier. */
	assetData: SerializedSceneAssetDataMap
}

export interface TextureOptimization
	extends BaseOptimization<'texture'>, TextureCompressOptions {}

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
	extends BaseOptimization<'simplification'>, SimplifyOptions {}

export interface QuantizeOptimization
	extends BaseOptimization<'quantize'>, QuantizeOptions {}

export interface DedupOptimization
	extends BaseOptimization<'dedup'>, DedupOptions {}

export interface NormalsOptimization
	extends BaseOptimization<'normals'>, NormalsOptions {}

export type Optimizations = {
	simplification: SimplificationOptimization
	texture: TextureOptimization
	quantize: QuantizeOptimization
	dedup: DedupOptimization
	normals: NormalsOptimization
}
