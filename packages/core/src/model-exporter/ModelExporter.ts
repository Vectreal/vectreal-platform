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

import { Document, WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import JSZip from 'jszip'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'

import { ExportOptions, ExportProgress, ExportResult } from './types'

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
	private progressCallback?: (progress: ExportProgress) => void

	constructor() {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
		this.threeExporter = new GLTFExporter()
	}

	/**
	 * Set a progress callback to receive export progress updates.
	 */
	public onProgress(callback: (progress: ExportProgress) => void): void {
		this.progressCallback = callback
	}

	/**
	 * Export a glTF-Transform document as GLB binary.
	 *
	 * @param document - The glTF-Transform document
	 * @param options - Export options
	 * @returns Promise resolving to the export result
	 */
	public async exportDocumentGLB(
		document: Document,
		options: ExportOptions = {}
	): Promise<ExportResult> {
		const startTime = Date.now()
		this.emitProgress('Exporting to GLB format', 0)

		try {
			this.emitProgress('Serializing document', 50)
			const buffer = await this.io.writeBinary(document)

			const exportTime = Date.now() - startTime
			this.emitProgress('Export completed', 100)

			return {
				data: buffer,
				format: 'glb',
				size: buffer.byteLength,
				exportTime
			}
		} catch (error) {
			throw new Error(`Failed to export GLB: ${error}`)
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
		document: Document,
		options: ExportOptions = {}
	): Promise<ExportResult> {
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
			throw new Error(`Failed to export GLTF: ${error}`)
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
		options: ExportOptions = {}
	): Promise<ExportResult> {
		const startTime = Date.now()
		this.emitProgress('Exporting Three.js object to GLB', 0)

		return new Promise((resolve, reject) => {
			this.emitProgress('Parsing Three.js scene', 50)

			this.threeExporter.parse(
				object,
				(result: ArrayBuffer | any) => {
					if (result instanceof ArrayBuffer) {
						const exportTime = Date.now() - startTime
						this.emitProgress('Export completed', 100)

						resolve({
							data: new Uint8Array(result),
							format: 'glb',
							size: result.byteLength,
							exportTime
						})
					} else {
						reject(
							new Error('Expected ArrayBuffer but received different type')
						)
					}
				},
				(error) => {
					reject(new Error(`Failed to export Three.js object: ${error}`))
				},
				{
					binary: true,
					includeCustomExtensions: options.includeCustomExtensions ?? true
				}
			)
		})
	}

	/**
	 * Export a Three.js Object3D as GLTF JSON with separate assets.
	 *
	 * @param object - The Three.js Object3D
	 * @param options - Export options
	 * @returns Promise resolving to the export result
	 */
	public async exportThreeJSGLTF(
		object: Object3D,
		options: ExportOptions = {}
	): Promise<ExportResult> {
		const startTime = Date.now()
		this.emitProgress('Exporting Three.js object to GLTF', 0)

		return new Promise((resolve, reject) => {
			this.emitProgress('Parsing Three.js scene', 25)

			this.threeExporter.parse(
				object,
				(result: any) => {
					this.emitProgress('Processing assets', 75)

					const assets = new Map<string, Uint8Array>()

					// Handle buffers
					if (result.buffers) {
						result.buffers.forEach((buffer: ArrayBuffer, index: number) => {
							const name = `buffer_${index}.bin`
							assets.set(name, new Uint8Array(buffer))
						})
					}

					// Handle images
					if (result.images) {
						result.images.forEach((image: any, index: number) => {
							if (image.blob) {
								// Convert blob to buffer (this is a simplified approach)
								const name = `image_${index}.${image.mimeType?.split('/')[1] || 'png'}`
								// Note: In a real implementation, you'd need to convert the blob properly
								assets.set(name, new Uint8Array())
							}
						})
					}

					const jsonSize = new TextEncoder().encode(
						JSON.stringify(result)
					).byteLength
					const assetsSize = Array.from(assets.values()).reduce(
						(sum, asset) => sum + asset.byteLength,
						0
					)

					const exportTime = Date.now() - startTime
					this.emitProgress('Export completed', 100)

					resolve({
						data: result,
						format: 'gltf',
						size: jsonSize + assetsSize,
						exportTime,
						assets
					})
				},
				(error) => {
					reject(new Error(`Failed to export Three.js object: ${error}`))
				},
				{
					binary: false,
					includeCustomExtensions: options.includeCustomExtensions ?? true
				}
			)
		})
	}

	/**
	 * Create a ZIP archive from GLTF export result.
	 *
	 * @param result - The GLTF export result
	 * @param baseName - Base name for files
	 * @returns Promise resolving to ZIP buffer
	 */
	public async createZIPArchive(
		result: ExportResult,
		baseName: string = 'model'
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

			result.assets.forEach((data, name) => {
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
			throw new Error(`Failed to save file: ${error}`)
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
