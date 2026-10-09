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

import { Document, JSONDocument, Transform, WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
	cloneDocument,
	inspect,
	InspectReport
} from '@gltf-transform/functions'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

import { OperationProgress } from '../types'
import {
	DocumentCurrency,
	SupersededError,
	Ticket,
	unlessSuperseded
} from './document-currency'
import { encodeDracoCopy } from './draco-compression'
import { GeometryCodecs } from './geometry-codecs'
import {
	loadFromThreeJS as _loadFromThreeJS,
	loadFromBuffer as _loadFromBuffer,
	loadFromFile as _loadFromFile,
	loadFromJSON as _loadFromJSON,
	loadFromGLTFWithAssets as _loadFromGLTFWithAssets,
	type LoadResult
} from './model-loading'
import { buildOptimizationReport } from './report-helpers'
import {
	compressDocumentTextures,
	resolveTextureEncoder,
	runBasicTextureOptimization
} from './texture-compression'
import { syncTextureIdentities, syncTextureIdentity } from './texture-naming'
import {
	getTexturePayload,
	listTextureDescriptors,
	replaceTexturePayload
} from './texture-payload'
import {
	dedupPass,
	normalsPass,
	quantizePass,
	simplifyPass,
	TransformPass
} from './transform-passes'
import {
	DedupOptions,
	DracoCompressionReport,
	DracoOptions,
	NormalsOptions,
	OptimizationReport,
	QuantizeOptions,
	SimplifyOptions,
	TextureBinaryPayload,
	TextureDescriptor,
	TextureCompressOptions
} from './types'

export { SupersededError } from './document-currency'

const DEFAULT_DRACO_PATH = '/draco/'

/** What a load establishes and every later optimization is measured against. */
export interface ModelBaseline {
	size: number
	report: InspectReport | null
	/** The model as loaded; null only before a load. */
	source: Uint8Array | null
}

/**
 * Isomorphic 3D model optimization service using glTF-Transform.
 *
 * Provides comprehensive model optimization including:
 * - Mesh simplification
 * - Deduplication
 * - Quantization
 * - Normal optimization
 * - Texture compression via injectable encoder
 *
 * Works in Node.js (Sharp default), browser (OffscreenCanvas via
 * `createBrowserTextureEncoder` from `@vctrl/hooks`), and edge/Deno
 * environments (custom encoder injection).
 *
 * The class holds the model and decides when a result replaces its document.
 * The work lives in sibling modules that take what they need as arguments and
 * never see the class: loading, the transform passes, Draco, texture
 * compression, naming and payloads, and the ticket bookkeeping that refuses a
 * result once a newer model or document has been claimed.
 */
export class ModelOptimizer {
	private _document: Document | null = null
	private io: WebIO
	private exporter: GLTFExporter
	private originalSize = 0
	private originalReport: InspectReport | null = null
	/**
	 * The model as it was loaded. Part of the baseline with the size and report
	 * measured from it, and like them it survives every optimization, so any
	 * result can be re-derived from the original rather than from the previous
	 * result.
	 */
	private sourceBytes: Uint8Array | null = null
	private currency = new DocumentCurrency()
	private appliedOptimizations: string[] = []
	private progressCallback?: (progress: OperationProgress) => void
	private codecs: GeometryCodecs
	private dracoReport: DracoCompressionReport | null = null

	constructor(options?: { dracoPath?: string }) {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
		this.exporter = new GLTFExporter()
		this.codecs = new GeometryCodecs(
			this.io,
			options?.dracoPath ?? DEFAULT_DRACO_PATH
		)
	}

	/**
	 * Set a progress callback to receive optimization progress updates.
	 */
	public onProgress(callback: (progress: OperationProgress) => void): void {
		this.progressCallback = callback
	}

	/**
	 * Load a model from a Three.js Object3D.
	 *
	 * @param model - The Three.js Object3D model to optimize
	 */
	public async loadFromThreeJS(model: Object3D): Promise<void> {
		await this.load(() =>
			_loadFromThreeJS(
				model,
				this.io,
				this.exporter,
				this.emitProgress,
				syncTextureIdentities
			)
		)
	}

