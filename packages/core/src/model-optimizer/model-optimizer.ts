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
	Document,
	JSONDocument,
	Texture,
	Transform,
	WebIO
} from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
	cloneDocument,
	DedupOptions as GltfDedupOptions,
	draco,
	DracoOptions as GltfDracoOptions,
	NormalsOptions as GltfNormalsOptions,
	QuantizeOptions as GltfQuantizeOptions,
	inspect,
	InspectReport,
	normals,
	quantize,
	simplify,
	weld,
	dedup
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

import {
	canLoadDracoInBrowser,
	loadDracoModule
} from '../draco/load-draco-module'
import { OperationProgress } from '../types'
import {
	loadFromThreeJS as _loadFromThreeJS,
	loadFromBuffer as _loadFromBuffer,
	loadFromFile as _loadFromFile,
	loadFromJSON as _loadFromJSON,
	loadFromGLTFWithAssets as _loadFromGLTFWithAssets,
	type LoadResult
} from './model-loading'
import {
	buildOptimizationReport,
	calculateDracoCompressedGeometrySize,
	calculateMeshSize,
	readGlbJsonChunk
} from './report-helpers'
import { runTextureCompression } from './texture-compression'
import {
	mimeTypeToExtension,
	replaceUriExtension,
	buildTextureFallbackFileName,
	extractFileNameSegment,
	isGenericTextureFileName,
	resolveTextureByMaterialSlot
} from './texture-naming'
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

const DEFAULT_DRACO_PATH = '/draco/'

/**
 * Thrown by an operation whose model was replaced while it ran. It changed
 * nothing; the optimizer holds the newer model.
 */
export class SupersededError extends Error {
	constructor(options?: ErrorOptions) {
		super('Superseded: a newer model was loaded while this ran.', options)
		this.name = 'SupersededError'
	}
}

