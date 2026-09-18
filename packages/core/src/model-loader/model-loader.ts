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

import {
	canLoadDracoInBrowser,
	loadDracoModule
} from '../draco/load-draco-module'
import { stripDecodedDracoExtension } from '../draco/strip-decoded-draco-extension'
import { modelFormatForFileName, type ModelFormat } from '../model-formats'
import { missingAssetsError } from './missing-assets'
import { OperationProgress } from '../types'
import { getThreeDracoLoader } from './draco-three-loader'
import { referenceIn, selectionKey } from './dropped-selection'
import { referencedAssetNames, referencedUris } from './referenced-assets'
import { resolveModifiedUrl } from './resolve-modified-url'
import { threeSourceBridge } from './three-source-bridges'
import { ModelFileTypes, ModelLoadResult, ThreeJSModelResult } from './types'

import type { ModelSiblings } from './three-source-bridges'
import type { AnimationClip, Object3D } from 'three'

const DEFAULT_DRACO_DECODER_PATH = '/draco/'

const EMPTY_SIBLINGS: ModelSiblings = new Map()

/**
 * The files beside a model, each under one key: where it sits in the selection.
 *
 * One entry per file, not one per way of naming it. Keying a file under both
 * its name and its path made the map disagree with itself - the same `.mtl`
 * appeared twice and was parsed and concatenated twice for every folder anyone
 * dropped - and it did not help resolution either, because deciding *which*
 * file a reference means is a lookup question, which `siblingFor` now answers
 * against one canonical key per file.
 *
 * Lower-cased and forward-slashed, for the reason `modelFormatForFileName`
 * lower-cases: a reference that differs only in case, or only in separator, is
 * the same file on every platform anyone drops from.
 */
