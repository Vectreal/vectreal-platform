/**
 * Which stored asset each reference in a saved scene means.
 *
 * THE ROUTE THE EMBED TAKES, which had no test and its own rule. A saved scene
 * is read two ways: the editor rebuilds it into files and goes through
 * `loadGLTFWithAssets`, while the embed and the dashboard viewer hand the JSON
 * and the bytes to `parseGLTFJsonToThreeJS`. The second built its own lookup by
 * pouring every spelling of every asset name into one map, last writer winning,
 * so the two routes disagreed about the same scene.
 *
 * Mutation gates, all executed:
 *  - key `byKey` with `name` instead of `resolutionKey(name)` and
 *    `folds two names that differ only by separator into one asset` goes red.
 *    Matching is unaffected, because `referenceIn` normalizes candidate keys
 *    itself - what the call decides is which names are the *same* name, and so
 *    which end a collision resolves at;
 *  - drop the `referenceIn` call for a direct `byKey.get(uri)` and
 *    `reaches a legacy flat name from a foldered URI` goes red;
 *  - remove the `data:` skip in `referencedUris` and
 *    `leaves an embedded data URI to carry its own bytes` goes red;
 *  - put the name-only rung's early exit back to `name === tail` and
 *    `reaches a file the reference climbs out of the model folder to find`
 *    goes red.
 */
import { describe, expect, it } from 'vitest'

import { referencedAssetNames, referencedUris } from './referenced-assets'

const referencing = (...uris: string[]) => ({
	images: uris.map((uri) => ({ uri }))
})

describe('which asset a saved scene means', () => {
	it('keeps two same-named textures in sibling folders apart', () => {
		expect(
			referencedAssetNames(
				referencing('body/diffuse.png', 'wheels/diffuse.png'),
				['body/diffuse.png', 'wheels/diffuse.png']
			)
		).toEqual(
			new Map([
				['body/diffuse.png', 'body/diffuse.png'],
				['wheels/diffuse.png', 'wheels/diffuse.png']
			])
		)
	})

	it('reaches a legacy flat name from a foldered URI', () => {
		/*
		  Every scene saved before assets carried their folders has flat names
		  against a glTF full of folder URIs. That pair has to keep resolving.
		*/
		expect(
			referencedAssetNames(referencing('body/diffuse.png'), ['diffuse.png'])
		).toEqual(new Map([['body/diffuse.png', 'diffuse.png']]))
	})

	it('folds two names that differ only by separator into one asset', () => {
		/*
		  `normalizeAssetUri` keeps a backslash, so a scene can hold two stored
		  names that are one name once separators are folded. The map has to
		  collapse them the way every other map on this path does - keeping the
		  last - or the embed answers with one and the byte gate with the other.
		*/
		expect(
			referencedAssetNames(referencing('tex/wood.png'), [
				'tex\\wood.png',
				'tex/wood.png'
			])
		).toEqual(new Map([['tex/wood.png', 'tex/wood.png']]))
	})

	it('reaches a file the reference climbs out of the model folder to find', () => {
		/*
		  A glTF sitting in `model/` with its `.bin` and textures one folder up
		  writes `../scene.bin`, and that URI survives into the saved document.
		  A saved scene's model path is a bare name, so there is no directory to
		  climb from - the certain rung refuses outright, and the name-only rung
		  used to skip the reference too, on the grounds that the certain rung
		  had already offered the folderless keys. It had offered nothing. For an
		  image that was a missing texture; for `buffers[0]` the scene did not
		  parse at all.
		*/
		expect(
			referencedAssetNames(
				{
					images: [{ uri: '../diffuse.png' }],
					buffers: [{ uri: '../scene.bin' }]
				},
				['diffuse.png', 'scene.bin']
			)
		).toEqual(
			new Map([
				['../diffuse.png', 'diffuse.png'],
				['../scene.bin', 'scene.bin']
			])
		)
	})

	it('still refuses a climbing reference two assets answer equally', () => {
		expect(
			referencedAssetNames(referencing('../diffuse.png'), [
				'body/diffuse.png',
				'wheels/diffuse.png'
			])
		).toEqual(new Map())
	})

	it('answers a Windows-authored URI', () => {
		expect(
			referencedAssetNames(referencing('Tex\\Wood.png'), ['tex/wood.png'])
		).toEqual(new Map([['Tex\\Wood.png', 'tex/wood.png']]))
	})

	it('refuses a reference two stored assets answer equally', () => {
		/*
		  The bare name names both. Answering with either is how the embed came
		  to render one texture twice; the entry is left out, and the loader asks
		  the site for the name rather than being handed the wrong bytes.
		*/
		expect(
			referencedAssetNames(referencing('diffuse.png'), [
				'body/diffuse.png',
				'wheels/diffuse.png'
			])
		).toEqual(new Map())
	})

	it('leaves an embedded data URI to carry its own bytes', () => {
		expect(referencedUris(referencing('data:image/png;base64,AAAA'))).toEqual(
			new Set()
		)
	})

	it('collects buffers as well as images', () => {
		expect(
			referencedUris({
				images: [{ uri: 'tex/wood.png' }],
				buffers: [{ uri: 'scene.bin' }]
			})
		).toEqual(new Set(['tex/wood.png', 'scene.bin']))
	})
})
