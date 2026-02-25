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

import { Document, GLTF, WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import JSZip from 'jszip'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

import { OperationProgress } from '../types'
import {
	ExportOptions,
	ExportResult,
	GLBExportResult,
	GLTFExportResult
} from './types'

/**
 * Server-side 3D model export service.
 *
 * This class provides comprehensive model export capabilities for:
 * - GLB (binary) format
 * - GLTF (JSON + assets) format
 * - ZIP archives with multiple files
 *
 * Designed for Node.js server environments.
 */
export class ModelExporter {
	private io: WebIO
	private threeExporter: GLTFExporter
	private progressCallback?: (progress: OperationProgress) => void

	constructor() {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
		this.threeExporter = new GLTFExporter()
	}

	/**
	 * Set a progress callback to receive export progress updates.
	 */
	public onProgress(callback: (progress: OperationProgress) => void): void {
		this.progressCallback = callback
	}

	/**
	 * Export a glTF-Transform document as GLB binary.
	 *
	 * @param document - The glTF-Transform document
	 * @param options - Export options
	 * @returns Promise resolving to the export result
	 */
	public async exportDocumentGLB(document: Document): Promise<GLBExportResult> {
		const startTime = Date.now()
		this.emitProgress('Exporting to GLB format', 0)

		try {
			this.emitProgress('Serializing document', 50)
			const binaryDoc = await this.io.writeBinary(document)

			this.emitProgress('Finalizing export', 90)
			const buffer = binaryDoc as Uint8Array

			const exportTime = Date.now() - startTime
			this.emitProgress('Export completed', 100)

			return {
				data: buffer,
				format: 'glb',
				size: buffer.byteLength,
				exportTime
			}
		} catch (error) {
			throw new Error(`Failed to export GLB: ${error}`, { cause: error })
		}
	}

	/**
	 * Export a glTF-Transform document as GLTF JSON with separate assets.
	 *
	 * @param document - The glTF-Transform document
	 * @param options - Export options
	 * @returns Promise resolving to the export result
	 */
	public async exportDocumentGLTF(
		document: Document
	): Promise<GLTFExportResult> {
		const startTime = Date.now()
		this.emitProgress('Exporting to GLTF format', 0)

		try {
			this.emitProgress('Serializing document', 25)
			const jsonDoc = await this.io.writeJSON(document)

			this.emitProgress('Processing assets', 75)
			const assets = new Map<string, Uint8Array>()

			// Extract resources (buffers, images)
			if (jsonDoc.resources) {
				Object.entries(jsonDoc.resources).forEach(([name, data]) => {
					if (name !== 'model.gltf') {
						console.log('Adding asset:', name)
						assets.set(name, data as Uint8Array)
					}
				})
			}

			// Calculate total size
			const jsonSize = new TextEncoder().encode(
				JSON.stringify(jsonDoc.json)
			).byteLength
			const assetsSize = Array.from(assets.values()).reduce(
				(sum, asset) => sum + asset.byteLength,
				0
			)

			const exportTime = Date.now() - startTime
			this.emitProgress('Export completed', 100)

			return {
				data: jsonDoc.json,
				format: 'gltf',
				size: jsonSize + assetsSize,
				exportTime,
				assets
			}
		} catch (error) {
			throw new Error(`Failed to export GLTF: ${error}`, { cause: error })
		}
	}

	/**
	 * Export a Three.js Object3D as GLB binary.
	 *
	 * @param object - The Three.js Object3D
	 * @param options - Export options
	 * @returns Promise resolving to the export result
	 */
	public async exportThreeJSGLB(
		object: Object3D,
		options: ExportOptions
	): Promise<GLBExportResult> {
		this.emitProgress('Exporting Three.js object to GLB', 0)
		try {
			const result = (await this.threeExporter.parseAsync(object, {
				binary: false
			})) as unknown as GLTF.IGLTF

			console.log('GLB export result:', result)

			const textureReplacement = options.modifiedTextureResources || {
				images: [],
				textures: []
			}

			// Replace image URIs with optimized base64 data URLs
			Object.entries(textureReplacement).forEach(([key, items]) => {
				if (key === 'images') {
					const images = items as GLTF.IImage[]

					result.images = images
				}

				if (key === 'textures') {
					const textures = items as GLTF.ITexture[]
					textures.forEach((item, index) => {
						const image = textureReplacement.images.find(
							(img) => img.name === item.name
						)
						if (image) {
							textureReplacement.textures[index] = {
								...item,
								source: textureReplacement.images.indexOf(image)
							}
						}
					})
				}
			})

			// Re-export document (placeholder - adjust as needed to inject modified images)
			return await this.exportDocumentGLB(
				await this.io.readBinary(new Uint8Array())
			)
		} catch (error) {
			throw new Error(`Failed to export Three.js object: ${error}`, {
				cause: error
			})
		}
	}

	/**
	 * Export a Three.js Object3D as GLTF JSON with separate assets.
	 *
	 * @note The way Three.js exports GLTF resources is limited to png image textures
	 *
	 * @param object - The Three.js Object3D
	 * @returns Promise resolving to the export result
	 */
	public async exportThreeJSGLTF(object: Object3D): Promise<GLTFExportResult> {
		this.emitProgress('Exporting Three.js object to GLTF', 0)
		try {
			const result = await this.threeExporter.parseAsync(object, {
				binary: true
			})

			console.log('GLB export result:', result)

			// const textures =

			return await this.exportDocumentGLTF(
				await this.io.readBinary(new Uint8Array(result as ArrayBuffer))
			)
		} catch (error) {
			throw new Error(`Failed to export Three.js object: ${error}`, {
				cause: error
			})
		}
	}

	/**
	 * Create a ZIP archive from GLTF export result.
	 *
	 * @param result - The GLTF export result
	 * @param baseName - Base name for files
	 * @returns Promise resolving to ZIP buffer
	 */
	public async createZIPArchive(
		result: GLTFExportResult,
		baseName = 'model'
	): Promise<Uint8Array> {
		if (result.format !== 'gltf') {
			throw new Error('ZIP archive can only be created from GLTF exports')
		}

		this.emitProgress('Creating ZIP archive', 0)

		const zip = new JSZip()

		// Add main GLTF file
		zip.file(`${baseName}.gltf`, JSON.stringify(result.data, null, 2))

		// Add assets
		if (result.assets) {
			let processed = 0
			const total = result.assets.size

			result.assets.forEach((data: Uint8Array, name: string) => {
				zip.file(name, data)
				processed++
				this.emitProgress(
					'Adding assets to ZIP',
					Math.round((processed / total) * 80) + 10
				)
			})
		}

		this.emitProgress('Generating ZIP file', 90)
		const blob = await zip.generateAsync({ type: 'uint8array' })
		this.emitProgress('ZIP archive created', 100)

		return blob
	}

	/**
	 * Save export result to file system (Node.js only).
	 *
	 * @param result - The export result
	 * @param filePath - Target file path
	 */
	public async saveToFile(
		result: ExportResult,
		filePath: string
	): Promise<void> {
		try {
			const fs = await import('fs/promises')
			const path = await import('path')

			this.emitProgress('Saving to file system', 0)

			if (result.format === 'glb') {
				// Save GLB file
				await fs.writeFile(filePath, result.data as Uint8Array)
			} else {
				// Save GLTF with assets
				const dir = path.dirname(filePath)
				const baseName = path.basename(filePath, path.extname(filePath))

				// Create directory if it doesn't exist
				await fs.mkdir(dir, { recursive: true })

				// Save main GLTF file
				await fs.writeFile(
					path.join(dir, `${baseName}.gltf`),
					JSON.stringify(result.data, null, 2)
				)

				// Save assets
				if (result.assets) {
					let processed = 0
					const total = result.assets.size

					for (const [name, data] of result.assets) {
						await fs.writeFile(path.join(dir, name), data)
						processed++
						this.emitProgress(
							'Saving assets',
							Math.round((processed / total) * 100)
						)
					}
				}
			}

			this.emitProgress('File saved successfully', 100)
		} catch (error) {
			throw new Error(`Failed to save file: ${error}`, { cause: error })
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
