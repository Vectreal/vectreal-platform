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

import { OperationProgress } from '../types'
import {
	loadFromThreeJS as _loadFromThreeJS,
	loadFromBuffer as _loadFromBuffer,
	loadFromFile as _loadFromFile,
	loadFromJSON as _loadFromJSON,
	loadFromGLTFWithAssets as _loadFromGLTFWithAssets
} from './model-loading'
import { buildOptimizationReport } from './report-helpers'
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
	NormalsOptions,
	OptimizationReport,
	QuantizeOptions,
	SimplifyOptions,
	TextureBinaryPayload,
	TextureDescriptor,
	TextureCompressOptions
} from './types'

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
	private appliedOptimizations: string[] = []
	private progressCallback?: (progress: OperationProgress) => void

	constructor() {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
		this.exporter = new GLTFExporter()
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
		const result = await _loadFromThreeJS(
			model,
			this.io,
			this.exporter,
			this.emitProgress.bind(this),
			(doc) => this.normalizeAllTextureURIs(doc)
		)
		this._document = result.document
		this.originalSize = result.originalSize
		this.originalReport = result.originalReport
	}

	/**
	 * Load a model from a binary buffer.
	 *
	 * @param buffer - The binary model data (GLB format)
	 */
	public async loadFromBuffer(buffer: Uint8Array): Promise<void> {
		const result = await _loadFromBuffer(
			buffer,
			this.io,
			this.emitProgress.bind(this),
			(doc) => this.normalizeAllTextureURIs(doc)
		)
		this._document = result.document
		this.originalSize = result.originalSize
		this.originalReport = result.originalReport
	}

	/**
	 * Load a glb model model from a file path.
	 *
	 * @param filePath - Path to the model file
	 */
	public async loadFromFile(filePath: string): Promise<void> {
		const result = await _loadFromFile(
			filePath,
			this.io,
			this.emitProgress.bind(this),
			(doc) => this.normalizeAllTextureURIs(doc)
		)
		this._document = result.document
		this.originalSize = result.originalSize
		this.originalReport = result.originalReport
	}

	/**
	 * Load a model from a JSON glTF document.
	 *
	 * @param json - The JSON glTF document
	 */
	public async loadFromJSON(json: JSONDocument): Promise<void> {
		const result = await _loadFromJSON(
			json,
			this.io,
			this.emitProgress.bind(this),
			(doc) => this.normalizeAllTextureURIs(doc),
			() => this.export()
		)
		this._document = result.document
		this.originalSize = result.originalSize
		this.originalReport = result.originalReport
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

		await runTextureCompression(
			document,
			options,
			this.emitProgress.bind(this),
			this.applyTransforms.bind(this)
		)

		this.appliedOptimizations.push('texture compression')
	}

	/**
	 * Apply all standard optimizations in sequence.
	 *
	 * @param options - Combined optimization options
	 */
	public async optimizeAll(
		options: {
			simplify?: SimplifyOptions | false
			dedup?: DedupOptions | false
			quantize?: QuantizeOptions | false
			normals?: NormalsOptions | false
			textures?: TextureCompressOptions
		} = {}
	): Promise<void> {
		this.ensureModelLoaded()

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
		if (options.textures)
			operations.push(() => this.compressTextures(options.textures))

		for (let i = 0; i < operations.length; i++) {
			const progress = Math.round((i / operations.length) * 100)
			this.emitProgress(
				`Running optimization ${i + 1}/${operations.length}`,
				progress
			)
			await operations[i]()
		}

		this.emitProgress('All optimizations complete', 100)
	}

	/**
	 * Get the optimization report with statistics.
	 */
	public async getReport(): Promise<OptimizationReport> {
		const document = this.ensureModelLoaded()
		const currentInspectReport = inspect(document)
		const currentSize = (await this.export()).byteLength

		return buildOptimizationReport(
			this.originalSize,
			currentSize,
			this.originalReport,
			currentInspectReport,
			this.appliedOptimizations
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
		this._document = null
		this.originalSize = 0
		this.originalReport = null
		this.appliedOptimizations = []
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
				const fileName = this.resolveTextureCanonicalFileName(texture, index)

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
			fileName: this.resolveTextureCanonicalFileName(texture, index),
			name: this.resolveTextureCanonicalFileName(texture, index),
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
		this.syncTextureIdentity(texture, index, fileName)
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
		const result = await _loadFromGLTFWithAssets(
			gltfBytes,
			assets,
			this.io,
			this.emitProgress.bind(this),
			(doc) => this.normalizeAllTextureURIs(doc),
			() => this.export()
		)
		this._document = result.document
		this.originalSize = result.originalSize
		this.originalReport = result.originalReport
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
		const textures = target.getRoot().listTextures()
		textures.forEach((texture, index) => {
			this.syncTextureIdentity(texture, index)
		})
	}

	private resolveTextureCanonicalFileName(
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
		if (this._document) {
			const slot = resolveTextureByMaterialSlot(
				this._document,
				texture as unknown as Texture
			)
			if (slot) {
				const slotFileName = `${slot.materialName}_${slot.slotName}`
				return extension ? `${slotFileName}.${extension}` : slotFileName
			}
		}

		// Priority 3: positional fallback
		return buildTextureFallbackFileName(index, texture.getMimeType())
	}

	private syncTextureIdentity(
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

	public ensureModelLoaded(): Document {
		if (!this._document) {
			throw new Error(
				'No model loaded. Call loadFromThreeJS(), loadFromBuffer(), or loadFromFile() first.'
			)
		}

		return this._document
	}

	get document() {
		return this.ensureModelLoaded()
	}

	private async applyTransforms(
		transforms: Transform[],
		operationName: string
	): Promise<void> {
		if (!this._document) return

		try {
			// Create a safe copy and get original size before any mutations
			const safeCopyDoc = cloneDocument(this._document)
			const originalSize = (await this.io.writeBinary(safeCopyDoc)).byteLength

			// Create a working copy to apply transforms to
			const workingDoc = cloneDocument(this._document)
			await workingDoc.transform(...transforms)

			// Check if transformation resulted in a model with increased size
			const newSize = (await this.io.writeBinary(workingDoc)).byteLength

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
