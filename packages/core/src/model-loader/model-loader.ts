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

import { OperationProgress } from '../types'

import { ModelFileTypes, ModelLoadResult, ThreeJSModelResult } from './types'

/**
 * Universal 3D model loader service.
 *
 * This class provides comprehensive model loading capabilities for:
 * - GLTF files
 * - GLB files
 * - USDZ files (basic support)
 *
 * Designed for both Node.js server and browser environments.
 */
export class ModelLoader {
	private io: WebIO
	private progressCallback?: (progress: OperationProgress) => void

	constructor() {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
	}

	/**
	 * Set a progress callback to receive loading progress updates.
	 */
	public onProgress(callback: (progress: OperationProgress) => void): void {
		this.progressCallback = callback
	}

	/**
	 * Load a model from a file path (Node.js) or File object (browser).
	 */
	public async loadFromFile(input: string | File): Promise<ModelLoadResult> {
		if (typeof input === 'string') {
			return this.loadFromFilePath(input)
		} else {
			return this.loadFromFileObject(input)
		}
	}

	/**
	 * Load a model from a file path (Node.js environment).
	 *
	 * @param filePath - Path to the model file
	 * @returns Promise resolving to the loaded model result
	 */
	private async loadFromFilePath(filePath: string): Promise<ModelLoadResult> {
		const startTime = Date.now()
		this.emitProgress('Loading model from file', 0, filePath)

		try {
			// Import fs in Node.js environment
			const fs = await import('fs/promises')
			const path = await import('path')

			const buffer = await fs.readFile(filePath)
			const fileName = path.basename(filePath)
			const fileType = this.getFileType(fileName)

			this.emitProgress('Parsing model data', 50)

			const document = await this.io.readBinary(new Uint8Array(buffer))
			const loadTime = Date.now() - startTime

			this.emitProgress('Model loaded successfully', 100)

			return {
				data: document,
				type: fileType,
				size: buffer.byteLength,
				name: fileName,
				loadTime
			}
		} catch (error) {
			throw new Error(`Failed to load model from file ${filePath}: ${error}`)
		}
	}

	/**
	 * Load a model from a File object (browser environment).
	 *
	 * @param file - The File object to load
	 * @returns Promise resolving to the loaded model result
	 */
	private async loadFromFileObject(file: File): Promise<ModelLoadResult> {
		const startTime = Date.now()
		this.emitProgress('Loading model from File object', 0, file.name)

		try {
			const fileType = this.getFileType(file.name)
			const buffer = await file.arrayBuffer()

			this.emitProgress('Parsing model data', 50)

			const document = await this.io.readBinary(new Uint8Array(buffer))
			const loadTime = Date.now() - startTime

			this.emitProgress('Model loaded successfully', 100)

			return {
				data: document,
				type: fileType,
				size: buffer.byteLength,
				name: file.name,
				loadTime
			}
		} catch (error) {
			throw new Error(`Failed to load model from File object: ${error}`)
		}
	}

	/**
	 * Load a model from a binary buffer.
	 *
	 * @param buffer - The binary model data
	 * @param fileName - Original file name
	 * @returns Promise resolving to the loaded model result
	 */
	public async loadFromBuffer(
		buffer: Uint8Array,
		fileName: string
	): Promise<ModelLoadResult> {
		const startTime = Date.now()
		this.emitProgress('Loading model from buffer', 0)

		try {
			const fileType = this.getFileType(fileName)

			this.emitProgress('Parsing model data', 50)

			const document = await this.io.readBinary(buffer)
			const loadTime = Date.now() - startTime

			this.emitProgress('Model loaded successfully', 100)

			return {
				data: document,
				type: fileType,
				size: buffer.byteLength,
				name: fileName,
				loadTime
			}
		} catch (error) {
			throw new Error(`Failed to load model from buffer: ${error}`)
		}
	}

