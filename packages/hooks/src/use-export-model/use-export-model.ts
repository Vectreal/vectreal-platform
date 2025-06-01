import fileSaver from 'file-saver'
import JSZip from 'jszip'

import {
	GLTFExporter,
	GLTFExporterOptions
} from 'three/examples/jsm/exporters/GLTFExporter'

import { ModelFile } from '../use-load-model'

import { ExportResult } from './types'
import { getFileBasename, handleBuffers, handleImages } from './utils'

/**
 * Processes the result of a GLTF export and saves it as a ZIP file.
 *
 * @param {ExportResult} result The result of the GLTF export.
 * @param {string} baseFileName The base file name to use for the exported file.
 */
const processGltfResult = (
	result: ExportResult,
	baseFileName: string
): void => {
	const zip = new JSZip()
	zip.file(`${baseFileName}.gltf`, JSON.stringify(result, null, 2))

	if (result.buffers) {
		handleBuffers(result.buffers, zip, baseFileName)
	}

	if (result.images && result.textures) {
		handleImages(result.images, result.textures, zip)
	}

	zip.generateAsync({ type: 'blob' }).then((content) => {
		fileSaver.saveAs(content, `${baseFileName}.zip`)
	})
}

/**
 * A React hook for exporting a 3D model from a Three.js scene.
 *
 * @param {Function} [onSaved] Called when the export is complete.
 * @param {Function} [onError] Called when an error occurs during exporting.
 * @returns An object with a single property, `handleGltfExport`. `handleGltfExport` is a function
 *   that takes a file object and a boolean indicating whether to export in binary format.
 *   It exports the scene in the format specified by the boolean parameter.
 */
const useExportModel = (
	onSaved?: () => void,
	onError?: (error: ErrorEvent) => void
) => {
	// Main function to handle exporting the scene in GLTF or GLB format
	const handleGltfExport = (file: ModelFile | null, binary: boolean): void => {
		const scene = file?.model
		if (!scene) {
			console.error('Scene not initialized')
			return
		}

		const exporter = new GLTFExporter()
		const options = {
			binary,
			includeCustomExtensions: true
		} satisfies GLTFExporterOptions

		exporter.parse(
			scene,
			(result: ArrayBuffer | ExportResult) => {
				const baseFileName = getFileBasename(file.name)

				if (result instanceof ArrayBuffer) {
					// GLB format
					fileSaver.saveAs(new Blob([result]), `${baseFileName}.glb`)
					if (onSaved) onSaved()
				} else {
					// GLTF format
					processGltfResult(result, baseFileName)
					if (onSaved) onSaved()
				}
			},
			(error) => {
				console.error(error)

				if (onError) onError(error)
			},
			options
		)
	}

	return {
		handleGltfExport
	}
}

export default useExportModel
