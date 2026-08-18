import { ModelFileTypes } from '@vctrl/core/model-loader'

import { createStructuredLoadError, normalizeLocalLoadError } from './error-helpers'
import { ingestIntoOptimizer } from './optimizer-ingest'
import { buildSceneDataFromLocalFiles } from './scene-data-builder'
import { InputFileOrDirectory, LoadedModel } from './types'
import { calculateReferencedBytesFromFiles, readDirectory } from './utils'

import type { LoadContext } from './load-context'

const findByExtension = (files: File[], fileType: ModelFileTypes) =>
	files.find((file) => file.name.endsWith('.' + fileType))

/**
 * Flattens dropped directories into a flat file list.
 */
const expandDirectories = async (
	filesOrDirectories: InputFileOrDirectory
): Promise<File[]> => {
	const files: File[] = []

	for (const item of filesOrDirectories) {
		if (item instanceof File) {
			files.push(item)
		} else if ('kind' in item && item.kind === 'directory') {
			files.push(...(await readDirectory(item)))
		}
	}

	return files
}

/**
 * Loads a model the user picked: a GLB, a USDZ, or a glTF with its sibling assets.
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

	const gltfFile = findByExtension(files, ModelFileTypes.gltf)
	const glbFile = findByExtension(files, ModelFileTypes.glb)
	const usdzFile = findByExtension(files, ModelFileTypes.usdz)
	const modelFiles = [gltfFile, glbFile, usdzFile].filter(Boolean) as File[]

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

	if (gltfFile) {
		const otherFiles = files.filter((file) => file !== gltfFile)
		return loadGltfModel(gltfFile, otherFiles, ctx)
	}

	const binaryFile = (glbFile ?? usdzFile) as File
	return loadBinaryModel(
		binaryFile,
		glbFile ? ModelFileTypes.glb : ModelFileTypes.usdz,
		ctx
	)
}

const loadBinaryModel = async (
	file: File,
	fileType: ModelFileTypes,
	{ modelLoader, optimizer, publish }: LoadContext
): Promise<LoadedModel> => {
	let loaded: LoadedModel

	try {
		const result = await modelLoader.loadToThreeJS(file)
		loaded = {
			file: { model: result.scene, type: fileType, name: file.name }
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

	// USDZ files are ZIP archives - loadFromGlbBuffer validates GLB magic bytes
	// and throws for any non-GLB binary. Skip optimizer loading for USDZ.
	if (optimizer && fileType !== ModelFileTypes.usdz) {
		await ingestIntoOptimizer(async () => {
			const buffer = new Uint8Array(await file.arrayBuffer())
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
		await ingestIntoOptimizer(async () => {
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
				const assetMap = new Map<string, Uint8Array>()
				for (const assetFile of otherFiles) {
					const bytes = new Uint8Array(await assetFile.arrayBuffer())
					assetMap.set(assetFile.name, bytes)
					if (assetFile.webkitRelativePath) {
						assetMap.set(assetFile.webkitRelativePath, bytes)
					}
				}
				await optimizer.loadFromGLTFWithAssets(gltfBytes, assetMap)
			}
		}, () => optimizer.load(loaded.file.model))
	}

	return loaded
}