	/**
	 * Load a model from a binary buffer.
	 *
	 * @param buffer - The binary model data (GLB format)
	 */
	public async loadFromBuffer(buffer: Uint8Array): Promise<void> {
		await this.load(() =>
			_loadFromBuffer(buffer, this.io, this.emitProgress, syncTextureIdentities)
		)
	}

	/**
	 * Load a glb model model from a file path.
	 *
	 * @param filePath - Path to the model file
	 */
	public async loadFromFile(filePath: string): Promise<void> {
		await this.load(() =>
			_loadFromFile(filePath, this.io, this.emitProgress, syncTextureIdentities)
		)
	}

	/**
	 * Load a model from a JSON glTF document.
	 *
	 * @param json - The JSON glTF document
	 */
	public async loadFromJSON(json: JSONDocument): Promise<void> {
		await this.load(() =>
			_loadFromJSON(
				json,
				this.io,
				this.emitProgress,
				syncTextureIdentities,
				(doc) => this.io.writeBinary(doc)
			)
		)
	}

	/**
	 * Apply mesh simplification optimization.
	 *
	 * @param options - Simplification options
	 */
	public async simplify(options: SimplifyOptions = {}): Promise<void> {
		await this.runPass(simplifyPass, options)
	}

	/**
	 * Apply deduplication optimization.
	 *
	 * @param options - Deduplication options
	 */
	public async deduplicate(options: DedupOptions = {}): Promise<void> {
		await this.runPass(dedupPass, options)
	}

	/**
	 * Apply quantization optimization.
	 *
	 * @param options - Quantization options
	 */
	public async quantize(options: QuantizeOptions = {}): Promise<void> {
		await this.runPass(quantizePass, options)
	}

	/**
	 * Apply normals optimization.
	 *
	 * @param options - Normals options
	 */
	public async optimizeNormals(options: NormalsOptions = {}): Promise<void> {
		await this.runPass(normalsPass, options)
	}

	private async runPass<Options>(
		pass: TransformPass<Options>,
		options: Options
	): Promise<void> {
		this.ensureModelLoaded()

		this.emitProgress(pass.started, 0)
		await this.applyTransforms(pass.transforms(options), pass.name)
		this.emitProgress(pass.finished, 100)
	}

	private encodeDracoCopy(options: DracoOptions) {
		return encodeDracoCopy(
			this.ensureModelLoaded(),
			options,
			this.io,
			this.codecs,
			this.emitProgress
		)
	}

	/**
	 * Records a finished measurement on this instance.
	 *
	 * The applied-steps entry is added only when the measurement is worth
	 * applying, which is the honest reading: callers treat a non-empty applied
	 * list as "a pass produced results", and a Draco run that would grow the
	 * file produced none. It matters that this happens here at all because
	 * measuring leaves the document untouched, so the mutate-and-record path the
	 * other steps share never runs — without it a Draco-only pass that did save
	 * something would report nothing.
	 */
	private adoptDracoReport(report: DracoCompressionReport): void {
		this.dracoReport = report

		if (report.isWorthApplying) {
			this.addAppliedOptimization('draco compression')
		}

		this.emitProgress('Draco compression complete', 100)
	}

	/**
	 * Measure what `KHR_draco_mesh_compression` would buy this model, without
	 * touching the loaded document.
	 *
	 * Draco is lossy and is deferred until write time, so compressing the
	 * working document would mean re-encoding (and degrading) the geometry on
	 * every subsequent optimize/save round-trip. Instead this compresses a
	 * throwaway clone once, reads every number back out of the bytes it just
	 * wrote, and leaves the caller to apply compression at export time via
	 * `ModelExporter.exportDocumentGLBDraco`.
	 *
	 * The result is also stored on this instance so `getReport()` picks it up.
	 */
	public async measureDracoCompression(
		options: DracoOptions = {}
	): Promise<DracoCompressionReport> {
		const ticket = this.currency.currentTicket()
		return unlessSuperseded(
			() => !this.currency.isCurrent(ticket),
			() => this.encodeDracoCopy(options),
			({ report }) => {
				this.adoptDracoReport(report)
				return report
			}
		)
	}

