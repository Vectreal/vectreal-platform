/**
 * What a reference is normalized to before anything looks it up.
 *
 * This module answers "what spelling is this name", and nothing more. Which
 * *file* a reference resolves to is a different question with a different
 * owner, `model-loader/dropped-selection.ts`, and it is asked in that module's
 * spec: not which keys exist, but which file you get, and what happens when two
 * of them answer equally. `buildAssetLookupKeys` below produces a set of
 * spellings ending in the bare basename, which is why it is confined to the
 * server frame - it cannot say that two files answered equally.
 */
import { describe, expect, it } from 'vitest'

import { normalizeAssetUri } from './index'

/**
 * Mutation gate, executed: removing the `try`/`catch` from `normalizeAssetUri`
 * reddens both of the malformed cases below, and dropping the `./` strip from
 * the catch branch reddens the last one alone.
 */
describe('a reference is normalized, or returned as it came', () => {
	it('decodes an escape the way a glTF writes one', () => {
		expect(normalizeAssetUri('textures/red%20wood.png')).toBe(
			'textures/red wood.png'
		)
	})

	it('strips a leading ./ so both spellings match', () => {
		expect(normalizeAssetUri('./diffuse.png')).toBe('diffuse.png')
	})

	it('hands back a file name holding a bare percent sign', () => {
		/*
		  The case that took a whole load down. `%` followed by anything but two
		  hex digits is a malformed escape and `decodeURIComponent` throws
		  `URIError` on it, which escaped into `loadGltfModel`'s catch and
		  reached the reader as "Check it is a valid glTF." about a folder that
		  was entirely valid.

		  This name arrives from disk, not from the glTF, which is why encoding
		  the URI correctly was never a way out: `buildAssetLookupKeys`
		  normalizes `File.name` too.
		*/
		expect(normalizeAssetUri('50% roughness.png')).toBe('50% roughness.png')
	})

	it('still strips a leading ./ from a name it could not decode', () => {
		expect(normalizeAssetUri('./50% roughness.png')).toBe('50% roughness.png')
	})
})
