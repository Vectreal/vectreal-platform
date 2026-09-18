/**
 * The accepted-format set, asserted where it is stated.
 *
 * These are the owner's own rules. What makes them worth having is the tests
 * elsewhere that read the same module: the file input's accept pattern, the
 * loader's dispatch and the `multiple_models` guard all derive from it now, so
 * removing a format here turns all three red. Before this module they were
 * three independent lists and removing a format from any one of them turned
 * nothing red at all.
 */
import { describe, expect, it } from 'vitest'

import {
	BUNDLE_FORMAT_IDS,
	EXPORTABLE_FORMAT_IDS,
	IMPORTABLE_FORMAT_IDS,
	MODEL_FORMATS,
	MODEL_FORMAT_IDS,
	type ModelFormat,
	isImportableFileName,
	modelAcceptPattern,
	modelFormat,
	modelFormatForFileName
} from './model-formats'

describe('a file name resolves to at most one format', () => {
	it.each([
		['scene.glb', 'glb'],
		['scene.gltf', 'gltf'],
		['scene.usdz', 'usdz']
	])('reads %s as %s', (fileName, expected) => {
		expect(modelFormatForFileName(fileName)?.id).toBe(expected)
	})

	it.each([
		'._chair.gltf',
		'._MODEL.GLB',
		'chair/textures/._preview.gltf',
		'models\\._chair.gltf'
	])('does not read the AppleDouble sidecar %s as a model', (fileName) => {
		/*
		  A resource fork named after the file it shadows, so it ends in that
		  file's extension. It arrives whenever a folder comes off exFAT or out
		  of an unzipped macOS archive, and it cost twice: `findImportableModels`
		  keeps the FIRST file of each format, so a 4 KB metadata blob could be
		  handed to the loader as the model; and the dropped-selection rule reads
		  "does this root hold a model of its own" from this same answer, so a
		  sidecar sitting in a shared `textures/` folder made it look like a
		  second export and the real export's textures were refused.

		  The third name carries its folders, because that is how the selection
		  rule asks - the answer must not depend on which spelling arrives.
		*/
		expect(modelFormatForFileName(fileName)).toBeNull()
	})

	/*
	  THE DEFECT THIS MODULE WAS WRITTEN TO END.

	  `findByExtension` in `@vctrl/hooks` matched `file.name.endsWith('.glb')`
	  raw while `getFileType` in the loader lower-cased first, so a file named
	  `MODEL.GLB` - which is what Windows and plenty of exporters produce - was
	  refused as an unsupported format by the dispatch, and the loader that
	  would have read it fine was never reached. Extending a case-sensitive
	  matcher to STL, FBX and OBJ multiplies that by six.

	  Mutation gate: drop `toLowerCase()` from `modelFormatForFileName` and the
	  five case-varied names below go red. `.glb` and `model.tar.glb` survive
	  that one and are here for different mutations - `dot <= 0` instead of
	  `dot < 0` reddens the dotfile, and `indexOf` instead of `lastIndexOf`
	  reddens the multi-dot name.
	*/
	it.each([
		'model.glb',
		'.glb',
		'model.tar.glb',
		'MODEL.GLB',
		'Model.Glb',
		'scene.GLTF',
		'UPPER.CASE.NAME.GLB'
	])('reads %s whatever case it is written in', (fileName) => {
		expect(modelFormatForFileName(fileName)).not.toBeNull()
		expect(isImportableFileName(fileName)).toBe(true)
	})

	/*
	  A format the owner knows and the loader cannot read. `modelFormatForFileName`
	  does not consult `canImport` and must not start: the dispatch still needs to
	  identify a USDZ in order to refuse it by name rather than handing it to a
	  glTF reader and reporting whatever that throws. The two answers pull apart
	  here and nowhere else, which is why this is its own case rather than a row
	  removed from the list above.
	*/
	it.each(['Scene.UsdZ', 'model.usdz', 'MODEL.USDZ'])(
		'identifies %s but does not offer to import it',
		(fileName) => {
			expect(modelFormatForFileName(fileName)?.id).toBe('usdz')
			expect(isImportableFileName(fileName)).toBe(false)
		}
	)

	/*
	  `glb`, `gltf` and `USDZ` are the regression: `split('.').pop()` on a name
	  with no dot returns the whole name, so a file called exactly `glb` read as
	  a GLB - which is worse than it sounds, because a stray extension-less file
	  beside a real model turns a working load into "Multiple models found".
	  `.glb` is in the matching list above: a dotfile named for a format has
	  always matched, and that did not change.
	*/
	it.each([
		'notes.txt',
		'texture.png',
		'archive.zip',
		'noextension',
		'glb',
		'gltf',
		'USDZ'
	])('reads %s as no format at all', (fileName) => {
		expect(modelFormatForFileName(fileName)).toBeNull()
		expect(isImportableFileName(fileName)).toBe(false)
	})

	it('reads a sibling of a bundle as no format', () => {
		// `.bin` and the image extensions are offered by the picker so a glTF
		// arrives whole. They are not formats and nothing may dispatch on them.
		for (const sibling of ['buffer.bin', 'base.png', 'normal.jpg']) {
			expect(modelFormatForFileName(sibling)).toBeNull()
		}
	})
})

