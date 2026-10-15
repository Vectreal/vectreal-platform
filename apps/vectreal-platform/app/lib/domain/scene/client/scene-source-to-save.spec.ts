/**
 * What a save does with the scene's original. Getting this wrong either loses
 * the original (it is unlinked and reclaimed) or replaces it with an optimized
 * copy, and neither can be undone from the publisher.
 */
import { describe, expect, it } from 'vitest'

import {
	canCompareWithSource,
	derivesFromSavedVersion,
	recordSavedOriginal,
	resolveSourceToSave
} from './scene-source-to-save'
import {
	originalPreset,
	smallestPreset
} from '../../../../constants/optimizations'
import { MAX_STORED_FILE_BYTES } from '../../../../constants/utility-constants'

const SOURCE = new Uint8Array([1, 2, 3])
const STORED = {
	assetId: 'original-1',
	url: '/api/scenes/s1/assets/original-1',
	fileName: 'source.glb',
	mimeType: 'model/gltf-binary',
	byteSize: 3
}

const resolve = (
	overrides: Partial<Parameters<typeof resolveSourceToSave>[0]> = {}
) =>
	resolveSourceToSave({
		keep: true,
		stored: null,
		sourceSettings: originalPreset,
		derivedFrom: smallestPreset,
		source: SOURCE,
		...overrides
	})

describe('resolveSourceToSave', () => {
	it('sends the upload an optimized document was derived from', () => {
		expect(resolve()).toEqual({ kind: 'upload', bytes: SOURCE })
	})

	it('keeps none when the author chose not to', () => {
		expect(resolve({ keep: false })).toEqual({ kind: 'none' })
		expect(resolve({ keep: false, stored: STORED })).toEqual({ kind: 'none' })
	})

	// Storage refuses a file this large, and the refusal would fail the
	// whole save, model included.
	it('keeps none of an original too large for storage to take', () => {
		const tooLarge = { byteLength: MAX_STORED_FILE_BYTES + 1 } as Uint8Array
		const fits = { byteLength: MAX_STORED_FILE_BYTES } as Uint8Array

		expect(resolve({ source: tooLarge })).toEqual({ kind: 'none' })
		expect(resolve({ source: fits })).toEqual({ kind: 'upload', bytes: fits })
	})

	it('keeps none while the document is the original itself', () => {
		expect(resolve({ derivedFrom: originalPreset })).toEqual({ kind: 'none' })
	})

	// A reopened scene saved without its original: its source is that saved,
	// optimized version, and storing it as "the original" would be false.
	it('never calls a saved, optimized source the original', () => {
		expect(
			resolve({ sourceSettings: smallestPreset, derivedFrom: smallestPreset })
		).toEqual({ kind: 'none' })
	})

	// Until the first pass loads it, the optimizer's source is the saved
	// document; sending that would replace the original with an optimized copy.
	it('re-links a stored original rather than sending the source', () => {
		expect(
			resolve({
				stored: STORED,
				sourceSettings: smallestPreset,
				derivedFrom: smallestPreset
			})
		).toEqual({ kind: 'linked', source: STORED })
	})
})

describe('derivesFromSavedVersion', () => {
	it('is false while a stored original can still become the source', () => {
		expect(
			derivesFromSavedVersion({
				stored: STORED,
				unreadable: false,
				sourceSettings: smallestPreset
			})
		).toBe(false)
	})

	it('is true once the stored original could not be read', () => {
		expect(
			derivesFromSavedVersion({
				stored: STORED,
				unreadable: true,
				sourceSettings: smallestPreset
			})
		).toBe(true)
	})

	it('is true for a scene saved without its original', () => {
		expect(
			derivesFromSavedVersion({
				stored: null,
				unreadable: false,
				sourceSettings: smallestPreset
			})
		).toBe(true)
	})

	it('is false once the source is the original', () => {
		expect(
			derivesFromSavedVersion({
				stored: null,
				unreadable: false,
				sourceSettings: originalPreset
			})
		).toBe(false)
	})
})

describe('recordSavedOriginal', () => {
	const before = {
		keep: true,
		stored: STORED,
		saved: false,
		unreadable: false
	}
	const kept = {
		assetId: 'original-9',
		url: '/api/scenes/s2/assets/original-9'
	}

	it('reads a stored original back from where the save left it', () => {
		expect(recordSavedOriginal(before, kept)).toEqual({
			...before,
			saved: true,
			stored: { ...STORED, assetId: 'original-9', url: kept.url }
		})
	})

	it('records that a save kept no original, and forgets the stored one', () => {
		expect(recordSavedOriginal({ ...before, saved: true }, null)).toEqual({
			...before,
			saved: false,
			stored: null
		})
	})

	it('records a kept original the optimizer already holds as saved', () => {
		expect(recordSavedOriginal({ ...before, stored: null }, kept)).toEqual({
			...before,
			saved: true,
			stored: null
		})
	})
})

describe('canCompareWithSource', () => {
	const settled = {
		isOpen: true,
		isPending: false,
		isLoadingOriginal: false,
		isSaving: false,
		sourceSettings: originalPreset,
		derivedFrom: smallestPreset
	}

	it('compares a document derived from its source while the drawer is settled', () => {
		expect(canCompareWithSource(settled)).toBe(true)
	})

	it('has nothing to compare while the document is its source', () => {
		expect(
			canCompareWithSource({ ...settled, derivedFrom: originalPreset })
		).toBe(false)
	})

	it('waits out a pass, the original loading, and a closed drawer', () => {
		expect(canCompareWithSource({ ...settled, isPending: true })).toBe(false)
		expect(canCompareWithSource({ ...settled, isLoadingOriginal: true })).toBe(
			false
		)
		expect(canCompareWithSource({ ...settled, isOpen: false })).toBe(false)
	})

	// A save captures whatever model is mounted for its thumbnail and bake.
	it('never compares while a save is in flight', () => {
		expect(canCompareWithSource({ ...settled, isSaving: true })).toBe(false)
	})
})
