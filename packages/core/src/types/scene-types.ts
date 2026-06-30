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
	AccumulativeShadowsProps as ThreeAccumulativeShadowsProps,
	OrbitControlsProps,
	RandomizedLightProps,
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
}

/**
 * Props for the SceneBounds component, extending ThreeBoundsProps from '@react-three/drei'.
 */

export interface BoundsProps extends ThreeBoundsProps {
	enable?: boolean
}

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

export type ShadowType = 'contact' | 'accumulative'

/**
 * Base interface for shadow properties.
 */
export interface ShadowTypePropBase {
	type: ShadowType
	enabled?: boolean
}

/**
 * Props for Contact Shadows.
 */
export interface ContactShadowProps
	extends ShadowTypePropBase, ThreeContactShadowsProps {
	type: 'contact'
}

/**
 * Light configuration for accumulative shadows (a drei `RandomizedLight`).
 */
export type AccumulativeShadowLight = Pick<
	RandomizedLightProps,
	'intensity' | 'amount' | 'radius' | 'ambient' | 'position' | 'bias'
>

/**
 * Reference to a persisted accumulative-shadow bake. Stored in the scene's
 * shadow settings so a saved scene can load the baked shadow texture instead of
 * recomputing it. The bytes live in asset storage under {@link assetId}; the
 * viewer reuses the texture only while {@link signature} still matches the
 * current bake inputs.
 */
export interface BakedShadowRef {
	/** Scene asset id of the stored shadow-density PNG. */
	assetId: string
	/** Bake signature the texture was captured with. */
	signature: string
}

/**
 * Configuration for the soft contact/ground shadow that approximates ground
 * ambient occlusion under the model. Plane size and capture height are derived
 * from the model automatically; these are the surfaced controls.
 */
export interface ContactShadowConfig {
	/** Whether the ground shadow is rendered. Defaults to false. */
	enabled?: boolean
	/** Darkness of the ground shadow (0–1). Defaults to 0.6. */
	opacity?: number
	/** Softness/blur of the ground shadow. Higher is softer. Defaults to 3. */
	blur?: number
	/** Plane size as a multiple of the model footprint (how far the pool spreads). Defaults to 1.5. */
	scale?: number
	/**
	 * How far UP from the floor geometry still casts the ground shadow, as a
	 * fraction of the model's height (the ContactShadows depth-camera `far`). Lower
	 * confines the darkening to where the model is closest to the ground for a
	 * tighter, more accurate ambient-occlusion look; higher reaches up the model
	 * for a broad grounding pool. Defaults to 0.35.
	 */
	reach?: number
}

/**
 * Props for Accumulative Shadows — high quality baked soft shadows for a static
 * subject. Camera auto-rotate orbits the camera (not the model), so the bake
 * stays valid while rotating; the viewer falls back to contact shadows only
 * while a model's geometry is actually animating.
 */
export interface AccumulativeShadowsProps
	extends ShadowTypePropBase, ThreeAccumulativeShadowsProps {
	type: 'accumulative'
	light?: AccumulativeShadowLight
	/**
	 * Manual trim on the auto-calibrated shadow cutoff. The viewer measures the
	 * baked plane's lit brightness and sets `alphaTest` to it automatically (so the
	 * shadow reads correctly across environments); this multiplier nudges that
	 * result. 1 = pure auto, &lt;1 deepens (risks haze), &gt;1 lightens. Defaults to 1.
	 */
	cutoffScale?: number
	/**
	 * Enables screen-space ambient occlusion (N8AO) so the model self-occludes in
	 * crevices and tight gaps. This reintroduces a postprocessing composer and runs
	 * every rendered frame, so it is opt-in. Defaults to false.
	 */
	ao?: boolean
	/**
	 * A soft contact/ground shadow (drei `ContactShadows`) layered under the
	 * directional accumulative bake. It approximates the ambient occlusion the
	 * model casts on the floor and keeps the model grounded independently of the
	 * directional light's angle. Baked once (no per-frame cost). Tuned mainly via
	 * `blur` (softness) and `opacity` (darkness).
	 */
	contact?: ContactShadowConfig
	/**
	 * Strength of the ambient occlusion when {@link ao} is enabled. Higher is
	 * darker. Defaults to 1.4.
	 */
	aoIntensity?: number
	/**
	 * A persisted bake of the accumulative shadow. Written on save and consumed on
	 * load so a returning visit renders the stored texture instead of recomputing
	 * the bake. Invalidated automatically when the bake inputs change (see the
	 * viewer's bake signature).
	 */
	baked?: BakedShadowRef
}

/**
 * Shadow configuration props. Extend `ShadowType` to add future shadow variants.
 */
export type ShadowsProps = ContactShadowProps | AccumulativeShadowsProps

/**
 * Options for runtime model size normalization.
 * The viewer clamps the model's bounding-box diagonal to [minSize, maxSize]
 * by applying a uniform scale to the model root group.
 */
export interface NormalizationOptions {
	enabled: boolean
	/** Lower bound for the bounding-box diagonal. Default: 0.5 */
	minSize?: number
	/** Upper bound for the bounding-box diagonal. Default: 5 */
	maxSize?: number
}

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
	/**
	 * When true the hotspot fades/hides when occluded by scene geometry.
	 * When false the hotspot renders at full opacity regardless of depth.
	 */
	occlusionEnabled?: boolean
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
	/** Runtime model size normalization. Does not modify the underlying glTF data. */
	normalization?: NormalizationOptions
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
