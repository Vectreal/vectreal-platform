import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useCallback } from 'react'

import type { ModelFile } from '@vctrl/hooks/use-load-model'

/**
 * Exports the optimizer's current document as glTF JSON plus its assets.
 *
 * This is the payload both the save flow and the IndexedDB snapshot upload.
 * It reads the optimizer imperatively, and takes the model as an argument for
 * the same reason: the snapshot runs the moment a load resolves, one render
 * before the context holds that model.
 */
export function usePrepareGltfDocument() {
	const { file: loadedFile, optimizer } = useModelContext(true)
	const { handleDocumentGltfExport } = useExportModel()

	return useCallback(
		async (file: ModelFile | null = loadedFile) => {
			if (!optimizer || !file) {
				return null
			}

			const gltfDocument = optimizer._getDocument()
			if (!gltfDocument) {
				return null
			}

			return handleDocumentGltfExport(gltfDocument, file, false, false)
		},
		[handleDocumentGltfExport, loadedFile, optimizer]
	)
}
