import { ModelExporter } from '@vctrl/core'
import fileSaver from 'file-saver'
import { useCallback, useRef } from 'react'

import { ModelFile } from '../use-load-model'

/**
 * A React hook for exporting a 3D model using the core ModelExporter.
 *
 * @param {Function} [onSaved] Called when the export is complete.
 * @param {Function} [onError] Called when an error occurs during exporting.
 * @returns An object with export functions.
 */
const useExportModel = (
	onSaved?: () => void,
	onError?: (error: Error) => void
) => {
	const exporterRef = useRef<ModelExporter>(new ModelExporter())

	const handleGltfExport = useCallback(
		async (file: ModelFile | null, binary: boolean): Promise<void> => {
			const scene = file?.model
			if (!scene) {
				console.error('Scene not initialized')
				return
			}

			try {
				const exporter = exporterRef.current
				const baseFileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension

				if (binary) {
					// Export as GLB
					const result = await exporter.exportThreeJSGLB(scene)
					fileSaver.saveAs(new Blob([result.data]), `${baseFileName}.glb`)
				} else {
					// Export as GLTF with ZIP
					const result = await exporter.exportThreeJSGLTF(scene)
					const zipBuffer = await exporter.createZIPArchive(
						result,
						baseFileName
					)
					fileSaver.saveAs(new Blob([zipBuffer]), `${baseFileName}.zip`)
				}

				if (onSaved) onSaved()
			} catch (error) {
				console.error('Export failed:', error)
				if (onError) onError(error as Error)
			}
		},
		[onSaved, onError]
	)

	return {
		handleGltfExport
	}
}

export default useExportModel