	/**
	 * Replace the loaded document with a Draco-compressed copy of itself.
	 *
	 * Should run last in an optimization pass — simplification/quantization/etc.
	 * operate on decoded accessors, so running them after compression would be
	 * pointless.
	 *
	 * The platform app does not use this: it measures with
	 * `measureDracoCompression` and compresses at export time instead, so the
	 * working document is never lossily re-encoded. Kept for Node/CLI callers
	 * that want a compressed document directly.
	 */
	public async compressGeometry(options: DracoOptions = {}): Promise<void> {
		const ticket = this.currency.currentTicket()
		await unlessSuperseded(
			() => !this.currency.isCurrent(ticket),
			() => this.encodeDracoCopy(options),
			({ report, workingDoc }) => {
				this.adoptDracoReport(report)

				if (!report.isWorthApplying) {
					console.warn(
						`draco compression increased model size (${report.uncompressedGlbBytes} → ${report.projectedGlbBytes} bytes), skipping.`
					)
					return
				}

				// The already-encoded clone, rather than a second encode of the
				// same document.
				this._document = workingDoc
			}
		)
	}

	/**
	 * Adopt a Draco measurement produced elsewhere — specifically by the
	 * optimizer instance inside the geometry Web Worker, whose report would
	 * otherwise die with the worker. Pass `null` to clear.
	 */
	public setDracoReport(report: DracoCompressionReport | null): void {
		this.dracoReport = report
	}

	/**
	 * Read the pristine baseline captured at load time, so a caller that is about
	 * to replace this document with an already-optimized version of itself can
	 * put it back afterwards. Pairs with `setBaseline`.
	 */
	public getBaseline(): ModelBaseline {
		return {
			size: this.originalSize,
			report: this.originalReport,
			source: this.sourceBytes
		}
	}

	/**
	 * Restore a baseline captured by `getBaseline`.
	 *
	 * Every `loadFrom*` re-derives the baseline from the bytes it was handed,
	 * which is right for a genuine load and wrong for a sync: transplanting the
	 * geometry worker's output back onto this instance would otherwise re-baseline
	 * on the already-optimized document, making every `before` in the report equal
	 * its `after`.
	 */
	public setBaseline(baseline: ModelBaseline): void {
		this.originalSize = baseline.size
		this.originalReport = baseline.report
		this.sourceBytes = baseline.source
	}

	/**
	 * Whether there is an original to re-derive from. False only before the
	 * first load and after `reset`.
	 */
	public hasSource(): boolean {
		return this.sourceBytes !== null
	}

	/**
	 * Put the original back as the working document, discarding every
	 * optimization applied since. The baseline is kept, so a report taken after
	 * the next pass measures it against the original.
	 *
	 * Every optimization pass that is meant to be reproducible from the original
	 * plus its settings starts here.
	 */
	public async restoreSource(): Promise<void> {
		// Read before the first await: a load meanwhile replaces the source.
		const source = this.sourceBytes
		if (!source) {
			throw new Error('No source to restore. Load a model first.')
		}
		const ticket = this.currency.claimDocument()
		await this.parseDocument(source, ticket, source, (document) => {
			this._document = document
			this.appliedOptimizations = []
			this.dracoReport = null
		})
	}

	/**
	 * Replace the document with a derivation of the same source, such as the
	 * geometry worker's output, keeping the baseline. Unlike a load this claims
	 * nothing: the result belongs to the model held when it was asked for, and
	 * is dropped if another model was loaded meanwhile.
	 */
	public async replaceDocument(buffer: Uint8Array): Promise<void> {
		const source = this.sourceBytes
		const ticket = this.currency.claimDocument()
		await this.parseDocument(buffer, ticket, source, (document) => {
			this._document = document
		})
	}

	/**
	 * Parses a document of the current model for `restoreSource` or
	 * `replaceDocument`. It is refused if another document or model was
	 * claimed meanwhile, or if a source stated meanwhile retired `source`, the
	 * one it belongs to.
	 */
	private parseDocument(
		bytes: Uint8Array,
		ticket: Ticket,
		source: Uint8Array | null,
		commit: (document: Document) => void
	): Promise<void> {
		return unlessSuperseded(
			() => !this.currency.isCurrent(ticket) || this.sourceBytes !== source,
			async () => {
				await this.codecs.registerDecoders()
				const { document } = await _loadFromBuffer(
					bytes,
					this.io,
					this.emitProgress,
					syncTextureIdentities
				)
				return document
			},
			commit
		)
	}

