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
	compressTexture,
	dedup,
	DedupOptions as GltfDedupOptions,
	NormalsOptions as GltfNormalsOptions,
	QuantizeOptions as GltfQuantizeOptions,
	inspect,
	InspectReport,
	normals,
	quantize,
	simplify,
	weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

import { OperationProgress } from '../types'

import {
	DedupOptions,
	NormalsOptions,
	OptimizationReport,
	QuantizeOptions,
	SimplifyOptions,
	TextureCompressOptions
} from './types'

/**
 * Server-side 3D model optimization service using glTF-Transform.
 *
 * This class provides comprehensive model optimization capabilities including:
 * - Mesh simplification
 * - Deduplication
 * - Quantization
 * - Normal optimization
 * - Texture compression
 *
 * Designed for Node.js server environments with full Sharp support.
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
		this.emitProgress('Loading model from Three.js object', 0)

		try {
			const parseOptions = { binary: true }
			const binary = await this.exporter.parseAsync(model, parseOptions)
			const modelBuffer = new Uint8Array(binary as ArrayBuffer)

			await this.loadFromBuffer(modelBuffer)
			this.emitProgress('Model loaded successfully', 100)
		} catch (error) {
			throw new Error(`Failed to load Three.js model: ${error}`)
		}
	}

	/**
	 * Load a model from a binary buffer.
	 *
	 * @param buffer - The binary model data (GLB format)
	 */
	public async loadFromBuffer(buffer: Uint8Array): Promise<void> {
		this.emitProgress('Loading model from buffer', 0)

		try {
			// Basic validation before attempting to load
			if (buffer.byteLength === 0) {
				throw new Error('Buffer is empty')
			}

			// Check for GLB magic number
			const magicBytes = buffer.slice(0, 4)
			const magic = String.fromCharCode(...magicBytes)

			if (magic !== 'glTF') {
				console.error('Invalid buffer format:', {
					byteLength: buffer.byteLength,
					firstBytes: Array.from(buffer.slice(0, 16)),
					magicString: magic
				})
				throw new Error(
					`Invalid glTF 2.0 binary. Expected 'glTF' magic bytes, got '${magic}'`
				)
			}

			this._document = await this.io.readBinary(buffer)
			this.originalSize = buffer.byteLength
			// Capture original report for comparison
			this.originalReport = inspect(this._document)
			this.emitProgress('Model loaded successfully', 100)
		} catch (error) {
			throw new Error(`Failed to load model from buffer: ${error}`)
		}
	}

	/**
	 * Load a glb model model from a file path.
	 *
	 * @param filePath - Path to the model file
	 */
	public async loadFromFile(filePath: string): Promise<void> {
		this.emitProgress('Loading model from file', 0)

		try {
			// This would require fs in Node.js environment
			const fs = await import('fs/promises')
			const buffer = await fs.readFile(filePath)
			await this.loadFromBuffer(new Uint8Array(buffer))
		} catch (error) {
			throw new Error(`Failed to load model from file: ${error}`)
		}
	}

	/**
	 * Load a model from a JSON glTF document.
	 *
	 * @param json - The JSON glTF document
	 */
	public async loadFromJSON(json: JSONDocument): Promise<void> {
		this.emitProgress('Loading model from JSON document', 0)

		try {
			this._document = await this.io.readJSON(json)
			const binary = await this.export()
			this.originalSize = binary.byteLength
		} catch (error) {
			throw new Error(`Failed to load model from JSON document: ${error}`)
		}
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
	 * Apply texture compression optimization using Sharp.
	 *
	 * @param options - Texture compression options
	 */
	public async compressTextures(
		options: TextureCompressOptions = {}
	): Promise<void> {
		this.ensureModelLoaded()

		this.emitProgress('Compressing textures', 0)

		try {
			// Import Sharp for server-side texture processing
			const sharpModule = await import('sharp')
			const sharp = sharpModule.default || sharpModule

			if (typeof sharp !== 'function') {
				throw new Error('Sharp is not available or not properly installed')
			}

			// Extract only the options that textureCompress expects
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { serverOptions, ...textureCompressOptions } = options

			console.log('Texture compression options:', {
				targetFormat: textureCompressOptions.targetFormat,
				quality: textureCompressOptions.quality,
				resize: textureCompressOptions.resize,
				sharpAvailable: typeof sharp === 'function'
			})

			// Log texture info before compression
			console.log('Before texture compression:')
			if (!this._document) {
				throw new Error('Document is not loaded')
			}
			const textures = this._document.getRoot().listTextures()
			textures.forEach((texture, i) => {
				console.log(
					`Texture ${i}: ${texture.getMimeType() || 'unknown mime type'}`
				)
			})

			// Apply compression to each texture individually
			console.log('Compressing textures individually...')
			for (let i = 0; i < textures?.length; i++) {
				const texture = textures[i]
				console.log(`Processing texture ${i}/${textures.length}`)

				try {
					await compressTexture(texture, {
						encoder: sharp,
						targetFormat: textureCompressOptions.targetFormat,
						quality: textureCompressOptions.quality,
						resize: textureCompressOptions.resize
					})
					console.log(
						`Texture ${i} compressed successfully to ${texture.getMimeType()}`
					)
				} catch (error) {
					console.warn(`Failed to compress texture ${i}:`, error)
				}
			}

			console.log('All textures processed')
			this.appliedOptimizations.push('texture compression')

			// Log texture info after compression
			console.log('After texture compression:')
			textures.forEach((texture, i) => {
				console.log(
					`Texture ${i}: ${texture.getMimeType() || 'unknown mime type'}`
				)
			})

			this.emitProgress('Texture compression complete', 100)
		} catch (error) {
			// If Sharp fails, try basic texture optimization
			console.warn(
				'Sharp-based compression failed, applying basic optimization:',
				error
			)
			await this.applyBasicTextureOptimization(options)
		}
	}

	/**
	 * Apply basic texture optimization without Sharp.
	 * This provides fallback functionality when Sharp is not available.
	 */
	private async applyBasicTextureOptimization(
		options: TextureCompressOptions
	): Promise<void> {
		this.emitProgress('Applying basic texture optimization', 50)

		// Import basic texture optimization transforms that don't require Sharp
		const { dedup, prune } = await import('@gltf-transform/functions')

		const transforms = [
			dedup(), // Remove duplicate resources including textures
			prune() // Remove unused resources including textures
		]

		await this.applyTransforms(transforms, 'basic texture optimization')

		console.warn(
			'Applied basic texture optimization only. ' +
				'For advanced compression (WebP, JPEG conversion), ensure Sharp is properly configured.'
		)

		this.emitProgress('Basic texture optimization complete', 100)
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

		// Helper function to calculate vertex and primitive counts from inspect report
		const calculateCounts = (inspectReport: InspectReport) => {
			let vertices = 0
			let primitives = 0

			if (inspectReport.meshes && inspectReport.meshes.properties) {
				inspectReport.meshes.properties.forEach((mesh) => {
					vertices += mesh.vertices || 0
					primitives += mesh.glPrimitives || 0
				})
			}

			return { vertices, primitives }
		}

		// Helper function to calculate texture memory usage in bytes
		const calculateTextureSize = (inspectReport: InspectReport) => {
			let totalSize = 0
			if (inspectReport.textures && inspectReport.textures.properties) {
				inspectReport.textures.properties.forEach((texture) => {
					// Use the actual size property if available, otherwise use gpuSize
					totalSize += texture.size || texture.gpuSize || 0
				})
			}
			return totalSize
		}

		// Helper function to calculate mesh memory usage in bytes
		const calculateMeshSize = (inspectReport: InspectReport) => {
			let totalSize = 0
			if (inspectReport.meshes && inspectReport.meshes.properties) {
				inspectReport.meshes.properties.forEach((mesh) => {
					// Use the actual size property from the mesh report
					totalSize += mesh.size || 0
				})
			}
			return totalSize
		}

		const originalCounts = this.originalReport
			? calculateCounts(this.originalReport)
			: { vertices: 0, primitives: 0 }
		const currentCounts = calculateCounts(currentInspectReport)

		const originalTextureSize = this.originalReport
			? calculateTextureSize(this.originalReport)
			: 0
		const currentTextureSize = calculateTextureSize(currentInspectReport)

		const originalMeshSize = this.originalReport
			? calculateMeshSize(this.originalReport)
			: 0
		const currentMeshSize = calculateMeshSize(currentInspectReport)

		return {
			originalSize: this.originalSize,
			optimizedSize: currentSize,
			compressionRatio: this.originalSize / currentSize,
			appliedOptimizations: [...this.appliedOptimizations],
			stats: {
				vertices: {
					before: originalCounts.vertices,
					after: currentCounts.vertices
				},
				triangles: {
					before: originalCounts.primitives,
					after: currentCounts.primitives
				},
				materials: {
					before: this.originalReport?.materials?.properties
						? this.originalReport.materials.properties.length
						: 0,
					after: currentInspectReport.materials?.properties
						? currentInspectReport.materials.properties.length
						: 0
				},
				textures: {
					before: originalTextureSize,
					after: currentTextureSize
				},
				meshes: {
					before: originalMeshSize,
					after: currentMeshSize
				},
				nodes: {
					before: 0, // Node count not available in inspect report
					after: 0 // Node count not available in inspect report
				}
			}
		}
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
			throw new Error(`Failed to apply ${operationName}: ${error}`)
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
