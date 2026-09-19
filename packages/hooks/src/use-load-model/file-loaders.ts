import {
	IMPORTABLE_FORMAT_IDS,
	modelFormatForFileName,
	type ModelFormatId
} from '@vctrl/core/model-formats'
import {
	isThreeSourceFormat,
	ModelFileTypes,
	referenceIn,
	selectionKey
} from '@vctrl/core/model-loader'

import {
	createStructuredLoadError,
	normalizeLocalLoadError
} from './error-helpers'
import { ingestIntoOptimizer } from './optimizer-ingest'
import {
	buildSceneDataFromLocalFiles,
	collectReferencedUris
} from './scene-data-builder'
import { InputFileOrDirectory, LoadedModel } from './types'
import { calculateReferencedBytesFromFiles, readDirectory } from './utils'

import type { LoadContext } from './load-context'

/**
 * The importable model in each format, at most one per format, in the order
 * `MODEL_FORMATS` declares.
 *
 * This replaced `findByExtension`, which matched `file.name.endsWith('.' +
 * fileType)` raw while the loader it hands off to lower-cased, so `MODEL.GLB`
 * matched no format here and was rejected as unsupported before the loader
 * that would have read it ever saw it. Routing through
 * `modelFormatForFileName` is what makes that one rule instead of two.
 *
 * At most one per format is the previous behaviour kept deliberately: two
 * `.glb` files in a dropped folder load the first rather than failing as
 * "multiple models", and changing that is a separate decision.
 */
const findImportableModels = (files: File[]): File[] => {
	const firstOfFormat = new Map<ModelFormatId, File>()

	for (const file of files) {
		const format = modelFormatForFileName(file.name)
		if (!format?.canImport || firstOfFormat.has(format.id)) continue
		firstOfFormat.set(format.id, file)
	}

	return IMPORTABLE_FORMAT_IDS.map((id) => firstOfFormat.get(id)).filter(
		(file): file is File => Boolean(file)
	)
}

/**
 * Where in the dropped folder a file sat, taken off the drop machinery.
 *
 * `webkitRelativePath` is populated by one thing only: an `<input
 * webkitdirectory>` picker. A folder dropped on the page never goes through
 * one, so every file arrived with that property empty and every path-keyed
 * lookup below fell back to the bare name - which is one file per name, so a
 * folder holding `body/diffuse.png` and `wheels/diffuse.png` textured both
 * materials with whichever arrived last and reported success.
 *
 * react-dropzone already computed the path. `file-selector`'s `toFileWithPath`
 * writes it to `relativePath` (`/chair/body/diffuse.png` from a directory
 * handle, `/chair/...` from a drag entry's `fullPath`), and nothing in this
 * repo reads it. So the path was never missing, only unclaimed.
 *
 * Adopted onto `webkitRelativePath` rather than read as `relativePath` because
 * the property is the convention every consumer already uses, including
 * `read-directory.ts` for the folder-picker route. One spelling, two routes in
 * agreement, and no reader changes.
 *
 * WRITTEN ONLY WHEN IT SAYS SOMETHING THE NAME DOES NOT. A loose file gets
 * `./file.png`, which strips to the name it already has - and
 * `scene-data-builder.ts` branches on this property being truthy, so writing a
 * value with no folder in it would take that branch for a file that has no
 * path. A real value is never overwritten either: a file from the folder
 * picker keeps the browser's own.
 */
const withDroppedPath = (file: File): File => {
	if (file.webkitRelativePath) return file

	const stated = (file as File & { relativePath?: unknown }).relativePath
	if (typeof stated !== 'string') return file

	const path = stated.replace(/^(\.?\/)+/, '')
	if (!path.includes('/')) return file

	/* An own property shadows the prototype getter, as `read-directory` does. */
	Object.defineProperty(file, 'webkitRelativePath', {
		value: path,
		configurable: true,
		enumerable: true
	})

	return file
}

/**
 * Flattens dropped directories into a flat file list.
 */
const expandDirectories = async (
	filesOrDirectories: InputFileOrDirectory
): Promise<File[]> => {
	const files: File[] = []

	for (const item of filesOrDirectories) {
		if (item instanceof File) {
			files.push(withDroppedPath(item))
		} else if ('kind' in item && item.kind === 'directory') {
			files.push(...(await readDirectory(item)))
		}
	}

	return files
}

/**
 * Loads a model the user picked: a single file, or a bundle with the siblings
 * it refers to.
 *
 * Throws a `StructuredLoadError` for every rejection, including "nothing usable
 * in here" and "more than one model in here". Those used to be silent returns,
 * which left the caller waiting on a load that would never finish.
 */
