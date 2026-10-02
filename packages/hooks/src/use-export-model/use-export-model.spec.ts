// @vitest-environment jsdom
/**
 * `download = false` asks for the export back instead of a file. Only the glTF
 * branch read it, so a caller asking for a GLB got a download and `undefined`.
 */
import { Document } from '@gltf-transform/core'
import { renderHook } from '@testing-library/react'
import fileSaver from 'file-saver'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import useExportModel from './use-export-model'

vi.mock('file-saver', () => ({ default: { saveAs: vi.fn() } }))

function exportDocument(binary: boolean, download?: boolean) {
	const { result } = renderHook(() => useExportModel())
	const document = new Document()
	document.createBuffer()
	document.createScene('scene')
	return result.current.handleDocumentGltfExport(
		document,
		null,
		binary,
		download
	)
}

beforeEach(() => {
	vi.mocked(fileSaver.saveAs).mockClear()
})

describe('handleDocumentGltfExport', () => {
	it('returns the GLB without saving it when download is false', async () => {
		const result = await exportDocument(true, false)

		expect(result).toMatchObject({ format: 'glb' })
		expect(result?.data).toBeInstanceOf(Uint8Array)
		expect(fileSaver.saveAs).not.toHaveBeenCalled()
	})

	it('still saves the GLB by default', async () => {
		const result = await exportDocument(true)

		expect(result).toBeUndefined()
		expect(fileSaver.saveAs).toHaveBeenCalledWith(expect.any(Blob), 'model.glb')
	})

	it('returns the glTF without saving it when download is false', async () => {
		const result = await exportDocument(false, false)

		expect(result).toMatchObject({ format: 'gltf' })
		expect(fileSaver.saveAs).not.toHaveBeenCalled()
	})
})