	/**
	 * State what the original of the current document is, without changing the
	 * document. For a document loaded in an already-optimized form, such as a
	 * saved scene, whose original is held elsewhere: the baseline and every
	 * later re-derivation then start from `bytes`.
	 */
	public async setSource(bytes: Uint8Array): Promise<void> {
		// A source belongs to a document; there is none to state it for.
		this.ensureModelLoaded()
		// Not a new model: the document stays, and work on it stays valid, so
		// only a newer model refuses this.
		const ticket = this.currency.currentTicket()
		await unlessSuperseded(
			() => !this.currency.isCurrentModel(ticket),
			async () => {
				await this.codecs.registerDecoders()
				return _loadFromBuffer(
					bytes,
					this.io,
					this.emitProgress,
					// Measured, not adopted: the parsed document is thrown away.
					() => {}
				)
			},
			({ originalSize, originalReport, sourceBytes }) => {
				this.originalSize = originalSize
				this.originalReport = originalReport
				this.sourceBytes = sourceBytes
			}
		)
	}

	/**
	 * Compress textures using an injectable encoder.
	 *
	 * In Node.js the Sharp library is used by default. In browser or edge
	 * environments pass a custom encoder via `options.encoder` — for example
	 * `createBrowserTextureEncoder()` from `@vctrl/hooks` which uses
	 * OffscreenCanvas and requires no network call.
	 *
	 * The pass compresses a copy and commits it in one step, as
	 * `applyTransforms` does, so the document only ever holds a finished
	 * result:
	 * - every texture compressed: committed and recorded;
	 * - some failed: the ones that compressed are committed and recorded, and a
	 *   partial `TextureCompressionError` is thrown so the caller can say so;
	 * - none compressed: nothing changes, and the error is thrown;
	 * - another model or document taken meanwhile: nothing changes, and
	 *   `SupersededError` is thrown.
	 *
	 * With no encoder and no Sharp, only the dedup and prune fallback runs, and
	 * only it is recorded.
	 *
	 * @param options - Texture compression options
	 */
	public async compressTextures(
		options: TextureCompressOptions = {}
	): Promise<void> {
		// Both read before the encoder import awaits: a model loaded meanwhile
		// is not the one this pass was asked to compress.
		const document = this.ensureModelLoaded()
		const ticket = this.currency.currentTicket()

		const encoder = await resolveTextureEncoder(options)
		if (!encoder) {
			await runBasicTextureOptimization(
				this.emitProgress,
				(transforms, operationName) =>
					this.applyTransforms(transforms, operationName, ticket)
			)
			return
		}

		// The revision catches a restore or a new model. The document check
		// catches a step that replaced it without claiming one, as
		// `applyTransforms` does, which a commit here would silently undo.
		// Edits made to the document in place while this runs are neither: they
		// are not merged into the copy, and nothing in this repo makes one.
		const isStale = () =>
			!this.currency.isCurrent(ticket) || this._document !== document
		if (isStale()) throw new SupersededError()

		const working = cloneDocument(document)
		const partialFailure = await unlessSuperseded(
			isStale,
			async () => {
				const failure = await compressDocumentTextures(
					working,
					options,
					encoder,
					this.emitProgress
				)
				// Nothing compressed, so there is nothing to commit.
				if (failure && !failure.isPartial) throw failure
				return failure
			},
			(failure) => {
				// On the copy: naming finds a texture's material slot by identity.
				working
					.getRoot()
					.listTextures()
					.forEach((texture, i) => syncTextureIdentity(working, texture, i))
				this._document = working
				this.addAppliedOptimization('texture compression')
				return failure
			}
		)

		if (partialFailure) throw partialFailure
	}