export const loadModelFromFiles = async (
	filesOrDirectories: InputFileOrDirectory,
	ctx: LoadContext
): Promise<LoadedModel> => {
	const files = await expandDirectories(filesOrDirectories)

	const modelFiles = findImportableModels(files)

	if (modelFiles.length > 1) {
		throw createStructuredLoadError({
			code: 'multiple_models',
			message: `Multiple models found: ${modelFiles.map((file) => file.name).join(', ')}`,
			recoverable: true,
			source: 'local-upload',
			context: { fileNames: modelFiles.map((file) => file.name) }
		})
	}

	if (modelFiles.length === 0) {
		throw createStructuredLoadError({
			code: 'unsupported_format',
			message: files.length
				? `No supported model found in: ${files.map((file) => file.name).join(', ')}`
				: 'No files to load',
			recoverable: true,
			source: 'local-upload',
			context: { fileNames: files.map((file) => file.name) }
		})
	}

	const modelFile = modelFiles[0]
	/* Non-null: `modelFiles` only holds files a format claimed. */
	const format = modelFormatForFileName(modelFile.name) as NonNullable<
		ReturnType<typeof modelFormatForFileName>
	>

	/*
	  A bundle is a manifest pointing at siblings, so it is loaded with the rest
	  of the selection rather than on its own. There are two kinds, and the
	  difference is who resolves the references: glTF-Transform reads a glTF's
	  own, and a three.js loader reads an OBJ's material library. Asking which
	  route the format takes rather than testing `format.id === 'gltf'` is what
	  keeps this branch from becoming another statement of the format set.
	*/
	const siblings = format.isBundle
		? files.filter((file) => file !== modelFile)
		: []

	if (format.isBundle && !isThreeSourceFormat(format.id)) {
		return loadGltfModel(modelFile, siblings, ctx)
	}

	return loadBinaryModel(modelFile, siblings, format.id, ctx)
}

const loadBinaryModel = async (
	file: File,
	siblings: File[],
	fileType: ModelFileTypes,
	{ modelLoader, optimizer, publish }: LoadContext
): Promise<LoadedModel> => {
	let loaded: LoadedModel
	/*
	  Set only for a format the loader read through three.js, where it holds the
	  GLB that format was converted into. The file itself is an STL, an FBX or an
	  OBJ there, and `loadFromGlbBuffer` checks the glTF magic bytes, so
	  re-reading the file would fail optimizer ingest on a model that is already
	  on screen.
	*/
	let convertedGlb: Uint8Array | undefined

	try {
		const result = await modelLoader.loadToThreeJS(file, siblings)
		convertedGlb = result.glbBytes
		loaded = {
			file: {
				model: result.scene,
				animations: result.animations,
				type: fileType,
				name: file.name
			}
		}
	} catch (error) {
		throw normalizeLocalLoadError(error, 'binary_load_failed', {
			fileName: file.name,
			fileType,
			fileSize: file.size
		})
	}

	// The model is on screen from here on, so nothing below may fail the load.
	publish(loaded)

	/*
	  The `fileType !== usdz` guard that used to stand here is gone with the
	  reason for it. A USDZ is a zip archive and `loadFromGlbBuffer` validates GLB
	  magic bytes, so ingesting one threw - but the owner says `canImport: false`
	  now, so `findImportableModels` never admits a USDZ and this line is not
	  reachable with one. Keeping the guard would have claimed a case that cannot
	  occur, which is the shape CLAUDE.md forbids.
	*/
	if (optimizer) {
		await ingestIntoOptimizer(async () => {
			const buffer = convertedGlb ?? new Uint8Array(await file.arrayBuffer())
			await optimizer.loadFromGlbBuffer(buffer)
		})
	}

	return loaded
}

const loadGltfModel = async (
	gltfFile: File,
	otherFiles: File[],
	{ modelLoader, optimizer, publish }: LoadContext
): Promise<LoadedModel> => {
	let loaded: LoadedModel

	try {
		const { sourcePackageBytes, textureBytes } =
			await calculateReferencedBytesFromFiles(gltfFile, otherFiles)

		const result = await modelLoader.loadGLTFWithAssetsToThreeJS(
			gltfFile,
			otherFiles
		)

		loaded = {
			file: {
				model: result.scene,
				animations: result.animations,
				type: ModelFileTypes.gltf,
				name: gltfFile.name,
				sourcePackageBytes,
				sourceTextureBytes: textureBytes
			}
		}
	} catch (error) {
		throw normalizeLocalLoadError(error, 'gltf_load_failed', {
			fileName: gltfFile.name,
			fileSize: gltfFile.size,
			assetCount: otherFiles.length
		})
	}

	publish(loaded)

	if (optimizer) {
		await ingestIntoOptimizer(
			async () => {
				try {
					const localSceneData = await buildSceneDataFromLocalFiles(
						gltfFile,
						otherFiles
					)
					await optimizer.loadFromServerSceneData(localSceneData)
				} catch (optimizerError) {
					console.warn(
						'Failed to initialize optimizer from source GLTF payload; trying direct asset load.',
						optimizerError
					)

					if (!('loadFromGLTFWithAssets' in optimizer)) {
						throw new Error('loadFromGLTFWithAssets not available')
					}

					const gltfBytes = new Uint8Array(await gltfFile.arrayBuffer())

					/*
					  The optimizer hands this map straight to glTF-Transform as
					  its resources, so every key has to be a URI the glTF
					  actually writes - which is why this resolves each reference
					  rather than pouring in spellings and hoping one lands. One
					  of those spellings was always the bare basename, so a
					  folder holding two `diffuse.png` ingested one image twice
					  while the viewer beside it showed the right two.
					*/
					const selection = new Map<string, Uint8Array>()
					for (const assetFile of otherFiles) {
						selection.set(
							selectionKey(assetFile),
							new Uint8Array(await assetFile.arrayBuffer())
						)
					}

					const modelPath = selectionKey(gltfFile)
					const assetMap = new Map<string, Uint8Array>()
					for (const uri of collectReferencedUris(
						JSON.parse(new TextDecoder().decode(gltfBytes))
					)) {
						const bytes = referenceIn(selection, uri, modelPath)
						if (bytes) assetMap.set(uri, bytes)
					}

					await optimizer.loadFromGLTFWithAssets(gltfBytes, assetMap)
				}
			},
			() => optimizer.load(loaded.file.model)
		)
	}

	return loaded
}
