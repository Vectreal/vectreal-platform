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

import {
	LoadProgress,
	ModelFileTypes,
	ModelLoadResult,
	ThreeJSModelResult
} from './types'

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
	private progressCallback?: (progress: LoadProgress) => void

	constructor() {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
	}

	/**
	 * Set a progress callback to receive loading progress updates.
	 */
	public onProgress(callback: (progress: LoadProgress) => void): void {
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
	 * @returns Promise resolving to the loaded model result
	 */
	public async loadGLTFWithAssets(
		gltfBuffer: Uint8Array,
		assets: Map<string, Uint8Array>,
		fileName: string
	): Promise<ModelLoadResult> {
		const startTime = Date.now()
		this.emitProgress('Loading GLTF with assets', 0)

		try {
			// Convert buffer to JSON
			const gltfJson = JSON.parse(new TextDecoder().decode(gltfBuffer))

			this.emitProgress('Processing assets', 25)

			// Validate that referenced images exist in assets
			if (gltfJson.images) {
				const missingImages: string[] = []
				console.log(
					'GLTF Images validation:',
					JSON.stringify(gltfJson.images, null, 2)
				)
				console.log('Available assets:', Array.from(assets.keys()))

				gltfJson.images.forEach((image: any, index: number) => {
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

						if (!hasAsset && !image.bufferView && image.bufferView !== 0) {
							missingImages.push(`Image ${index}: ${imageName}`)
						}
					} else if (!image.bufferView && image.bufferView !== 0) {
						// bufferView can be 0 (valid index), so we need to check for undefined/null
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

			// Add assets with multiple key variations for better resolution
			for (const [name, data] of assets.entries()) {
				resources[name] = data

				// Also add with decoded URI in case the GLTF uses URI encoding
				const decodedName = decodeURIComponent(name)
				if (decodedName !== name) {
					resources[decodedName] = data
				}

				// Add with just the basename
				const basename = name.split('/').pop() || name
				if (basename !== name) {
					resources[basename] = data
				}

				// Add with ./ prefix (common in GLTF files)
				resources[`./${basename}`] = data

				// Add with decoded ./ prefix
				if (decodedName !== name) {
					const decodedBasename = decodedName.split('/').pop() || decodedName
					resources[`./${decodedBasename}`] = data
				}
			}

			this.emitProgress('Parsing model data', 75)

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

			return await this.loadGLTFWithAssets(gltfBuffer, assetMap, gltfFile.name)
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
