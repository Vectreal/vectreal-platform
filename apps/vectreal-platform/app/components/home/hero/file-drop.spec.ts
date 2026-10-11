// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { attachFileDrop } from './file-drop'
import { createHeroStore, fallBackToPoster } from './hero-store'
import { HERO_MODEL } from '../../../lib/samples/sample-models'

function drag(type: string, files: File[] = [], types = ['Files']) {
	const event = new Event(type, { bubbles: true, cancelable: true })
	Object.defineProperty(event, 'dataTransfer', { value: { types, files } })
	return event
}

function setup(busy = false) {
	const sheet = document.createElement('div')
	const store = createHeroStore()
	store.set({ status: 'drawn', busy })
	const onFiles = vi.fn()
	const detach = attachFileDrop(sheet, store, onFiles)
	return { sheet, store, onFiles, detach }
}

describe('attachFileDrop', () => {
	it('shows dragging while files hover, then restores the status before', () => {
		const { sheet, store } = setup()

		sheet.dispatchEvent(drag('dragenter'))
		sheet.dispatchEvent(drag('dragenter'))
		expect(store.get().status).toBe('dragging')
		expect(sheet.hasAttribute('data-dragging')).toBe(true)

		sheet.dispatchEvent(drag('dragleave'))
		expect(store.get().status).toBe('dragging')
		sheet.dispatchEvent(drag('dragleave'))
		expect(store.get().status).toBe('drawn')
		expect(sheet.hasAttribute('data-dragging')).toBe(false)
	})

	it('hands dropped files over and claims the drop', () => {
		const { sheet, store, onFiles } = setup()
		const file = new File(['x'], 'a.glb')

		sheet.dispatchEvent(drag('dragenter'))
		const drop = drag('drop', [file])
		sheet.dispatchEvent(drop)

		expect(drop.defaultPrevented).toBe(true)
		expect(onFiles).toHaveBeenCalledWith([file])
		expect(store.get().status).toBe('drawn')
	})

	it('claims but ignores files while the stage is busy', () => {
		const { sheet, store, onFiles } = setup(true)

		const enter = drag('dragenter')
		sheet.dispatchEvent(enter)
		expect(sheet.hasAttribute('data-dragging')).toBe(false)
		expect(store.get().status).toBe('drawn')
		const drop = drag('drop', [new File(['x'], 'a.glb')])
		sheet.dispatchEvent(drop)

		expect(enter.defaultPrevented).toBe(true)
		expect(drop.defaultPrevented).toBe(true)
		expect(onFiles).not.toHaveBeenCalled()
	})

	it('claims files dragged over it, so a drop is allowed', () => {
		const { sheet } = setup()

		const over = drag('dragover')
		sheet.dispatchEvent(over)
		const plain = drag('dragover', [], ['text/plain'])
		sheet.dispatchEvent(plain)

		expect(over.defaultPrevented).toBe(true)
		expect(plain.defaultPrevented).toBe(false)
	})

	it('claims but ignores a drop that never entered', () => {
		const { sheet, onFiles } = setup()

		const drop = drag('drop', [new File(['x'], 'a.glb')])
		sheet.dispatchEvent(drop)

		expect(drop.defaultPrevented).toBe(true)
		expect(onFiles).not.toHaveBeenCalled()
	})

	it('leaves drags without files to the browser', () => {
		const { sheet, store } = setup()

		const enter = drag('dragenter', [], ['text/plain'])
		sheet.dispatchEvent(enter)

		expect(enter.defaultPrevented).toBe(false)
		expect(store.get().status).toBe('drawn')
	})

	it('ends a drag in progress and stops listening when detached', () => {
		const { sheet, store, detach } = setup()

		sheet.dispatchEvent(drag('dragenter'))
		detach()
		expect(store.get().status).toBe('drawn')
		expect(sheet.hasAttribute('data-dragging')).toBe(false)

		sheet.dispatchEvent(drag('dragenter'))
		expect(store.get().status).toBe('drawn')
	})
})

describe('fallBackToPoster', () => {
	it('inks the poster whole and describes it as drawn', () => {
		const store = createHeroStore()
		const frame = document.createElement('div')

		fallBackToPoster(store, frame)

		expect(frame.style.getPropertyValue('--plot')).toBe('1')
		expect(store.get()).toMatchObject({
			status: 'drawn',
			busy: false,
			shownBytes: HERO_MODEL.bytes
		})
	})
})
