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

import { Document } from '@gltf-transform/core'
import { Object3D } from 'three'

import { ModelExporter, ExportResult, ExportOptions } from './model-exporter'
import { ModelLoader, ModelLoadResult, LoadProgress } from './model-loader'
import {
	ModelOptimizer,
	OptimizationProgress,
	OptimizationReport
} from './model-optimizer'

export interface ModelProcessingProgress {
	stage: 'loading' | 'optimizing' | 'exporting'
	operation: string
	progress: number
	details?: string
}

/**
 * Unified server-side 3D model processing service.
 *
 * This class combines loading, optimization, and export capabilities
 * into a single convenient interface for server-side model processing.
 */
export class ModelProcessingService {
	private loader: ModelLoader
	private optimizer: ModelOptimizer
	private exporter: ModelExporter
	private progressCallback?: (progress: ModelProcessingProgress) => void

	constructor() {
		this.loader = new ModelLoader()
		this.optimizer = new ModelOptimizer()
		this.exporter = new ModelExporter()

		// Set up progress forwarding
		this.loader.onProgress((progress: LoadProgress) => {
			this.emitProgress(
				'loading',
				progress.operation,
				progress.progress,
				progress.details
			)
		})

		this.optimizer.onProgress((progress: OptimizationProgress) => {
			this.emitProgress(
				'optimizing',
				progress.operation,
				progress.progress,
				progress.details
			)
		})

		this.exporter.onProgress((progress) => {
			this.emitProgress(
				'exporting',
				progress.operation,
				progress.progress,
				progress.details
			)
		})
	}

	/**
	 * Set a progress callback to receive processing progress updates.
	 */
	public onProgress(
		callback: (progress: ModelProcessingProgress) => void
	): void {
		this.progressCallback = callback
	}

	/**
	 * Complete model processing pipeline: load → optimize → export.
	 *
	 * @param input - File path, buffer, or Three.js object
	 * @param optimizationOptions - Optimization settings
	 * @param exportOptions - Export settings
	 * @returns Promise resolving to the export result
	 */
	public async processModel(
		input: string | { buffer: Uint8Array; fileName: string } | Object3D,
		optimizationOptions: {
			simplify?: { ratio?: number; error?: number } | false
			dedup?: boolean | false
			quantize?: boolean | false
			normals?: boolean | false
			textures?:
				| { quality?: number; targetFormat?: 'webp' | 'jpeg' | 'png' }
				| false
		} = {},
		exportOptions: ExportOptions & { format?: 'glb' | 'gltf' } = {
			format: 'glb'
		}
	): Promise<ExportResult> {
		// Step 1: Load the model
		let document: Document

		if (typeof input === 'string') {
			// Load from file path
			const loadResult = await this.loader.loadFromFile(input)
			document = loadResult.data
		} else if ('buffer' in input) {
			// Load from buffer
			const loadResult = await this.loader.loadFromBuffer(
				input.buffer,
				input.fileName
			)
			document = loadResult.data
		} else {
			// Load from Three.js object
			await this.optimizer.loadFromThreeJS(input)
			document = await this.getOptimizerDocument()
		}

		// Step 2: Apply optimizations if not loaded from Three.js
		if (typeof input === 'string' || 'buffer' in input) {
			// Load into optimizer
			const buffer = await this.exporter.exportDocumentGLB(document)
			await this.optimizer.loadFromBuffer(buffer.data as Uint8Array)
		}

		// Apply specific optimizations
		if (optimizationOptions.simplify !== false) {
			await this.optimizer.simplify(optimizationOptions.simplify || {})
		}
		if (optimizationOptions.dedup !== false) {
			await this.optimizer.deduplicate()
		}
		if (optimizationOptions.quantize !== false) {
			await this.optimizer.quantize()
		}
		if (optimizationOptions.normals !== false) {
			await this.optimizer.optimizeNormals()
		}
		if (optimizationOptions.textures) {
			await this.optimizer.compressTextures(optimizationOptions.textures)
		}

		// Step 3: Export the optimized model
		const optimizedDocument = await this.getOptimizerDocument()

		if (exportOptions.format === 'gltf') {
			return await this.exporter.exportDocumentGLTF(
				optimizedDocument,
				exportOptions
			)
		} else {
			return await this.exporter.exportDocumentGLB(
				optimizedDocument,
				exportOptions
			)
		}
	}

	/**
	 * Load a model only.
	 */
	public async loadModel(
		input: string | { buffer: Uint8Array; fileName: string }
	): Promise<ModelLoadResult> {
		if (typeof input === 'string') {
			return await this.loader.loadFromFile(input)
		} else {
			return await this.loader.loadFromBuffer(input.buffer, input.fileName)
		}
	}

	/**
	 * Optimize a loaded model.
	 */
	public async optimizeModel(
		document: Document,
		options: Parameters<ModelOptimizer['optimizeAll']>[0] = {}
	): Promise<void> {
		// Load document into optimizer
		const buffer = await this.exporter.exportDocumentGLB(document)
		await this.optimizer.loadFromBuffer(buffer.data as Uint8Array)

		// Apply optimizations
		await this.optimizer.optimizeAll(options)
	}

	/**
	 * Export a model document.
	 */
	public async exportModel(
		document: Document,
		options: ExportOptions & { format?: 'glb' | 'gltf' } = { format: 'glb' }
	): Promise<ExportResult> {
		if (options.format === 'gltf') {
			return await this.exporter.exportDocumentGLTF(document, options)
		} else {
			return await this.exporter.exportDocumentGLB(document, options)
		}
	}

	/**
	 * Get optimization report.
	 */
	public async getOptimizationReport(): Promise<OptimizationReport> {
		return await this.optimizer.getReport()
	}

	/**
	 * Reset all services.
	 */
	public reset(): void {
		this.optimizer.reset()
	}

	/**
	 * Access individual services for advanced usage.
	 */
	public get services() {
		return {
			loader: this.loader,
			optimizer: this.optimizer,
			exporter: this.exporter
		}
	}

	private async getOptimizerDocument(): Promise<Document> {
		// Export from optimizer and re-import to get Document
		const buffer = await this.optimizer.export()
		const result = await this.loader.loadFromBuffer(buffer, 'optimized.glb')
		return result.data
	}

	private emitProgress(
		stage: ModelProcessingProgress['stage'],
		operation: string,
		progress: number,
		details?: string
	): void {
		if (this.progressCallback) {
			this.progressCallback({ stage, operation, progress, details })
		}
	}
}

// Export the service as default
export default ModelProcessingService