	/**
	 * Apply all standard optimizations in sequence. Every pass runs with its own
	 * defaults unless you set it to `false`.
	 *
	 * That includes texture compression, which needs an encoder. Outside Node.js,
	 * pass one as `textures.encoder` (see {@link compressTextures}) or set
	 * `textures: false`. Without one, the pass warns and falls back to a dedup and
	 * prune of the texture set.
	 *
	 * @param options - Per-pass options, or `false` to skip that pass
	 */
	public async optimizeAll(
		options: {
			simplify?: SimplifyOptions | false
			dedup?: DedupOptions | false
			quantize?: QuantizeOptions | false
			normals?: NormalsOptions | false
			textures?: TextureCompressOptions | false
		} = {}
	): Promise<void> {
		this.ensureModelLoaded()
		// Each step checks only its own run; this keeps the rest of the
		// sequence off a model loaded between two steps.
		const ticket = this.currency.currentTicket()

		const operations = []
		if (options.simplify !== false)
			operations.push(() => this.simplify(options.simplify as SimplifyOptions))
		if (options.dedup !== false)
			operations.push(() => this.deduplicate(options.dedup as DedupOptions))
		if (options.quantize !== false)
			operations.push(() => this.quantize(options.quantize as QuantizeOptions))
		if (options.normals !== false)
			operations.push(() =>
				this.optimizeNormals(options.normals as NormalsOptions)
			)
		if (options.textures !== false)
			operations.push(() =>
				this.compressTextures(options.textures as TextureCompressOptions)
			)

		for (let i = 0; i < operations.length; i++) {
			const progress = Math.round((i / operations.length) * 100)
			this.emitProgress(
				`Running optimization ${i + 1}/${operations.length}`,
				progress
			)
			this.currency.ensureCurrent(ticket)
			await operations[i]()
		}

		this.emitProgress('All optimizations complete', 100)
	}

	/**
	 * Get the optimization report with statistics.
	 */
	public async getReport(): Promise<OptimizationReport> {
		const document = this.ensureModelLoaded()
		const ticket = this.currency.currentTicket()
		const currentInspectReport = inspect(document)
		const currentSize = (await this.export()).byteLength
		// Otherwise a newer model's baseline would describe this document.
		this.currency.ensureCurrent(ticket)

		return buildOptimizationReport(
			this.originalSize,
			currentSize,
			this.originalReport,
			currentInspectReport,
			this.appliedOptimizations,
			this.dracoReport ?? undefined
		)
	}

	/**
	 * Export the optimized model as binary GLB.
	 */
	public async export(): Promise<Uint8Array> {
		const document = this.ensureModelLoaded()
		return await this.io.writeBinary(document)
	}

	/**
	 * Export the optimized model as JSON GLTF + resources
	 */
	public async exportJSON(): Promise<JSONDocument> {
		const document = this.ensureModelLoaded()
		return await this.io.writeJSON(document)
	}

	/**
	 * Reset the optimizer state.
	 */
	public reset(): void {
		this.currency.claimModel()
		this.clear()
	}

	private clear(): void {
		this._document = null
		this.originalSize = 0
		this.originalReport = null
		this.sourceBytes = null
		this.appliedOptimizations = []
		this.dracoReport = null
	}

	/**
	 * Check if a model is currently loaded.
	 */
	public hasModel(): boolean {
		return this._document !== null
	}

	public listTextureDescriptors(): TextureDescriptor[] {
		return listTextureDescriptors(this.ensureModelLoaded())
	}

	public getTexturePayload(index: number): TextureBinaryPayload {
		return getTexturePayload(this.ensureModelLoaded(), index)
	}

	public replaceTexturePayload(
		index: number,
		image: Uint8Array,
		mimeType: string,
		fileName?: string
	): void {
		replaceTexturePayload(
			this.ensureModelLoaded(),
			index,
			image,
			mimeType,
			fileName
		)
	}

	/**
	 * Load a GLTF (JSON) model directly from raw bytes and an asset map, bypassing Three.js.
	 * This preserves original texture URIs and filenames present in the GLTF document.
	 *
	 * @param gltfBytes - Raw bytes of the .gltf JSON file
	 * @param assets - Map of URI → bytes for all referenced assets (textures, buffers)
	 */
	public async loadFromGLTFWithAssets(
		gltfBytes: Uint8Array,
		assets: Map<string, Uint8Array>
	): Promise<void> {
		await this.load(() =>
			_loadFromGLTFWithAssets(
				gltfBytes,
				assets,
				this.io,
				this.emitProgress,
				syncTextureIdentities,
				(doc) => this.io.writeBinary(doc)
			)
		)
	}

	/**
	 * Every load claims a new model, which retires the previous one whether or
	 * not this load succeeds. A failed load therefore leaves no model rather
	 * than the previous one, which would otherwise read as loaded and be
	 * optimized, saved and shown under the failed model's name.
	 */
	private async load(read: () => Promise<LoadResult>): Promise<void> {
		const ticket = this.currency.claimModel()
		try {
			await this.codecs.registerDecoders()
			this.adoptLoad(await read(), ticket)
		} catch (error) {
			// A newer model owns the optimizer; this failure is not about it.
			if (!this.currency.isCurrentModel(ticket)) {
				throw error instanceof SupersededError
					? error
					: new SupersededError({ cause: error })
			}
			this.clear()
			throw error
		}
	}