describe('the derived sets agree with the declarations they come from', () => {
	/*
	  Written out rather than mapped from `MODEL_FORMATS`.

	  `MODEL_FORMAT_IDS` *is* `MODEL_FORMATS.map((one) => one.id)`, so asserting
	  one against the other compares an expression with itself: adding, removing
	  or reordering a format moves both sides together and the test never fails.
	  The literal is the claim - these formats, in this order, because the order
	  is dispatch precedence and `gltf` leading is what makes a folder holding a
	  `.gltf` beside a `.glb` read as the bundle.
	*/
	it('lists exactly the six formats, gltf first', () => {
		expect(MODEL_FORMAT_IDS).toEqual([
			'gltf',
			'glb',
			'usdz',
			'stl',
			'fbx',
			'obj'
		])
	})

	it('gives every format a distinct extension', () => {
		const extensions = MODEL_FORMATS.map((one) => one.extension)
		expect(new Set(extensions).size).toBe(extensions.length)
	})

	it('writes every extension lower case and without a dot', () => {
		for (const format of MODEL_FORMATS) {
			expect(format.extension).toBe(format.extension.toLowerCase())
			expect(format.extension).not.toContain('.')
		}
	})

	/*
	  Same trap as above, three times: each of these sets is defined as exactly
	  the filter it was being compared against, so flipping `canExport` to false
	  on `usdz` dropped it from both sides and all three cases stayed green -
	  while the converter's entire target set, which derives from
	  `EXPORTABLE_FORMAT_IDS`, silently lost a format.
	*/
	it.each([
		[
			'importable',
			() => IMPORTABLE_FORMAT_IDS,
			['gltf', 'glb', 'stl', 'fbx', 'obj']
		],
		['exportable', () => EXPORTABLE_FORMAT_IDS, ['gltf', 'glb', 'usdz']],
		['bundle', () => BUNDLE_FORMAT_IDS, ['gltf', 'obj']]
	] as const)('reports %s as exactly these formats', (_name, ids, expected) => {
		expect(ids()).toEqual(expected)
	})

	it('only marks a format a bundle if it names siblings', () => {
		for (const format of MODEL_FORMATS) {
			expect(
				format.siblingExtensions.length > 0,
				`${format.id} is ${format.isBundle ? '' : 'not '}a bundle`
			).toBe(format.isBundle)
		}
	})

	it('refuses an id it does not have', () => {
		expect(() => modelFormat('step' as never)).toThrow(/Unknown model format/)
	})
})

describe('the accept pattern offers what the loader can read', () => {
	it('offers every importable format by extension and media type', () => {
		/*
		  Split on the comma and compare members, never `toContain`. The pattern
		  is one string, so a substring check passed for `.usdz` on the strength
		  of the media type `model/vnd.usdz+zip` alone - dropping the extension
		  entirely would have left this green, on the one format where it matters
		  most because iOS is the reason USDZ is offered at all.
		*/
		const parts = modelAcceptPattern().split(',')

		for (const format of MODEL_FORMATS) {
			if (!format.canImport) continue
			expect(parts, `${format.id} is importable`).toContain(
				`.${format.extension}`
			)
			for (const mimeType of format.mimeTypes) {
				expect(parts).toContain(mimeType)
			}
		}
	})

	it('offers the siblings a bundle needs', () => {
		// A `.gltf` picked without its `.bin` and images cannot be loaded, so a
		// picker that filters them out guarantees the failure it prevents.
		const parts = modelAcceptPattern().split(',')

		for (const format of MODEL_FORMATS) {
			for (const sibling of format.siblingExtensions) {
				expect(parts).toContain(`.${sibling}`)
			}
		}
	})

	it('offers nothing no format claims', () => {
		/*
		  The hand-written pattern this replaced listed `.usda`, which no loader
		  has ever read: the picker let the file through and the loader then
		  refused it. Every entry now traces to a declaration above.
		*/
		const claimed = new Set<string>()
		for (const format of MODEL_FORMATS) {
			if (!format.canImport) continue
			format.mimeTypes.forEach((one) => claimed.add(one))
			claimed.add(`.${format.extension}`)
			format.siblingExtensions.forEach((one) => claimed.add(`.${one}`))
		}

		for (const part of modelAcceptPattern().split(',')) {
			expect(claimed, `${part} is in the accept pattern`).toContain(part)
		}
	})

	it('repeats nothing', () => {
		const parts = modelAcceptPattern().split(',')
		expect(new Set(parts).size).toBe(parts.length)
	})

	/*
	  The two rules inside the builder that no real declaration reaches: every
	  format is importable today and only one has siblings, so a test over
	  `MODEL_FORMATS` alone leaves both unprotected. Deleting either one left
	  the whole suite green - and OBJ, named next in `file-loaders.ts`, arrives
	  with an MTL and images that overlap glTF's exactly.
	*/
	const fixture = (over: Partial<ModelFormat>): ModelFormat => ({
		id: 'glb',
		extension: 'glb',
		label: 'GLB',
		mimeTypes: [],
		canImport: true,
		canExport: true,
		isBundle: false,
		siblingExtensions: [],
		...over
	})

	it('offers a sibling two formats share exactly once', () => {
		const pattern = modelAcceptPattern([
			fixture({ id: 'gltf', extension: 'gltf', siblingExtensions: ['png'] }),
			fixture({ id: 'usdz', extension: 'usdz', siblingExtensions: ['png'] })
		])

		expect(pattern.split(',').filter((one) => one === '.png')).toHaveLength(1)
	})

	it('offers nothing for a format it cannot read', () => {
		const pattern = modelAcceptPattern([
			fixture({
				id: 'glb',
				extension: 'glb',
				mimeTypes: ['model/gltf-binary']
			}),
			fixture({
				id: 'usdz',
				extension: 'usdz',
				canImport: false,
				mimeTypes: ['model/vnd.usdz+zip'],
				siblingExtensions: ['usda']
			})
		])

		expect(pattern.split(',')).toEqual(['model/gltf-binary', '.glb'])
	})
})
