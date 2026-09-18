/**
 * What the GLTFLoader gets back when it asks for a file.
 *
 * THIS SPEC USED TO ENCODE THE DEFECT. It asserted that the resolver falls back
 * to the decoded spelling and then to the bare basename, which is what let
 * `assets/deep/wood.webp` be answered by a `wood.webp` registered from
 * somewhere else entirely - two files called `diffuse.png` in sibling folders
 * answering for one another, on the route the published embed takes.
 *
 * The guessing moved to where it can be done once and properly:
 * `parseGLTFJsonToThreeJS` resolves each referenced URI through
 * `referencedAssetNames` and registers it under the spelling the loader will
 * ask for. So the resolver is a direct lookup, and the cases below are about
 * what it must NOT do.
 */
import { resolveModifiedUrl } from '@vctrl/core'

describe('resolveModifiedUrl', () => {
	const map = new Map([
		['model.bin', 'blob:a'],
		['./textures/wood.webp', 'blob:b']
	])

	it('answers the spelling it was registered under', () => {
		expect(resolveModifiedUrl(map, 'model.bin')).toBe('blob:a')
		expect(resolveModifiedUrl(map, './textures/wood.webp')).toBe('blob:b')
	})

	it('does not answer one file with another that shares its basename', () => {
		expect(resolveModifiedUrl(map, 'assets/deep/wood.webp')).toBe(
			'assets/deep/wood.webp'
		)
	})

	it('does not guess at a spelling nobody registered', () => {
		/*
		  `textures/wood.webp` is a real file here under `./textures/wood.webp`,
		  and this still declines - because the registration comes from the glTF's
		  own URI, so a request in a spelling the document never wrote is a
		  request for something else.
		*/
		expect(resolveModifiedUrl(map, 'textures%2Fwood.webp')).toBe(
			'textures%2Fwood.webp'
		)
	})

	it('passes an unknown url through untouched', () => {
		expect(resolveModifiedUrl(map, 'data:image/png;base64,xx')).toBe(
			'data:image/png;base64,xx'
		)
		expect(resolveModifiedUrl(map, 'https://cdn/x.png')).toBe(
			'https://cdn/x.png'
		)
	})
})