	/**
	 * Load GLTF model with additional assets.
	 *
	 * @param gltfBuffer - The GLTF JSON data
	 * @param assets - Additional asset files (textures, buffers)
	 * @param fileName - Original file name
	 * @param isNestedCall - Internal flag to prevent progress reset when called from loadGLTFWithFileAssets
	 * @returns Promise resolving to the loaded model result
	 */
	public async loadGLTFWithAssets(
		gltfBuffer: Uint8Array,
		assets: Map<string, Uint8Array>,
		fileName: string,
		isNestedCall = false
	): Promise<ModelLoadResult> {
		const startTime = Date.now()

		// Only emit starting progress if this is a direct call (not nested from loadGLTFWithFileAssets)
		if (!isNestedCall) {
			this.emitProgress('Loading GLTF with assets', 0)
		}

		try {
			// Convert buffer to JSON
			const gltfJson: GLTF.IGLTF = JSON.parse(
				new TextDecoder().decode(gltfBuffer)
			)

			// Adjust progress based on whether this is a nested call
			// If nested: we're already at 50%, so use 50-100 range
			// If direct: use 0-100 range
			const progressOffset = isNestedCall ? 50 : 0
			const progressScale = isNestedCall ? 0.5 : 1

			this.emitProgress(
				'Processing assets',
				progressOffset + 25 * progressScale
			)

			// Validate that referenced images exist in assets
			if (gltfJson.images) {
				const missingImages: string[] = []

				gltfJson.images.forEach((image, index: number) => {
					// Check if image has a URI reference
					if (image.uri) {
						const imageName = decodeURIComponent(image.uri)
						const basename = imageName.split('/').pop() || imageName

						// Check multiple possible asset key variations
						const hasAsset =
							assets.has(imageName) ||
							assets.has(basename) ||
							assets.has(image.uri) ||
							assets.has(imageName.replace(/^\.\//, '')) || // Remove ./ prefix
							assets.has(basename.replace(/^\.\//, ''))

						if (!hasAsset) {
							missingImages.push(`Image ${index}: ${imageName}`)
						}
					} else if (
						typeof image.bufferView !== 'number' ||
						image.bufferView < 0
					) {
						// Image must have either a URI or a valid bufferView index (>= 0)
						missingImages.push(`Image ${index}: (no URI or bufferView)`)
					}
				})

				if (missingImages.length > 0) {
					const availableAssets = Array.from(assets.keys()).join(', ')
					throw new Error(
						`Missing required image files:\n${missingImages.join('\n')}\n\nAvailable assets: ${availableAssets || '(none)'}`
					)
				}
			}

			// Create resource map for glTF-Transform
			const resources: { [key: string]: Uint8Array } = {}

			// Add main GLTF file
			resources['model.gltf'] = gltfBuffer

			// Build a comprehensive resource map based on what the GLTF actually references
			// First, collect all URI references from the GLTF
			const referencedUris = new Set<string>()

			// Collect image URIs
			if (gltfJson.images) {
				gltfJson.images.forEach((image) => {
					if (image.uri) {
						referencedUris.add(image.uri)
						// Also add decoded version
						referencedUris.add(decodeURIComponent(image.uri))
					}
				})
			}

			// Collect buffer URIs (for .bin files)
			if (gltfJson.buffers) {
				gltfJson.buffers.forEach((buffer) => {
					if (buffer.uri) {
						referencedUris.add(buffer.uri)
						referencedUris.add(decodeURIComponent(buffer.uri))
					}
				})
			}

			// Now map each asset to all possible URIs it might match
			for (const [name, data] of assets.entries()) {
				const basename = name.split('/').pop() || name
				const decodedName = decodeURIComponent(name)
				const decodedBasename = decodedName.split('/').pop() || decodedName

				// Create a list of possible keys for this asset
				const possibleKeys = new Set([
					name,
					basename,
					decodedName,
					decodedBasename,
					`./${basename}`,
					`./${decodedBasename}`
				])

				// Add this asset under any URI that matches any of its possible keys
				for (const uri of referencedUris) {
					const uriBasename = uri.split('/').pop() || uri
					const decodedUri = decodeURIComponent(uri)
					const decodedUriBasename = decodedUri.split('/').pop() || decodedUri

					// Check if this URI matches this asset
					if (
						possibleKeys.has(uri) ||
						possibleKeys.has(uriBasename) ||
						possibleKeys.has(decodedUri) ||
						possibleKeys.has(decodedUriBasename) ||
						uri === basename ||
						uri === decodedBasename ||
						uriBasename === basename ||
						uriBasename === decodedBasename ||
						decodedUri === basename ||
						decodedUri === decodedBasename ||
						decodedUriBasename === basename ||
						decodedUriBasename === decodedBasename
					) {
						// Add under the exact URI used in the GLTF
						resources[uri] = data
						// Also add under common variations
						resources[decodedUri] = data
					}
				}

				// Also add under the original name and common variations as fallback
				resources[name] = data
				resources[basename] = data
				if (decodedName !== name) {
					resources[decodedName] = data
				}
				if (decodedBasename !== basename) {
					resources[decodedBasename] = data
				}
			}

			this.emitProgress(
				'Parsing model data',
				progressOffset + 75 * progressScale
			)

			const document = await this.io.readJSON({
				json: gltfJson,
				resources
			})

			const totalSize =
				gltfBuffer.byteLength +
				Array.from(assets.values()).reduce(
					(sum, asset) => sum + asset.byteLength,
					0
				)

			const loadTime = Date.now() - startTime

			this.emitProgress('Model loaded successfully', 100)

			return {
				data: document,
				type: ModelFileTypes.gltf,
				size: totalSize,
				name: fileName,
				loadTime
			}
		} catch (error) {
			throw new Error(`Failed to load GLTF with assets: ${error}`)
		}
	}

	/**
	 * Load GLTF model with additional File assets (browser environment).
	 *
	 * @param gltfFile - The main GLTF file
	 * @param assetFiles - Additional asset files (textures, buffers)
	 * @returns Promise resolving to the loaded model result
	 */
	public async loadGLTFWithFileAssets(
		gltfFile: File,
		assetFiles: File[]
	): Promise<ModelLoadResult> {
		this.emitProgress('Loading GLTF with file assets', 0)

		try {
			this.emitProgress('Reading files', 10)

			// Read GLTF file
			const gltfBuffer = new Uint8Array(await gltfFile.arrayBuffer())

			// Read asset files - normalize filenames to handle different path separators
			const assetMap = new Map<string, Uint8Array>()
			for (const file of assetFiles) {
				const buffer = new Uint8Array(await file.arrayBuffer())
				// Store both the original filename and just the basename
				assetMap.set(file.name, buffer)
				// Also store with just the basename in case GLTF uses relative paths
				const basename = file.name.split('/').pop() || file.name
				if (basename !== file.name) {
					assetMap.set(basename, buffer)
				}
			}

			this.emitProgress('Processing GLTF with assets', 50)

			return await this.loadGLTFWithAssets(
				gltfBuffer,
				assetMap,
				gltfFile.name,
				true
			)
		} catch (error) {
			throw new Error(`Failed to load GLTF with file assets: ${error}`)
		}
	}

	/**
	 * Validate if a file type is supported.
	 *
	 * @param fileName - The file name to check
	 * @returns True if the file type is supported
	 */
	public isSupportedFormat(fileName: string): boolean {
		try {
			this.getFileType(fileName)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Get supported file extensions.
	 *
	 * @returns Array of supported file extensions
	 */
	public getSupportedExtensions(): string[] {
		return Object.values(ModelFileTypes)
	}

	/**
	 * Convert a document to Three.js scene (browser environment).
	 * This method requires the Three.js GLTFLoader to be available.
	 *
	 * @param document - The glTF-Transform document
	 * @param modelResult - The original model load result
	 * @returns Promise resolving to the Three.js scene result
	 */
	public async documentToThreeJS(
		document: Document,
		modelResult: ModelLoadResult
	): Promise<ThreeJSModelResult> {
		try {
			// Export document as GLB buffer
			const glbBuffer = await this.io.writeBinary(document)

			// Dynamic import to avoid server-side issues
			const { GLTFLoader } = await import(
				'three/examples/jsm/loaders/GLTFLoader.js'
			)

			return new Promise((resolve, reject) => {
				const loader = new GLTFLoader()

				loader.parse(
					glbBuffer.buffer as ArrayBuffer,
					'',
					(gltf) => {
						resolve({
							scene: gltf.scene,
							document: document,
							type: modelResult.type,
							size: modelResult.size,
							name: modelResult.name,
							loadTime: modelResult.loadTime
						})
					},
					(error) => {
						// Enhanced error message for common issues
						let errorMessage = `Failed to convert document to Three.js: ${error}`

						if (
							error &&
							error.toString().includes('missing URI and bufferView')
						) {
							errorMessage = `${errorMessage}\n\nThis error typically occurs when the GLTF file references external textures or resources that are missing. Please ensure all required asset files (images, textures, .bin files) are uploaded together with the .gltf file.`
						}

						reject(new Error(errorMessage))
					}
				)
			})
		} catch (error) {
			throw new Error(`Failed to convert document to Three.js: ${error}`)
		}
	}

	/**
	 * Load a model and convert to Three.js scene (browser environment).
	 * This is a convenience method that combines loading and Three.js conversion.
	 */
	public async loadToThreeJS(
		input: string | File
	): Promise<ThreeJSModelResult> {
		const modelResult = await this.loadFromFile(input)
		return this.documentToThreeJS(modelResult.data, modelResult)
	}

	/**
	 * Load GLTF with assets and convert to Three.js scene (browser environment).
	 */
	public async loadGLTFWithAssetsToThreeJS(
		gltfFile: File,
		assetFiles: File[]
	): Promise<ThreeJSModelResult> {
		const modelResult = await this.loadGLTFWithFileAssets(gltfFile, assetFiles)
		return this.documentToThreeJS(modelResult.data, modelResult)
	}

	private getFileType(fileName: string): ModelFileTypes {
		const extension = fileName.toLowerCase().split('.').pop()

		switch (extension) {
			case 'gltf':
				return ModelFileTypes.gltf
			case 'glb':
				return ModelFileTypes.glb
			case 'usdz':
				return ModelFileTypes.usdz
			default:
				throw new Error(`Unsupported file type: ${extension}`)
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
