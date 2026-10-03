import { createStore } from 'jotai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	dismissSavePanelAtom,
	dispatchSaveProgressAtom,
	savePanelAtom
} from './save-progress-store'

const created: string[] = []
const revoked: string[] = []

vi.stubGlobal('URL', {
	...URL,
	createObjectURL: () => {
		const url = `blob:preview-${created.length + 1}`
		created.push(url)
		return url
	},
	revokeObjectURL: (url: string) => revoked.push(url)
})

afterEach(() => {
	created.length = 0
	revoked.length = 0
})

const addImage = (store: ReturnType<typeof createStore>, key: string) =>
	store.set(dispatchSaveProgressAtom, {
		type: 'file-added',
		file: {
			key,
			group: 'model',
			name: key,
			bytes: 1,
			preview: new Blob([new Uint8Array([1])])
		}
	})

describe('save progress store', () => {
	it('holds a preview as a URL, never as the bytes', () => {
		const store = createStore()
		store.set(dispatchSaveProgressAtom, { type: 'preparing' })
		addImage(store, 'a.png')

		const [file] = store.get(savePanelAtom)?.files ?? []
		expect(file.previewUrl).toBe('blob:preview-1')
		expect(file).not.toHaveProperty('preview')
	})

	it("revokes the last save's previews when the next one starts", () => {
		const store = createStore()
		store.set(dispatchSaveProgressAtom, { type: 'preparing' })
		addImage(store, 'a.png')

		store.set(dispatchSaveProgressAtom, { type: 'preparing' })

		expect(revoked).toEqual(['blob:preview-1'])
	})

	it('revokes the previews and clears the panel on dismiss', () => {
		const store = createStore()
		store.set(dispatchSaveProgressAtom, { type: 'preparing' })
		addImage(store, 'a.png')

		store.set(dismissSavePanelAtom)

		expect(revoked).toEqual(['blob:preview-1'])
		expect(store.get(savePanelAtom)).toBeNull()
	})
})