	/**
	 * Every genuine load replaces the document and the whole baseline with it,
	 * unless a newer load claimed the optimizer while this one was parsing.
	 */
	private adoptLoad(result: LoadResult, ticket: Ticket): void {
		this.currency.settle(ticket)
		this._document = result.document
		this.originalSize = result.originalSize
		this.originalReport = result.originalReport
		this.sourceBytes = result.sourceBytes
	}

	/**
	 * Normalize all texture URIs and names to canonical form. Passing `doc`
	 * also adopts it as the loaded document.
	 *
	 * Loads do not call this: they name a document's textures before the load
	 * may commit, and adopting the document here would make it the held one
	 * before that check.
	 */
	public normalizeAllTextureURIs(doc?: Document): void {
		const target = doc ?? this._document
		if (!target) return
		if (doc) this._document = doc
		syncTextureIdentities(target)
	}

	/**
	 * Get the list of applied optimizations.
	 */
	public getAppliedOptimizations(): string[] {
		return [...this.appliedOptimizations]
	}

	/**
	 * Add an optimization to the list of applied optimizations.
	 */
	public addAppliedOptimization(optimizationName: string): void {
		if (!this.appliedOptimizations.includes(optimizationName)) {
			this.appliedOptimizations.push(optimizationName)
		}
	}

	/**
	 * Set the list of applied optimizations.
	 */
	public setAppliedOptimizations(optimizations: string[]): void {
		this.appliedOptimizations = [...optimizations]
	}

	/**
	 * The guard every pass runs first. Private on purpose: it answers a question
	 * callers can ask directly with `hasModel()`, and throwing from it is how a
	 * pass reports being called too early.
	 */
	private ensureModelLoaded(): Document {
		if (!this._document) {
			throw new Error(
				'No model loaded. Call loadFromThreeJS(), loadFromBuffer(), loadFromFile(), ' +
					'loadFromJSON() or loadFromGLTFWithAssets() first.'
			)
		}

		return this._document
	}

	get document() {
		return this.ensureModelLoaded()
	}

	/**
	 * `ticket` is the document the calling operation started on; it defaults
	 * to the current one for callers that reach this without awaiting first.
	 */
	private async applyTransforms(
		transforms: Transform[],
		operationName: string,
		ticket = this.currency.currentTicket()
	): Promise<void> {
		// Asked before the document is: a reset or a failed load that retired
		// the ticket also cleared the document, and returning quietly then
		// would report a step that never ran as done.
		this.currency.ensureCurrent(ticket)
		// Read once: the document can be replaced while this awaits.
		const document = this._document
		if (!document) return

		try {
			// Create a safe copy and get original size before any mutations
			const safeCopyDoc = cloneDocument(document)
			const originalSize = (await this.io.writeBinary(safeCopyDoc)).byteLength

			// Create a working copy to apply transforms to
			const workingDoc = cloneDocument(document)
			await workingDoc.transform(...transforms)

			// Check if transformation resulted in a model with increased size
			const newSize = (await this.io.writeBinary(workingDoc)).byteLength
			// Before either outcome: a retired step neither commits nor reverts.
			this.currency.ensureCurrent(ticket)

			if (newSize > originalSize) {
				console.warn(
					`${operationName} increased model size (${originalSize} → ${newSize} bytes), reverting changes.`
				)
				return
			}

			// If optimization was beneficial, update the model and track the optimization
			this._document = workingDoc
			this.appliedOptimizations.push(operationName)
		} catch (error) {
			// Its own commit check, or a failure while stale: either way not
			// about the document that retired it.
			if (!this.currency.isCurrent(ticket))
				throw new SupersededError({ cause: error })
			throw new Error(`Failed to apply ${operationName}: ${error}`, {
				cause: error
			})
		}
	}

	private emitProgress = (
		operation: string,
		progress: number,
		details?: string
	): void => {
		if (this.progressCallback) {
			this.progressCallback({ operation, progress, details })
		}
	}
}
