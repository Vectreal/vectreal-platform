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

import { Document, Transform, WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
	cloneDocument,
	dedup,
	DedupOptions as GltfDedupOptions,
	inspect,
	normals,
	NormalsOptions as GltfNormalsOptions,
	quantize,
	QuantizeOptions as GltfQuantizeOptions,
	simplify,
	SimplifyOptions as GltfSimplifyOptions,
	textureCompress,
	weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'

import {
	DedupOptions,
	NormalsOptions,
	OptimizationProgress,
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
	private document: Document | null = null
	private io: WebIO
	private exporter: GLTFExporter
	private originalSize = 0
	private appliedOptimizations: string[] = []
	private progressCallback?: (progress: OptimizationProgress) => void

	constructor() {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
		this.exporter = new GLTFExporter()
	}

	/**
	 * Set a progress callback to receive optimization progress updates.
	 */
	public onProgress(callback: (progress: OptimizationProgress) => void): void {
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
			this.document = await this.io.readBinary(buffer)
			this.originalSize = buffer.byteLength
			this.emitProgress('Model loaded successfully', 100)
		} catch (error) {
			throw new Error(`Failed to load model from buffer: ${error}`)
		}
	}

	/**
	 * Load a model from a file path.
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
			// Dynamic import of Sharp for server environments
			const sharp = await import('sharp')

			const transform = textureCompress({
				encoder: sharp.default,
				targetFormat: options.targetFormat || 'webp',
				quality: options.quality || 80,
				...options
			})

			await this.applyTransforms([transform], 'texture compression')
			this.emitProgress('Texture compression complete', 100)
		} catch (error) {
			throw new Error(
				`Texture compression failed: ${error}. Make sure Sharp is available in server environment.`
			)
		}
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
		this.ensureModelLoaded()

		const report = inspect(this.document!)
		const currentSize = (await this.export()).byteLength

		return {
			originalSize: this.originalSize,
			optimizedSize: currentSize,
			compressionRatio: this.originalSize / currentSize,
			appliedOptimizations: [...this.appliedOptimizations],
			stats: {
				vertices: { before: 0, after: 0 }, // TODO: Extract from report
				triangles: { before: 0, after: 0 },
				materials: { before: 0, after: Object.keys(report.materials).length },
				textures: { before: 0, after: Object.keys(report.textures).length },
				meshes: { before: 0, after: Object.keys(report.meshes).length },
				nodes: {
					before: 0,
					after: (report as any).nodes
						? Object.keys((report as any).nodes).length
						: 0
				}
			}
		}
	}

	/**
	 * Export the optimized model as binary GLB.
	 */
	public async export(): Promise<Uint8Array> {
		this.ensureModelLoaded()
		return await this.io.writeBinary(this.document!)
	}

	/**
	 * Export the optimized model as JSON glTF.
	 */
	public async exportGLTF(): Promise<any> {
		this.ensureModelLoaded()
		return await this.io.writeJSON(this.document!)
	}

	/**
	 * Reset the optimizer state.
	 */
	public reset(): void {
		this.document = null
		this.originalSize = 0
		this.appliedOptimizations = []
	}

	/**
	 * Check if a model is currently loaded.
	 */
	public hasModel(): boolean {
		return this.document !== null
	}

	private ensureModelLoaded(): void {
		if (!this.document) {
			throw new Error(
				'No model loaded. Call loadFromThreeJS(), loadFromBuffer(), or loadFromFile() first.'
			)
		}
	}

	private async applyTransforms(
		transforms: Transform[],
		operationName: string
	): Promise<void> {
		if (!this.document) return

		try {
			// Create a safe copy and get original size before any mutations
			const safeCopyDoc = cloneDocument(this.document)
			const originalSize = (await this.io.writeBinary(safeCopyDoc)).byteLength

			// Create a working copy to apply transforms to
			const workingDoc = cloneDocument(this.document)
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
			this.document = workingDoc
			this.appliedOptimizations.push(operationName)
			console.log(
				`Applied ${operationName}: ${originalSize} → ${newSize} bytes`
			)
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
