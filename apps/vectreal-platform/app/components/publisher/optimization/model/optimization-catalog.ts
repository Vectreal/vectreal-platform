import type { GeometryOptimizationKey } from '../../../../workers/optimization.worker.types'
import type { Optimizations } from '@vctrl/core'

export type OptimizationKey = keyof Optimizations
export type OptimizationPhase = 'geometry' | 'texture'

interface BaseDefinition {
	/**
	 * Row label in the progress checklist. The worker tags its progress messages
	 * with this exact string, so the two cannot drift.
	 */
	stepLabel: string
	/** Control heading in the advanced panel, and the name used in preset summaries. */
	title: string
	/** One-line explanation shown under the control. */
	description: string
	/** Longer explanation behind the info tooltip. */
	tooltip: string
	/**
	 * True when the step changes topology or shading rather than just precision.
	 * Destructive steps are kept out of every preset and are flagged in the UI.
	 */
	isDestructive: boolean
}

/**
 * Geometry steps run in the optimization Web Worker; the texture step runs on
 * the main thread afterwards, against the browser's OffscreenCanvas encoder.
 */
export type OptimizationDefinition =
	| (BaseDefinition & { phase: 'geometry'; key: GeometryOptimizationKey })
	| (BaseDefinition & { phase: 'texture'; key: 'texture' })

/**
 * Every optimization, in the order the pipeline runs them.
 *
 * This is the one place a step is described. The progress checklist, the
 * advanced panel copy, the preset summaries, and the worker payload all read
 * from here, so adding a step means adding one entry rather than editing four
 * lists that have to agree.
 *
 * Note this is *execution* order, not display order — the advanced panel leads
 * with geometry compression and buries mesh reduction at the bottom, which is a
 * presentation choice made in that component.
 */
export const OPTIMIZATION_CATALOG: readonly OptimizationDefinition[] = [
	{
		key: 'simplification',
		phase: 'geometry',
		stepLabel: 'Mesh simplification',
		title: 'Reduce polygon count',
		description: 'Collapses triangles to lower the draw cost at runtime',
		tooltip:
			'Removes triangles until the mesh hits your target or the deviation limit stops it, whichever comes first. This rewrites topology: it can leave holes, shading seams, and distorted UVs, especially on hard-surface models. Reach for it when the triangle count itself is the problem, not the file size — geometry compression shrinks the download without touching the mesh.',
		isDestructive: true
	},
	{
		key: 'dedup',
		phase: 'geometry',
		stepLabel: 'Duplicate removal',
		title: 'Remove duplicates',
		description: 'Merges identical meshes, materials, and textures',
		tooltip:
			'Identifies and merges duplicate accessors, materials, and textures. Lossless, so it is on in every preset.',
		isDestructive: false
	},
	{
		key: 'quantize',
		phase: 'geometry',
		stepLabel: 'Vertex quantization',
		title: 'Quantize vertices',
		description: 'Stores vertex attributes at lower precision',
		tooltip:
			'Reduces the number of bits used to store vertex positions and attributes, producing smaller files at the cost of minor visual artifacts. Redundant when geometry compression is on, since Draco quantizes on its own.',
		isDestructive: false
	},
	{
		key: 'normals',
		phase: 'geometry',
		stepLabel: 'Normal refinement',
		title: 'Optimize normals',
		description: 'Recomputes normal vectors for cleaner shading',
		tooltip:
			'Recalculates normal vectors to improve lighting appearance. Helpful on models exported with missing or broken normals; unnecessary otherwise.',
		isDestructive: false
	},
	{
		key: 'draco',
		phase: 'geometry',
		stepLabel: 'Draco compression',
		title: 'Compress geometry (Draco)',
		description: 'The largest size saving available, without altering the mesh',
		tooltip:
			'Applies Draco mesh compression, typically the single largest reduction in file size. Topology is preserved — only precision is reduced — so the model keeps its shape. Compression is applied when you publish, so the scene you edit stays at full precision. Draco quantizes vertex attributes itself, which is why "Quantize vertices" turns off alongside it.',
		isDestructive: false
	},
	{
		key: 'texture',
		phase: 'texture',
		stepLabel: 'Texture optimization',
		title: 'Texture optimization',
		description: 'Resizes and re-encodes images',
		tooltip:
			'Resizes and compresses textures to reduce file size. On texture-heavy models this usually outweighs every geometry saving combined. Smaller dimensions and lower quality reduce visual fidelity.',
		isDestructive: false
	}
]

const DEFINITIONS_BY_KEY = new Map(
	OPTIMIZATION_CATALOG.map((definition) => [definition.key, definition])
)

export function getOptimizationDefinition(
	key: OptimizationKey
): OptimizationDefinition {
	const definition = DEFINITIONS_BY_KEY.get(key)
	if (!definition) {
		throw new Error(`No catalog entry for optimization "${key}"`)
	}
	return definition
}

function isGeometryDefinition(
	definition: OptimizationDefinition
): definition is BaseDefinition & {
	phase: 'geometry'
	key: GeometryOptimizationKey
} {
	return definition.phase === 'geometry'
}

/** Geometry step keys in worker execution order. */
export const GEOMETRY_KEYS: GeometryOptimizationKey[] =
	OPTIMIZATION_CATALOG.filter(isGeometryDefinition).map(
		(definition) => definition.key
	)

export const OPTIMIZATION_KEYS: OptimizationKey[] = OPTIMIZATION_CATALOG.map(
	(definition) => definition.key
)

/**
 * Geometry keys enabled in the given settings, in execution order.
 *
 * Reads the object keys rather than any field inside each entry, so settings
 * persisted before a step existed (which have no entry at all) degrade to
 * "disabled" instead of producing a half-populated one.
 */
export function listEnabledGeometryKeys(
	optimizations: Optimizations
): GeometryOptimizationKey[] {
	return GEOMETRY_KEYS.filter((key) => Boolean(optimizations[key]?.enabled))
}

/** All enabled keys, geometry and texture, in execution order. */
export function listEnabledKeys(
	optimizations: Optimizations
): OptimizationKey[] {
	return OPTIMIZATION_KEYS.filter((key) =>
		Boolean(optimizations[key]?.enabled)
	)
}