async function siblingsFromFiles(
	files: readonly File[]
): Promise<ModelSiblings> {
	const siblings = new Map<string, Uint8Array>()

	for (const file of files) {
		siblings.set(selectionKey(file), new Uint8Array(await file.arrayBuffer()))
	}

	return siblings
}

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
	private dracoDecoderPath: string
	private dracoDecoderRegistration: Promise<void> | null = null

	constructor(options?: { dracoDecoderPath?: string }) {
		this.io = new WebIO().registerExtensions(ALL_EXTENSIONS)
		this.dracoDecoderPath =
			options?.dracoDecoderPath ?? DEFAULT_DRACO_DECODER_PATH
	}

	/**
	 * Lazily loads and registers the Draco decoder module on this instance's
	 * WebIO, so `readBinary`/`readJSON` can decode `KHR_draco_mesh_compression`
	 * primitives. Memoized so the decoder is only fetched once per instance.
	 */
	private ensureDracoDecoderRegistered(): Promise<void> {
		if (!this.dracoDecoderRegistration) {
			// Outside a browser/worker environment there is no decoder to load.
			// Non-Draco content is unaffected; Draco content will still throw
			// glTF-Transform's own clear "install extension dependency" error.
			this.dracoDecoderRegistration = canLoadDracoInBrowser()
				? loadDracoModule('decoder', this.dracoDecoderPath).then(
						(decoderModule) => {
							this.io.registerDependencies({
								'draco3d.decoder': decoderModule
							})
						}
					)
				: Promise.resolve()
		}
		return this.dracoDecoderRegistration
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
	public async loadFromFile(
		input: string | File,
		assetFiles: readonly File[] = []
	): Promise<ModelLoadResult> {
		if (typeof input === 'string') {
			return this.loadFromFilePath(input, assetFiles)
		} else {
			return this.loadFromFileObject(input, assetFiles)
		}
	}

	/**
	 * Load a model from a file path (Node.js environment).
	 *
	 * Takes the siblings too, because the caller cannot tell which branch of
	 * `loadFromFile` it landed on: passing a path and a material library used
	 * to hand the bridge an empty map, so the identical call converted an OBJ
	 * textured from a `File` and grey from a path, with nothing reported.
	 *
	 * @param filePath - Path to the model file
	 * @param assetFiles - The files the model refers to, if any came with it
	 * @returns Promise resolving to the loaded model result
	 */
	private async loadFromFilePath(
		filePath: string,
		assetFiles: readonly File[] = []
	): Promise<ModelLoadResult> {
		const startTime = Date.now()
		this.emitProgress('Loading model from file', 0, filePath)

		try {
			// Import fs in Node.js environment
			const fs = await import(/* @vite-ignore */ 'fs/promises')
			const path = await import(/* @vite-ignore */ 'path')

			const buffer = await fs.readFile(filePath)
			const fileName = path.basename(filePath)
			const format = this.formatFor(fileName)

			this.emitProgress('Parsing model data', 50)

			const { document, glbBytes } = await this.readDocument(
				new Uint8Array(buffer),
				format,
				await siblingsFromFiles(assetFiles),
				fileName.toLowerCase()
			)
			const loadTime = Date.now() - startTime

			this.emitProgress('Model loaded successfully', 100)

			return {
				data: document,
				type: format.id,
				size: buffer.byteLength,
				name: fileName,
				loadTime,
				glbBytes
			}
		} catch (error) {
			throw new Error(`Failed to load model from file ${filePath}: ${error}`, {
				cause: error
			})
		}
	}

	/**
	 * Load a model from a File object (browser environment).
	 *
	 * @param file - The File object to load
	 * @returns Promise resolving to the loaded model result
	 */
	private async loadFromFileObject(
		file: File,
		assetFiles: readonly File[] = []
	): Promise<ModelLoadResult> {
		const startTime = Date.now()
		this.emitProgress('Loading model from File object', 0, file.name)

		try {
			const format = this.formatFor(file.name)
			const buffer = await file.arrayBuffer()

			this.emitProgress('Parsing model data', 50)

			const { document, glbBytes } = await this.readDocument(
				new Uint8Array(buffer),
				format,
				await siblingsFromFiles(assetFiles),
				selectionKey(file)
			)
			const loadTime = Date.now() - startTime

			this.emitProgress('Model loaded successfully', 100)

			return {
				data: document,
				type: format.id,
				size: buffer.byteLength,
				name: file.name,
				loadTime,
				glbBytes
			}
		} catch (error) {
			throw new Error(`Failed to load model from File object: ${error}`, {
				cause: error
			})
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
		fileName: string,
		siblings: ModelSiblings = EMPTY_SIBLINGS
	): Promise<ModelLoadResult> {
		const startTime = Date.now()
		this.emitProgress('Loading model from buffer', 0)

		try {
			const format = this.formatFor(fileName)

			this.emitProgress('Parsing model data', 50)

			const { document, glbBytes } = await this.readDocument(
				buffer,
				format,
				siblings,
				fileName.toLowerCase()
			)
			const loadTime = Date.now() - startTime

			this.emitProgress('Model loaded successfully', 100)

			return {
				data: document,
				type: format.id,
				size: buffer.byteLength,
				name: fileName,
				loadTime,
				glbBytes
			}
		} catch (error) {
			throw new Error(`Failed to load model from buffer: ${error}`, {
				cause: error
			})
		}
	}

	/**
	 * Load GLTF model with additional assets.
	 *
	 * @param gltfBuffer - The GLTF JSON data
	 * @param assets - Additional asset files (textures, buffers), each under one
	 *   key: where it sits in the selection, as `selectionKey` spells it
	 * @param fileName - Original file name
	 * @param isNestedCall - Internal flag to prevent progress reset when called from loadGLTFWithFileAssets
	 * @param modelPath - Where the glTF itself sits in that same selection. A
	 *   reference is written relative to the model, and the keys are relative to
	 *   what was dropped; this is what connects the two frames. Omitting it is
	 *   safe for a single-folder selection and switches the cross-folder guard
	 *   off entirely: a bare name has no root, so nothing in the selection is
	 *   anyone else's and every sibling in every dropped folder is readable.
	 *   The one caller here, `loadGLTFWithFileAssets`, always passes
	 *   `selectionKey(gltfFile)`; `loadFromBuffer` reaches the same rule through a
	 *   three.js bridge with a bare name, and so always loads that way.
	 * @returns Promise resolving to the loaded model result
	 */
	public async loadGLTFWithAssets(
		gltfBuffer: Uint8Array,
		assets: Map<string, Uint8Array>,
		fileName: string,
		isNestedCall = false,
		modelPath = ''
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

			// Helper function to check if a URI is a data URL
			const isDataUrl = (uri: string): boolean => {
				return uri.startsWith('data:')
			}

			/*
			  ONE LOOKUP ANSWERS BOTH QUESTIONS BELOW. Validation and resolution
			  were separate rules - five spellings checked here, twelve built
			  further down - so a reference could pass the check and still come
			  back grey from the parse, with the load reporting success either
			  way. `referenceIn` owns what a reference means; asking it twice
			  cannot disagree with itself.
			*/
			const bytesFor = (uri: string) => referenceIn(assets, uri, modelPath)

			// Validate that referenced images exist in assets
			if (gltfJson.images) {
				const missingImages: string[] = []

				gltfJson.images.forEach((image, index: number) => {
					// Check if image has a URI reference
					if (image.uri) {
						// A data URL is the image; there is no file to go looking for.
						if (isDataUrl(image.uri)) return

						if (!bytesFor(image.uri)) {
							missingImages.push(`Image ${index}: ${image.uri}`)
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
					throw missingAssetsError(
						`Missing required image files:\n${missingImages.join('\n')}\n\nAvailable assets: ${availableAssets || '(none)'}`
					)
				}
			}

			/*
			  AND THE BUFFERS, WHICH MATTER MORE. Only images were checked, so a
			  `.gltf` dropped without its `.bin` fell through to `io.readJSON`
			  and failed there as a parse error - which reached the reader as
			  "Check it is a valid glTF." about a file that is perfectly valid
			  and merely incomplete. That is the commonest incomplete bundle
			  there is, and it was the one shape the refusal could not name.

			  A buffer with no `uri` is the GLB binary chunk and has no file to
			  go looking for, the same way an image with a `bufferView` has none.
			*/
			if (gltfJson.buffers) {
				const missingBuffers: string[] = []

				/*
				  ONLY THE BUFFERS THE DOCUMENT ACTUALLY READS. Checking every
				  declaration refused documents that load perfectly well: an
				  unreferenced buffer, a `byteLength: 0` buffer some exporters
				  emit, and anything the reader was never going to open. The
				  question is "will this load fail for want of a file", and a
				  buffer no `bufferView` points at cannot make it fail.
				*/
				const usedBuffers = new Set(
					(gltfJson.bufferViews ?? []).map((view) => view.buffer)
				)

				gltfJson.buffers.forEach((buffer, index: number) => {
					if (!usedBuffers.has(index)) return
					if (typeof buffer.uri !== 'string') return
					if (isDataUrl(buffer.uri)) return

					if (!bytesFor(buffer.uri)) {
						missingBuffers.push(`Buffer ${index}: ${buffer.uri}`)
					}
				})

				if (missingBuffers.length > 0) {
					const availableAssets = Array.from(assets.keys()).join(', ')
					throw missingAssetsError(
						`Missing required buffer files:\n${missingBuffers.join('\n')}\n\nAvailable assets: ${availableAssets || '(none)'}`
					)
				}
			}

			/*
			  One entry per reference the glTF actually makes, resolved through
			  the owner. What this replaced poured every asset in under its own
			  name, its basename, and every decoded variation of both, then
			  cross-matched twelve ways - and the unconditional basename entries
			  at the end meant two files called `diffuse.png` in sibling folders
			  each overwrote the other's URI. Both materials got whichever was
			  written last, and the load reported success.
			*/
			const resources = new Map<string, Uint8Array>()

			// Add main GLTF file
			resources.set('model.gltf', gltfBuffer)

			for (const uri of referencedUris(gltfJson)) {
				const bytes = bytesFor(uri)
				if (!bytes) continue

				/*
				  ONE ENTRY, UNDER THE URI EXACTLY AS THE GLTF WRITES IT. The reader
				  looks this map up with `jsonDoc.resources[imageDef.uri]` and
				  nothing else; glTF-Transform's `decodeURIComponent` calls are in
				  its filesystem resolver, which `readJSON` never reaches.

				  A second entry under the decoded spelling was written here "in
				  case it does not", and it was the fourth key space in one lookup:
				  case- and separator-sensitive but percent-decoding, the opposite
				  fold from `resolutionKey`. So `wood%20grain.png`'s decoded alias
				  overwrote the entry belonging to a *different* image genuinely
				  named `wood grain.png`, and the reader bound bytes that `bytesFor`
				  had not chosen - silently, because validation asks `bytesFor`,
				  which was right.
				*/
				resources.set(uri, bytes)
			}

			this.emitProgress(
				'Parsing model data',
				progressOffset + 75 * progressScale
			)

			await this.ensureDracoDecoderRegistered()
			const document = await this.io.readJSON({
				json: gltfJson,
				resources: resources.entries().reduce(
					(acc, [key, value]) => {
						acc[key] = value as Uint8Array<ArrayBuffer>
						return acc
					},
					{} as Record<string, Uint8Array<ArrayBuffer>>
				)
			})
			stripDecodedDracoExtension(document)

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
			throw new Error(`Failed to load GLTF with assets: ${error}`, {
				cause: error
			})
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

			/*
			  One key per file: where it sits in the selection, exactly as
			  `siblingsFromFiles` keys the three.js formats. Keying a file under
			  its name as well made the map disagree with itself - two files
			  called `diffuse.png` in sibling folders were one entry before
			  anything downstream got a chance to tell them apart - and it did
			  not help resolution either, because deciding which file a
			  reference means is a lookup question.
			*/
			const assetMap = new Map<string, Uint8Array>()
			for (const file of assetFiles) {
				assetMap.set(
					selectionKey(file),
					new Uint8Array(await file.arrayBuffer())
				)
			}

			this.emitProgress('Processing GLTF with assets', 50)

			return await this.loadGLTFWithAssets(
				gltfBuffer,
				assetMap,
				gltfFile.name,
				true,
				selectionKey(gltfFile)
			)
		} catch (error) {
			throw new Error(`Failed to load GLTF with file assets: ${error}`, {
				cause: error
			})
		}
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
			const [{ GLTFLoader }, dracoLoader] = await Promise.all([
				import('three/examples/jsm/loaders/GLTFLoader.js'),
				getThreeDracoLoader(this.dracoDecoderPath)
			])

			return new Promise((resolve, reject) => {
				const loader = new GLTFLoader()
				loader.setDRACOLoader(dracoLoader)

				loader.parse(
					glbBuffer.buffer as ArrayBuffer,
					'',
					(gltf) => {
						// three reads clips off the root when none are passed
						// explicitly, so mirroring them here keeps the idiomatic
						// path working for callers that take only the Object3D.
						gltf.scene.animations = gltf.animations ?? []

						resolve({
							scene: gltf.scene,
							animations: gltf.animations ?? [],
							document: document,
							type: modelResult.type,
							size: modelResult.size,
							name: modelResult.name,
							loadTime: modelResult.loadTime,
							glbBytes: modelResult.glbBytes
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
			throw new Error(`Failed to convert document to Three.js: ${error}`, {
				cause: error
			})
		}
	}

	/**
	 * Parse glTF JSON straight to a Three.js scene without the
	 * glTF-Transform document round-trip. View-only fast path: referenced
	 * buffers/images are served from in-memory object URLs.
	 */
	public async parseGLTFJsonToThreeJS(
		gltfJson: unknown,
		assets: Map<string, Uint8Array>
	): Promise<{
		scene: Object3D
		animations: AnimationClip[]
		size: number
		loadTime: number
	}> {
		const startTime = Date.now()
		this.emitProgress('Parsing model data', 25)

		const [{ GLTFLoader }, { LoadingManager }, dracoLoader] = await Promise.all(
			[
				import('three/examples/jsm/loaders/GLTFLoader.js'),
				import('three'),
				getThreeDracoLoader(this.dracoDecoderPath)
			]
		)

		let totalSize = 0
		for (const bytes of assets.values()) totalSize += bytes.byteLength

		/*
		  KEYED BY THE URI THE LOADER WILL ASK FOR, RESOLVED THROUGH THE OWNER.
		  `loader.parse(text, '')` gives three.js an empty base, so
		  `LoaderUtils.resolveURL` hands the modifier the URI exactly as the glTF
		  writes it - which makes one entry per reference the whole map.

		  What this replaced poured every spelling of every asset name in - whole
		  name, normalized, bare basename - and let the last writer win, so two
		  assets called `diffuse.png` in sibling folders each overwrote the
		  other. The editor reads the same scene through `loadGLTFWithAssets` and
		  got it right; this is the route the published embed and the dashboard
		  viewer take, so the defect was visible to everyone except the person
		  who could fix it. `referencedAssetNames` is the rule, in a pure module
		  because nothing here can be reached without a DOM.
		*/
		const urlMap = new Map<string, string>()
		const objectUrlFor = new Map<string, string>()

		for (const [uri, name] of referencedAssetNames(gltfJson, assets.keys())) {
			let objectUrl = objectUrlFor.get(name)
			if (objectUrl === undefined) {
				objectUrl = URL.createObjectURL(
					new Blob([assets.get(name) as Uint8Array<ArrayBuffer>])
				)
				objectUrlFor.set(name, objectUrl)
			}
			urlMap.set(uri, objectUrl)
		}

		const manager = new LoadingManager()
		manager.setURLModifier((url) => resolveModifiedUrl(urlMap, url))
		const loader = new GLTFLoader(manager)
		loader.setDRACOLoader(dracoLoader)
		const gltfText = JSON.stringify(gltfJson)
		totalSize += gltfText.length

		try {
			const gltf = await new Promise<{
				scene: Object3D
				animations: AnimationClip[]
			}>((resolve, reject) => {
				loader.parse(gltfText, '', resolve, (error) =>
					reject(
						error instanceof Error
							? error
							: new Error(`Failed to parse glTF: ${error}`)
					)
				)
			})

			this.emitProgress('Model loaded successfully', 100)

			// Safe to hand back past the finally below: an AnimationClip holds
			// plain keyframe arrays and references none of the object URLs that
			// are about to be revoked.
			gltf.scene.animations = gltf.animations ?? []

			return {
				scene: gltf.scene,
				animations: gltf.animations ?? [],
				size: totalSize,
				loadTime: Date.now() - startTime
			}
		} finally {
			for (const objectUrl of new Set(urlMap.values())) {
				URL.revokeObjectURL(objectUrl)
			}
		}
	}

	/**
	 * Load a model and convert to Three.js scene (browser environment).
	 * This is a convenience method that combines loading and Three.js conversion.
	 *
	 * `assetFiles` are the files that arrived beside the model. Only a bundle
	 * read through three.js uses them - an OBJ and its `.mtl` today - and the
	 * glTF family takes its own path, `loadGLTFWithAssetsToThreeJS`, because
	 * glTF-Transform resolves those references itself.
	 */
	public async loadToThreeJS(
		input: string | File,
		assetFiles: readonly File[] = []
	): Promise<ThreeJSModelResult> {
		const modelResult = await this.loadFromFile(input, assetFiles)
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

	/**
	 * The one place a file name becomes a format, for this class.
	 *
	 * The switch this replaced was a second statement of the accepted set, and
	 * it disagreed with `findByExtension` in `@vctrl/hooks` on casing - that one
	 * matched raw, so `MODEL.GLB` was refused as unsupported before this class
	 * ever saw it, by code standing in front of a loader that reads it fine.
	 */
	private formatFor(fileName: string): ModelFormat {
		const format = modelFormatForFileName(fileName)

		if (!format?.canImport) {
			/*
			  Names the file, not a derived extension. It printed
			  `split('.').pop()`, which renders as "Unsupported file type: " with
			  nothing after the colon for a name like `model.` - the one case where
			  a reader most needs to be told what was wrong with what they picked.
			*/
			throw new Error(`Unsupported file type: ${fileName}`)
		}

		return format
	}

	/**
	 * A file's bytes, as a glTF-Transform document.
	 *
	 * Every load path ended in the same three lines - register Draco, read the
	 * binary, strip the decoded extension - and each one handed the file's own
	 * bytes to a reader that only understands the glTF family. That is the
	 * assumption a format like STL breaks: there is no glTF anywhere in the
	 * file, so it is parsed by three.js and re-serialized as GLB before the
	 * document pipeline sees it. Doing it here rather than at the drop zone is
	 * what keeps `@vctrl/core` from advertising a format it cannot read.
	 *
	 * `glbBytes` comes back only for a bridged format, and it is the conversion
	 * output. Callers hand it to the optimizer in place of the file, whose bytes
	 * are not glTF. The glTF family deliberately returns nothing: its file is
	 * already the GLB to ingest, and re-serializing one would discard whatever
	 * it arrived compressed as.
	 */
	private async readDocument(
		bytes: Uint8Array,
		format: ModelFormat,
		siblings: ModelSiblings = EMPTY_SIBLINGS,
		modelPath = ''
	): Promise<{ document: Document; glbBytes?: Uint8Array }> {
		const bridge = threeSourceBridge(format.id)
		let glbBytes: Uint8Array | undefined

		if (bridge) {
			/*
			  Dynamic, like the three.js loaders themselves: the exporter carries
			  `GLTFExporter` and JSZip, and nothing that reads a GLB needs either.
			*/
			const { ModelExporter } = await import('../model-exporter')
			const exported = await new ModelExporter().exportThreeJSGLB(
				await bridge(bytes, siblings, modelPath)
			)
			glbBytes = exported.data
		}

		await this.ensureDracoDecoderRegistered()
		const document = await this.io.readBinary(glbBytes ?? bytes)
		stripDecodedDracoExtension(document)

		return { document, glbBytes }
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
