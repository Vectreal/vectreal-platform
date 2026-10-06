import type { SceneSourceRef, SceneStatsData } from './api'
import type {
	DracoCompressionReport,
	GeometryCodec,
	GeometryCodecSizes,
	Optimizations
} from '@vctrl/core'
import type { Object3D } from 'three'

/**
 * Presets the user can pick. Every one of these has an entry in
 * `optimizationPresets`. `original` runs nothing: the scene as uploaded.
 */
export type PresetId = 'original' | 'quality' | 'balanced' | 'smallest'

/** The source shown in place of the optimized model while it is held. */
export interface ComparedModel {
	model: Object3D
	/** The untouched upload, rather than a saved, optimized version. */
	isOriginal: boolean
}

/** The scene's original, kept beside its optimized model. */
export interface KeptOriginalState {
	/** The author's choice: whether a save keeps the original. */
	keep: boolean
	/**
	 * The original the server already holds, until it is loaded into the
	 * optimizer. Reopening a scene does not fetch it: the first optimization
	 * pass does, and a save before that re-links it by id.
	 */
	stored: SceneSourceRef | null
	/**
	 * Whether the scene as last saved keeps an original. The save baseline for
	 * the choice: changing it is an unsaved change like any other.
	 */
	saved: boolean
	/**
	 * The last attempt to read the stored original failed, so passes derive
	 * from the saved version. It stays stored and linked all the same, and the
	 * next choice tries again.
	 */
	unreadable: boolean
}

/**
 * What the panel displays as selected. `custom` is not a preset you can pick —
 * it is what the settings resolve to once they no longer match any preset,
 * either because the user edited the advanced controls or because the scene was
 * saved under an older pipeline.
 */
export type OptimizationPreset = PresetId | 'custom'

export interface OptimizationState {
	/** The settings the panel shows, which the next pass will apply. */
	optimizations: Optimizations
	optimizationPreset: OptimizationPreset
	/**
	 * What the optimizer's source already embodies, so what re-deriving from it
	 * starts with. The `original` preset for an upload, whose source is the
	 * model as uploaded. For a scene that was saved optimized without its
	 * original, the settings it was saved with: that saved document is the only
	 * source there is, and calling it "original" would be false.
	 */
	sourceSettings: Optimizations
	/**
	 * The settings the document on screen was derived from: what a save, a
	 * draft and the publish-time Draco repack describe. Never the panel's
	 * unapplied edits. It starts as `sourceSettings`, because the document is
	 * the source until a pass runs, and returns to it when a pass fails.
	 */
	derivedFrom: Optimizations
}

export interface SceneOptimizationRuntimeState {
	isPending: boolean
	isSceneSizeLoading: boolean
	/**
	 * Size of the scene as it will be published. Before a publish this is the
	 * projected Draco GLB; after one it is the GLB that was published, in
	 * whichever geometry codec won and with KTX2 textures where they were kept,
	 * which is what the plan size gate and the server both end up measuring.
	 */
	optimizedSceneBytes: null | number
	clientSceneBytes: null | number
	/**
	 * Size of the uncompressed working document. Equal to `optimizedSceneBytes`
	 * unless Draco is enabled, in which case it is the larger "before Draco"
	 * figure shown as secondary detail.
	 */
	workingSceneBytes: null | number
	optimizedTextureBytes: null | number
	clientTextureBytes: null | number
	lastSavedReportSignature: null | string
	latestSceneStats: null | SceneStatsData
	/** Draco measurement from the most recent optimization pass. */
	dracoReport: null | DracoCompressionReport
	/**
	 * How the last publish encoded this document, which the size figures above
	 * then describe. Cleared when the document changes, since the published
	 * file no longer describes it.
	 */
	publishedEncoding: null | PublishedEncoding
	/**
	 * The latest optimization pass to start, unique for the page's life, so
	 * work that outlives a pass can tell whether the document it read has been
	 * replaced since. A pass can rewrite the document in place, so the
	 * document's identity cannot answer that. 0 until the first pass.
	 */
	passRevision: number
}

export interface PublishedEncoding {
	geometryCodec: GeometryCodec
	/** Gzipped geometry per codec; absent when geometry compression is off. */
	geometrySizes?: GeometryCodecSizes
	/** Textures shipped as KTX2, out of all textures; absent when KTX2 was off. */
	ktx2Textures?: { encoded: number; total: number }
}

export type OptimizationModalSource = 'initial' | 'reoptimize' | null

export interface SceneOptimizationModalState {
	isOpen: boolean
	source: OptimizationModalSource
}