/** The model and document an operation started on; see `generation`. */
type Ticket = { generation: number; revision: number }

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
	/**
	 * Which model the optimizer holds and which document of it. Every load
	 * and `reset` claims a new model; `restoreSource` and
	 * `replaceDocument` claim a new document of the same model. Operations
	 * await between reading this optimizer's state and writing it, so each one
	 * commits only if neither changed meanwhile: work still running for a
	 * previous model or document, such as a step a caller timed out on, then
	 * throws `SupersededError` and changes nothing.
	 */
	private generation = 0
	private revision = 0
	/**
	 * The newest model that finished loading. While it trails
	 * `generation` a load is pending, and the document still held is the one
	 * that load is replacing, so no new work may start on it.
	 */
	private settledGeneration = 0
	private appliedOptimizations: string[] = []
	private progressCallback?: (progress: OperationProgress) => void
	private dracoPath: string
	private dracoEncoderRegistration: Promise<void> | null = null
	private dracoDecoderRegistration: Promise<void> | null = null
	private dracoReport: DracoCompressionReport | null = null

	constructor(options?: { dracoPath?: string }) {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
		this.exporter = new GLTFExporter()
		this.dracoPath = options?.dracoPath ?? DEFAULT_DRACO_PATH
	}

	/**
	 * Lazily loads and registers the Draco encoder module on this instance's
	 * WebIO, so `writeBinary`/`writeJSON` can encode `KHR_draco_mesh_compression`
	 * primitives after `document.transform(draco(...))`. Memoized per instance.
	 */
	private ensureDracoEncoderRegistered(): Promise<void> {
		if (!this.dracoEncoderRegistration) {
			this.dracoEncoderRegistration = canLoadDracoInBrowser()
				? loadDracoModule('encoder', this.dracoPath).then((encoderModule) => {
						this.io.registerDependencies({
							'draco3d.encoder': encoderModule
						})
					})
				: Promise.reject(
						new Error(
							'Draco encoding requires a browser (window or worker) environment'
						)
					)
		}
		return this.dracoEncoderRegistration
	}

	/**
	 * Lazily loads and registers the Draco decoder module on this instance's
	 * WebIO, so `readBinary`/`readJSON` can decode `KHR_draco_mesh_compression`
	 * primitives — needed both for loading pre-compressed input and for
	 * reloading this optimizer's own Draco-compressed output (e.g. syncing
	 * the worker's compressed buffer back to the main-thread optimizer via
	 * `loadFromBuffer`). Memoized per instance; no-ops outside a browser.
	 */
	private ensureDracoDecoderRegistered(): Promise<void> {
		if (!this.dracoDecoderRegistration) {
			this.dracoDecoderRegistration = canLoadDracoInBrowser()
				? loadDracoModule('decoder', this.dracoPath).then((decoderModule) => {
						this.io.registerDependencies({
							'draco3d.decoder': decoderModule
						})
					})
				: Promise.resolve()
		}
		return this.dracoDecoderRegistration
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
				this.emitProgress.bind(this),
				(doc) => this.normalizeTextureIdentities(doc)
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
			_loadFromBuffer(buffer, this.io, this.emitProgress.bind(this), (doc) =>
				this.normalizeTextureIdentities(doc)
			)
		)
	}

	/**
	 * Load a glb model model from a file path.
	 *
	 * @param filePath - Path to the model file
	 */
	public async loadFromFile(filePath: string): Promise<void> {
		await this.load(() =>
			_loadFromFile(filePath, this.io, this.emitProgress.bind(this), (doc) =>
				this.normalizeTextureIdentities(doc)
			)
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
				this.emitProgress.bind(this),
				(doc) => this.normalizeTextureIdentities(doc),
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
		this.ensureModelLoaded()

		const { ratio = 0.5, error = 0.001 } = options

		this.emitProgress('Applying mesh simplification', 0)

		const transforms: Transform[] = [
			weld(),
			simplify({
				ratio,
				simplifier: MeshoptSimplifier,
				error
			})
		]

		await this.applyTransforms(transforms, 'simplification')
		this.emitProgress('Mesh simplification complete', 100)
	}

	/**
	 * Apply deduplication optimization.
	 *
	 * @param options - Deduplication options
	 */
	public async deduplicate(options: DedupOptions = {}): Promise<void> {
		this.ensureModelLoaded()

		this.emitProgress('Applying deduplication', 0)
		await this.applyTransforms(
			[dedup(options as GltfDedupOptions)],
			'deduplication'
		)
		this.emitProgress('Deduplication complete', 100)
	}

	/**
	 * Apply quantization optimization.
	 *
	 * @param options - Quantization options
	 */
	public async quantize(options: QuantizeOptions = {}): Promise<void> {
		this.ensureModelLoaded()

		this.emitProgress('Applying quantization', 0)
		await this.applyTransforms(
			[quantize(options as GltfQuantizeOptions)],
			'quantization'
		)
		this.emitProgress('Quantization complete', 100)
	}

	/**
	 * Apply normals optimization.
	 *
	 * @param options - Normals options
	 */
	public async optimizeNormals(options: NormalsOptions = {}): Promise<void> {
		this.ensureModelLoaded()

		this.emitProgress('Optimizing normals', 0)
		await this.applyTransforms(
			[normals(options as GltfNormalsOptions)],
			'normals optimization'
		)
		this.emitProgress('Normals optimization complete', 100)
	}

	/**
	 * Draco-encodes a clone of the loaded document and measures the result.
	 *
	 * The encode is the expensive half of every Draco path, so it happens here
	 * exactly once and both callers take what they need: `measureDracoCompression`
	 * keeps only the numbers, `compressGeometry` also adopts the document.
	 */
	private async encodeDracoCopy(options: DracoOptions): Promise<{
		report: DracoCompressionReport
		workingDoc: Document
	}> {
		const document = this.ensureModelLoaded()

		this.emitProgress('Compressing geometry with Draco', 0)

		await this.ensureDracoEncoderRegistered()

		const geometryBytesBefore = calculateMeshSize(inspect(document))
		const uncompressedGlbBytes = (await this.io.writeBinary(document))
			.byteLength

		this.emitProgress('Compressing geometry with Draco', 40)

		const workingDoc = cloneDocument(document)
		await workingDoc.transform(draco(options as GltfDracoOptions))
		const compressedGlb = await this.io.writeBinary(workingDoc)

		this.emitProgress('Compressing geometry with Draco', 90)

		const geometryBytesAfterCompression = calculateDracoCompressedGeometrySize(
			readGlbJsonChunk(compressedGlb)
		)
		const reductionPercent =
			geometryBytesBefore > 0
				? ((geometryBytesBefore - geometryBytesAfterCompression) /
						geometryBytesBefore) *
					100
				: 0

		return {
			workingDoc,
			report: {
				geometryBytesBefore,
				geometryBytesAfterCompression,
				reductionPercent,
				projectedGlbBytes: compressedGlb.byteLength,
				uncompressedGlbBytes,
				isWorthApplying: compressedGlb.byteLength < uncompressedGlbBytes
			}
		}
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
		const ticket = this.currentTicket()
		return this.unlessSuperseded(
			() => !this.isCurrent(ticket),
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
		const ticket = this.currentTicket()
		await this.unlessSuperseded(
			() => !this.isCurrent(ticket),
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
		const ticket = this.claimDocument()
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
		const ticket = this.claimDocument()
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
		return this.unlessSuperseded(
			() => !this.isCurrent(ticket) || this.sourceBytes !== source,
			async () => {
				await this.ensureDracoDecoderRegistered()
				const { document } = await _loadFromBuffer(
					bytes,
					this.io,
					this.emitProgress.bind(this),
					(doc) => this.normalizeTextureIdentities(doc)
				)
				return document
			},
			commit
		)
	}

	/**
	 * Runs an operation `isStale` can retire, then `commit`s its result in the
	 * same synchronous step as the last check: committing after a further
	 * await would leave a gap a newer load could commit in first. A retired
	 * operation throws `SupersededError` however it ended, even a failure of
	 * its own, so no caller reports it against the newer model that retired it.
	 */
	private async unlessSuperseded<T, R>(
		isStale: () => boolean,
		work: () => Promise<T>,
		commit: (result: T) => R
	): Promise<R> {
		let result: T
		try {
			result = await work()
		} catch (error) {
			if (isStale()) throw new SupersededError({ cause: error })
			throw error
		}
		if (isStale()) throw new SupersededError()
		return commit(result)
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
		const ticket = this.currentTicket()
		await this.unlessSuperseded(
			() => ticket.generation !== this.generation,
			async () => {
				await this.ensureDracoDecoderRegistered()
				return _loadFromBuffer(
					bytes,
					this.io,
					this.emitProgress.bind(this),
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
	 * @param options - Texture compression options
	 */
	public async compressTextures(
		options: TextureCompressOptions = {}
	): Promise<void> {
		const document = this.ensureModelLoaded()
		const ticket = this.currentTicket()

		try {
			await runTextureCompression(
				document,
				options,
				this.emitProgress.bind(this),
				(transforms, operationName) =>
					this.applyTransforms(transforms, operationName, ticket)
			)
		} finally {
			// A newer model makes this result moot, partial failure or not.
			this.ensureCurrent(ticket)
		}

		// Sync URI and name to reflect the new MIME type after compression
		// (e.g. .png → .webp), matching what the texture-naming helpers expect.
		document
			.getRoot()
			.listTextures()
			.forEach((texture, i) => this.syncTextureIdentity(document, texture, i))

		this.appliedOptimizations.push('texture compression')
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
		const ticket = this.currentTicket()

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
			this.ensureCurrent(ticket)
			await operations[i]()
		}

		this.emitProgress('All optimizations complete', 100)
	}

	/**
	 * Get the optimization report with statistics.
	 */
	public async getReport(): Promise<OptimizationReport> {
		const document = this.ensureModelLoaded()
		const ticket = this.currentTicket()
		const currentInspectReport = inspect(document)
		const currentSize = (await this.export()).byteLength
		// Otherwise a newer model's baseline would describe this document.
		this.ensureCurrent(ticket)

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
		this.claimModel()
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
		const document = this.ensureModelLoaded()
		return document
			.getRoot()
			.listTextures()
			.map((texture, index) => {
				const fileName = this.resolveTextureCanonicalFileName(
					document,
					texture,
					index
				)

				return {
					index,
					fileName,
					name: fileName,
					mimeType: texture.getMimeType() || 'application/octet-stream',
					byteLength: texture.getImage()?.byteLength ?? 0
				}
			})
	}

	public getTexturePayload(index: number): TextureBinaryPayload {
		const document = this.ensureModelLoaded()
		const textures = document.getRoot().listTextures()
		const texture = textures[index]

		if (!texture) {
			throw new Error(`Texture not found for index ${index}`)
		}

		const image = texture.getImage()
		if (!image || image.byteLength === 0) {
			throw new Error(`Texture at index ${index} has no image payload`)
		}

		return {
			index,
			fileName: this.resolveTextureCanonicalFileName(document, texture, index),
			name: this.resolveTextureCanonicalFileName(document, texture, index),
			mimeType: texture.getMimeType() || 'application/octet-stream',
			image
		}
	}

	public replaceTexturePayload(
		index: number,
		image: Uint8Array,
		mimeType: string,
		fileName?: string
	): void {
		const document = this.ensureModelLoaded()
		const textures = document.getRoot().listTextures()
		const texture = textures[index]

		if (!texture) {
			throw new Error(`Texture not found for index ${index}`)
		}

		texture.setImage(image)
		texture.setMimeType(mimeType)
		this.syncTextureIdentity(document, texture, index, fileName)
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
				this.emitProgress.bind(this),
				(doc) => this.normalizeTextureIdentities(doc),
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
		const ticket = this.claimModel()
		try {
			await this.ensureDracoDecoderRegistered()
			this.adoptLoad(await read(), ticket)
		} catch (error) {
			// A newer model owns the optimizer; this failure is not about it.
			if (ticket.generation !== this.generation) {
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
		this.ensureCurrent(ticket)
		this.settledGeneration = this.generation
		this._document = result.document
		this.originalSize = result.originalSize
		this.originalReport = result.originalReport
		this.sourceBytes = result.sourceBytes
	}

	/**
	 * Normalize all texture URIs and names to canonical form.
	 * Called eagerly after every load path to ensure consistent naming
	 * regardless of how the model was loaded (Three.js, GLB, GLTF JSON).
	 */
	public normalizeAllTextureURIs(doc?: Document): void {
		const target = doc ?? this._document
		if (!target) return
		if (doc) this._document = doc
		this.normalizeTextureIdentities(target)
	}

	/**
	 * The normalization alone, for a document still being loaded: adopting it
	 * here would make it the document before its load is allowed to commit.
	 */
	private normalizeTextureIdentities(doc: Document): void {
		doc
			.getRoot()
			.listTextures()
			.forEach((texture, index) =>
				this.syncTextureIdentity(doc, texture, index)
			)
	}

	/** The ticket for work starting now, refused while a load is pending. */
	private currentTicket(): Ticket {
		if (this.settledGeneration !== this.generation) {
			throw new SupersededError()
		}
		return { generation: this.generation, revision: this.revision }
	}

	/** A new model: everything started on the previous one is moot. */
	private claimModel(): Ticket {
		this.generation += 1
		this.revision += 1
		return { generation: this.generation, revision: this.revision }
	}

	/**
	 * A new document of the same model. Work started on the previous document
	 * is moot, and this claim is itself refused if a newer document or model is
	 * claimed before it commits.
	 */
	private claimDocument(): Ticket {
		const { generation } = this.currentTicket()
		this.revision += 1
		return { generation, revision: this.revision }
	}

	private isCurrent(ticket: Ticket): boolean {
		return (
			ticket.generation === this.generation && ticket.revision === this.revision
		)
	}

	private ensureCurrent(ticket: Ticket): void {
		if (!this.isCurrent(ticket)) throw new SupersededError()
	}

	private resolveTextureCanonicalFileName(
		document: Document,
		texture: {
			getMimeType: () => string | null
		},
		index: number
	): string {
		const textureWithUri = texture as unknown as {
			getURI?: () => string | null
			getName?: () => string | null
		}
		const currentUri = textureWithUri.getURI?.()?.trim() ?? ''
		const currentName = textureWithUri.getName?.()?.trim() ?? ''
		const stableUri =
			currentUri &&
			!currentUri.startsWith('data:') &&
			!isGenericTextureFileName(currentUri)
				? currentUri
				: ''
		const stableName =
			currentName && !isGenericTextureFileName(currentName) ? currentName : ''
		const extension = mimeTypeToExtension(texture.getMimeType() || '')

		// Priority 1: existing stable URI or name
		if (stableUri || stableName) {
			const baseFileName = extractFileNameSegment(stableUri || stableName)
			return extension
				? replaceUriExtension(baseFileName, extension)
				: baseFileName
		}

		// Priority 2: material-slot name (e.g. "Wood_Planks_baseColor.png")
		const slot = resolveTextureByMaterialSlot(
			document,
			texture as unknown as Texture
		)
		if (slot) {
			const slotFileName = `${slot.materialName}_${slot.slotName}`
			return extension ? `${slotFileName}.${extension}` : slotFileName
		}

		// Priority 3: positional fallback
		return buildTextureFallbackFileName(index, texture.getMimeType())
	}

	private syncTextureIdentity(
		document: Document,
		texture: {
			getMimeType: () => string | null
		},
		index: number,
		fileName?: string
	): void {
		const textureWithUri = texture as unknown as {
			getURI?: () => string | null
			setURI?: (value: string) => void
			getName?: () => string | null
			setName?: (value: string) => void
		}
		const currentName = textureWithUri.getName?.()?.trim() ?? ''
		const currentUri = textureWithUri.getURI?.()?.trim() ?? ''
		const preferredFileName = fileName?.trim()
		const preferredIsStable =
			typeof preferredFileName === 'string' &&
			preferredFileName.length > 0 &&
			!isGenericTextureFileName(preferredFileName)

		if (preferredIsStable) {
			const preferredBaseName = extractFileNameSegment(preferredFileName)
			if (textureWithUri.setURI && currentUri !== preferredBaseName) {
				textureWithUri.setURI(preferredBaseName)
			}
			if (textureWithUri.setName && currentName !== preferredBaseName) {
				textureWithUri.setName(preferredBaseName)
			}
		}

		const canonicalFileName = this.resolveTextureCanonicalFileName(
			document,
			texture,
			index
		)

		if (textureWithUri.setURI && currentUri !== canonicalFileName) {
			textureWithUri.setURI(canonicalFileName)
		}

		if (textureWithUri.setName && currentName !== canonicalFileName) {
			textureWithUri.setName(canonicalFileName)
		}
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
		ticket = this.currentTicket()
	): Promise<void> {
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
			this.ensureCurrent(ticket)

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
			if (!this.isCurrent(ticket)) throw new SupersededError({ cause: error })
			throw new Error(`Failed to apply ${operationName}: ${error}`, {
				cause: error
			})
		}
	}

	private emitProgress(
		operation: string,
		progress: number,
		details?: string
	): void {
		if (this.progressCallback) {
			this.progressCallback({ operation, progress, details })
		}
	}
}
