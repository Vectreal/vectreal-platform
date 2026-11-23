import { describe, expect, it } from 'vitest'

import {
	readUnreadableSelection,
	unreadableSelectionOf
} from './unreadable-selection'

import type { StructuredLoadError } from './types'

describe('readUnreadableSelection', () => {
	it.each([
		[['IMG_0001.JPG', 'IMG_0002.heic', 'side.png']],
		[['front.jpeg', 'back.HEIF', 'top.webp']]
	])('reads a selection of nothing but pictures as photos: %j', (names) => {
		expect(readUnreadableSelection(names)).toEqual({ kind: 'photos' })
	})

	it('does not read photos beside anything else as photos', () => {
		expect(readUnreadableSelection(['front.jpg', 'notes.txt'])).toBeNull()
	})

	it('names a Blender file, whatever came with it', () => {
		expect(
			readUnreadableSelection(['chair/wood.png', 'chair/Chair.blend'])
		).toEqual({ kind: 'blender', fileName: 'Chair.blend' })
	})

	it("reads Blender's own backups as Blender files", () => {
		expect(readUnreadableSelection(['chair.blend1'])).toEqual({
			kind: 'blender',
			fileName: 'chair.blend1'
		})
	})

	it('names an archive', () => {
		expect(readUnreadableSelection(['model.ZIP'])).toEqual({
			kind: 'archive',
			fileName: 'model.ZIP'
		})
	})

	it('says nothing about a selection it does not recognize', () => {
		expect(readUnreadableSelection(['notes.txt'])).toBeNull()
		expect(readUnreadableSelection([])).toBeNull()
	})
})

describe('unreadableSelectionOf', () => {
	const refusal = (code: StructuredLoadError['code']): StructuredLoadError => ({
		code,
		message: '',
		recoverable: true,
		source: 'local-upload',
		context: { selection: { kind: 'photos' } }
	})

	it('reads the selection off an unsupported_format refusal', () => {
		expect(unreadableSelectionOf(refusal('unsupported_format'))).toEqual({
			kind: 'photos'
		})
	})

	it('reads nothing off any other error', () => {
		expect(unreadableSelectionOf(refusal('multiple_models'))).toBeNull()
		expect(unreadableSelectionOf(null)).toBeNull()
	})
})
