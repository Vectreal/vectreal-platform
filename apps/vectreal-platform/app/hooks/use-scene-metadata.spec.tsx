// @vitest-environment jsdom
/**
 * When the scene page's title and description drafts are reset.
 *
 * Every revalidation of the route hands back a new `scene` object, and a
 * publish toggle or any dashboard mutation elsewhere on the page triggers one.
 * The drafts used to reset on that identity, so an unrelated click discarded
 * whatever was being typed. They now reset only when the stored value they
 * edit changes, or the page moves to another scene.
 *
 * Mutation gates, executed: restoring the unconditional reset reddens every
 * case that keeps a draft; dropping the id check reddens the other-scene case;
 * dropping the save's `storedSceneRef` write reddens the after-save case.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSceneMetadata } from './use-scene-metadata'

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))

interface Scene {
	id: string
	name: string
	description: string | null
	thumbnailUrl: string | null
}

const stored: Scene = {
	id: 'scene-1',
	name: 'Camera',
	description: 'A lens',
	thumbnailUrl: null
}

function renderMetadata() {
	return renderHook(({ scene }) => useSceneMetadata(scene), {
		initialProps: { scene: { ...stored } }
	})
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('useSceneMetadata drafts', () => {
	it('keeps both drafts through a revalidation that changed neither', () => {
		const { result, rerender } = renderMetadata()

		act(() => {
			result.current.setNameDraft('Camera body')
			result.current.setDescriptionDraft('A lens and a body')
		})
		rerender({ scene: { ...stored, thumbnailUrl: 'https://cdn/t.webp' } })

		expect(result.current.nameDraft).toBe('Camera body')
		expect(result.current.descriptionDraft).toBe('A lens and a body')
		expect(result.current.isUnsaved).toBe(true)
		// The rest of the loader's copy still arrives.
		expect(result.current.scene.thumbnailUrl).toBe('https://cdn/t.webp')
	})

	it('resets only the draft whose stored value changed', () => {
		const { result, rerender } = renderMetadata()

		act(() => {
			result.current.setNameDraft('Camera body')
			result.current.setDescriptionDraft('A lens and a body')
		})
		rerender({ scene: { ...stored, name: 'Renamed elsewhere' } })

		expect(result.current.nameDraft).toBe('Renamed elsewhere')
		expect(result.current.descriptionDraft).toBe('A lens and a body')
	})

	it('resets both drafts when the page moves to another scene', () => {
		const { result, rerender } = renderMetadata()

		act(() => {
			result.current.setNameDraft('Camera body')
			result.current.setDescriptionDraft('A lens and a body')
		})
		rerender({ scene: { ...stored, id: 'scene-2' } })

		expect(result.current.nameDraft).toBe('Camera')
		expect(result.current.descriptionDraft).toBe('A lens')
	})

	it('keeps a draft typed after a save when the revalidation echoes it', async () => {
		const saved = { ...stored, name: 'Camera body' }
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({ success: true, data: { scene: saved } })
			)
		)
		const { result, rerender } = renderMetadata()

		act(() => {
			result.current.setNameDraft('Camera body')
		})
		await act(() => result.current.save())
		act(() => {
			result.current.setNameDraft('Camera body, black')
		})
		rerender({ scene: { ...saved } })

		expect(result.current.nameDraft).toBe('Camera body, black')
	})
})
