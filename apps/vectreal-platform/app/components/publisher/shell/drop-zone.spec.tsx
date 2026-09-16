// @vitest-environment jsdom
/**
 * The only way into the product that is not a drag.
 *
 * Every entry point in the app converges on this screen, and it held a single
 * file input carrying `webkitdirectory`. That attribute does not filter a
 * dialog, it replaces it: the browser opens a directory chooser and ignores
 * `accept`. So the button reading "Choose Files" could not choose a file, and
 * the single-file case was reachable only by dragging.
 *
 * These assert the two shapes a model arrives in, separately, because one input
 * cannot serve both.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DropZone } from './drop-zone'

beforeEach(() => {
	/* jsdom has no matchMedia; `useAcceptPattern` reads it through `useIsMobile`. */
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}))
})

function renderDropZone(onUpload = vi.fn().mockResolvedValue(undefined)) {
	const view = render(
		<MemoryRouter>
			<DropZone onUpload={onUpload} />
		</MemoryRouter>
	)

	const inputs = Array.from(
		view.container.querySelectorAll<HTMLInputElement>('input[type="file"]')
	)

	return {
		onUpload,
		inputs,
		fileInput: inputs.find((input) => !input.hasAttribute('webkitdirectory')),
		directoryInput: inputs.find((input) =>
			input.hasAttribute('webkitdirectory')
		)
	}
}

describe('choosing a model', () => {
	it('offers an input that opens a file dialog', () => {
		const { fileInput } = renderDropZone()

		expect(fileInput).toBeDefined()
		// `accept` is only honored by a dialog that is not a directory chooser.
		expect(fileInput?.getAttribute('accept')).toContain('.glb')
	})

	it('still offers an input that opens a directory dialog', () => {
		const { directoryInput } = renderDropZone()

		expect(directoryInput).toBeDefined()
	})

	it('opens the file dialog from the primary button, not the directory one', () => {
		const { fileInput, directoryInput } = renderDropZone()

		const openedFile = vi.fn()
		const openedDirectory = vi.fn()
		fileInput?.addEventListener('click', openedFile)
		directoryInput?.addEventListener('click', openedDirectory)

		screen.getByRole('button', { name: /choose a file/i }).click()

		expect(openedFile).toHaveBeenCalledTimes(1)
		expect(openedDirectory).not.toHaveBeenCalled()
	})

	it('opens the directory dialog only from the folder control', () => {
		const { fileInput, directoryInput } = renderDropZone()

		const openedFile = vi.fn()
		const openedDirectory = vi.fn()
		fileInput?.addEventListener('click', openedFile)
		directoryInput?.addEventListener('click', openedDirectory)

		screen.getByRole('button', { name: /choose a folder/i }).click()

		expect(openedDirectory).toHaveBeenCalledTimes(1)
		expect(openedFile).not.toHaveBeenCalled()
	})

	it('uploads the chosen file', () => {
		const { fileInput, onUpload } = renderDropZone()
		const file = new File(['glb'], 'chair.glb', { type: 'model/gltf-binary' })

		Object.defineProperty(fileInput, 'files', {
			configurable: true,
			value: [file]
		})
		fileInput?.dispatchEvent(new Event('change', { bubbles: true }))

		expect(onUpload).toHaveBeenCalledWith([file])
	})

	/*
	  A file input fires no change event when the selection is identical, so
	  without clearing the value a second attempt at the same model after a
	  refusal did nothing at all.
	*/
	it('clears its value so the same file can be chosen again', () => {
		const { fileInput } = renderDropZone()
		const file = new File(['glb'], 'chair.glb', { type: 'model/gltf-binary' })

		Object.defineProperty(fileInput, 'files', {
			configurable: true,
			value: [file]
		})
		fileInput?.dispatchEvent(new Event('change', { bubbles: true }))

		expect(fileInput?.value).toBe('')
	})
})
