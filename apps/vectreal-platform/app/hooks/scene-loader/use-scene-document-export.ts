import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useCallback } from 'react'

/**
 * Exports the optimizer's current document as glTF JSON plus its assets.
 *
 * This is the payload both the save flow and the IndexedDB snapshot upload, so
 * it reads the optimizer imperatively rather than through render state: it is
 * called right after a load resolves, before React has re-rendered with the
 * optimizer's new flags.
 */
export function usePrepareGltfDocument() {
	const { file, optimizer } = useModelContext(true)
	const { handleDocumentGltfExport } = useExportModel()

	return useCallback(async () => {
		if (!optimizer || !file) {
			return null
		}

		const gltfDocument = optimizer._getDocument()
		if (!gltfDocument) {
			return null
		}

		return handleDocumentGltfExport(gltfDocument, file, false, false)
	}, [file, handleDocumentGltfExport, optimizer])
}
