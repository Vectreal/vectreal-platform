/**
 * The dispatch: which loader a dropped selection reaches, and why.
 *
 * This is deliberately a test of `loadModelFromFiles` rather than of the
 * loaders it calls. A test that calls `loadGltfModel` directly proves the
 * loader parses and proves nothing about reachability, which is the #755 shape
 * the delivery skill records - a complete renderer no surface called. Every
 * assertion below enters through the function the drop zone enters through.
 *
 * Mutation gates, all executed:
 *  - remove `usdz` from `MODEL_FORMATS` and the usdz cases here go red, along
 *    with the accept-pattern and owner specs;
 *  - make `modelFormatForFileName` case-sensitive again and `MODEL.GLB` goes
 *    red here as well as in the owner's own spec;
 *  - delete the `format.isBundle` branch and the glTF sibling case goes red;
 *  - drop the `withDroppedPath` call in `expandDirectories` and two of the four
 *    dropped-path cases go red, `adopts the path react-dropzone computed` and
 *    `keeps two same-named files in sibling folders apart`. The other two assert
 *    the *absence* of a written path, which removing the writer cannot disturb.
 *    Nothing outside this file moves, so the downstream lookups that rely on
 *    those paths are gated where they live, not here.
 */
import { missingAssetsError } from '@vctrl/core/model-loader'
import { describe, expect, it, vi } from 'vitest'

import { loadModelFromFiles } from './file-loaders'

import type { LoadContext } from './load-context'
import type { StructuredLoadError } from './types'

function file(name: string, bytes = 'x'): File {
	return new File([bytes], name)
}

/**
 * A file as react-dropzone hands it over: the path on `relativePath`, and
 * `webkitRelativePath` untouched, because no `<input webkitdirectory>` was
 * involved. The leading slash is `file-selector`'s, from the directory handle
 * it walked or the drag entry's `fullPath`.
 */
function dropped(name: string, relativePath: string): File {
	const dropped = file(name)
	Object.defineProperty(dropped, 'relativePath', {
		value: relativePath,
		configurable: true,
		enumerable: true
	})
	return dropped
}

/**
 * What `ModelLoader` hands back for a format it read through three.js: the GLB
 * it converted the file into. Distinct from the file's own bytes on purpose,
 * because telling the two apart is the whole assertion.
 */
const CONVERTED_GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00])

/** The extensions `ModelLoader` reads through three.js and re-serializes. */
const BRIDGED = ['.stl', '.fbx', '.obj']

function context() {
	const loadToThreeJS = vi.fn(async (input: File, _siblings?: File[]) => ({
		scene: { name: input.name },
		animations: [],
		document: {},
		glbBytes: BRIDGED.some((extension) =>
			input.name.toLowerCase().endsWith(extension)
		)
			? CONVERTED_GLB
			: undefined
	}))

	const loadGLTFWithAssetsToThreeJS = vi.fn(
		async (gltfFile: File, assetFiles: File[]) => ({
			scene: { name: gltfFile.name, assetCount: assetFiles.length },
			animations: [],
			document: {}
		})
	)

	const publish = vi.fn()
	const loadFromGlbBuffer = vi.fn(async () => undefined)

	const ctx = {
		modelLoader: { loadToThreeJS, loadGLTFWithAssetsToThreeJS },
		/* Ingestion is opt-in: most cases below are about dispatch alone. */
		optimizer: undefined,
		publish,
		onProgress: vi.fn()
	} as unknown as LoadContext

	const withOptimizer = {
		...ctx,
		optimizer: { loadFromGlbBuffer }
	} as unknown as LoadContext

	return {
		ctx,
		withOptimizer,
		loadToThreeJS,
		loadGLTFWithAssetsToThreeJS,
		publish,
		loadFromGlbBuffer
	}
}

async function loadError(files: File[]): Promise<StructuredLoadError> {
	const { ctx } = context()
	try {
		await loadModelFromFiles(files, ctx)
	} catch (error) {
		return error as StructuredLoadError
	}
	throw new Error('expected the load to be refused')
}

describe('a single model reaches the loader for its format', () => {
	it.each(['model.glb', 'model.usdz', 'part.stl', 'part.fbx'])(
		'sends %s to the binary loader',
		async (name) => {
			const { ctx, loadToThreeJS, loadGLTFWithAssetsToThreeJS } = context()

			const loaded = await loadModelFromFiles([file(name)], ctx)

			expect(loadToThreeJS).toHaveBeenCalledOnce()
			expect(loadGLTFWithAssetsToThreeJS).not.toHaveBeenCalled()
			expect(loaded.file.name).toBe(name)
		}
	)

	it('reports the format it dispatched on, not the one it guessed', async () => {
		const { ctx } = context()

		expect((await loadModelFromFiles([file('model.glb')], ctx)).file.type).toBe(
			'glb'
		)
		expect(
			(await loadModelFromFiles([file('model.usdz')], ctx)).file.type
		).toBe('usdz')
		expect((await loadModelFromFiles([file('part.stl')], ctx)).file.type).toBe(
			'stl'
		)
		expect((await loadModelFromFiles([file('part.fbx')], ctx)).file.type).toBe(
			'fbx'
		)
	})

	/*
	  THE LIVE DEFECT. `findByExtension` matched `name.endsWith('.glb')` raw,
	  so an upper-case extension matched no format, `modelFiles` came back empty
	  and the visitor was told their GLB was not a supported model - by the code
	  standing in front of a loader that lower-cases and would have read it.
	*/
	it.each([
		'MODEL.GLB',
		'Model.Glb',
		'scene.GLTF',
		'Scene.USDZ',
		'PART.STL',
		'Part.Fbx'
	])('accepts %s, whatever case the extension is written in', async (name) => {
		const { ctx } = context()
		await expect(loadModelFromFiles([file(name)], ctx)).resolves.toBeTruthy()
	})
})

describe('a bundle reaches the loader with its siblings', () => {
	it('passes the files beside a .gltf to the glTF loader', async () => {
		const { ctx, loadGLTFWithAssetsToThreeJS, loadToThreeJS } = context()
		const gltf = file('scene.gltf')
		const siblings = [file('scene.bin'), file('base.png')]

		await loadModelFromFiles([gltf, ...siblings], ctx)

		expect(loadToThreeJS).not.toHaveBeenCalled()
		expect(loadGLTFWithAssetsToThreeJS).toHaveBeenCalledOnce()

		const [passedGltf, passedAssets] = loadGLTFWithAssetsToThreeJS.mock.calls[0]
		expect(passedGltf).toBe(gltf)
		expect(passedAssets).toEqual(siblings)
	})

	/*
	  The second kind of bundle, and the branch that tells them apart. An OBJ's
	  material library is resolved by a three.js loader and a glTF's references
	  by glTF-Transform, so routing OBJ to `loadGltfModel` would hand a JSON
	  reader a text file of vertices. Both spies, so the mistake fails here
	  rather than as a parse error three layers down.
	*/
	it('passes the files beside an .obj to the bridged loader, not the glTF one', async () => {
		const { ctx, loadToThreeJS, loadGLTFWithAssetsToThreeJS } = context()
		const obj = file('part.obj')
		const siblings = [file('part.mtl'), file('wood.png')]

		await loadModelFromFiles([obj, ...siblings], ctx)

		expect(loadGLTFWithAssetsToThreeJS).not.toHaveBeenCalled()
		expect(loadToThreeJS).toHaveBeenCalledOnce()

		const [passedObj, passedSiblings] = loadToThreeJS.mock.calls[0]
		expect(passedObj).toBe(obj)
		expect(passedSiblings).toEqual(siblings)
	})

	it('hands a single file no siblings at all', async () => {
		/*
		  A GLB is not a bundle, so the other files a visitor happened to select
		  are not its siblings - passing them would let a stray `.mtl` in a
		  dropped folder reach a loader that has no business with it.
		*/
		const { ctx, loadToThreeJS } = context()

		await loadModelFromFiles([file('model.glb'), file('notes.txt')], ctx)

		expect(loadToThreeJS.mock.calls[0][1]).toEqual([])
	})

	it('does not treat a GLB as a bundle', async () => {
		// A GLB carries its textures, so nothing beside it is a sibling. If this
		// ever inverted, a GLB dropped next to a stray file would take the glTF
		// path and fail on JSON parsing.
		const { ctx, loadToThreeJS, loadGLTFWithAssetsToThreeJS } = context()

		await loadModelFromFiles([file('model.glb'), file('readme.txt')], ctx)

		expect(loadToThreeJS).toHaveBeenCalledOnce()
		/* Both spies, so inverting the branch fails here rather than elsewhere. */
		expect(loadGLTFWithAssetsToThreeJS).not.toHaveBeenCalled()
	})
})

describe('a selection that is not one model is refused, and says why', () => {
	it('refuses two different models as multiple_models', async () => {
		const error = await loadError([file('one.glb'), file('two.gltf')])

		expect(error.code).toBe('multiple_models')
		expect(error.recoverable).toBe(true)
		expect(error.message).toContain('one.glb')
		expect(error.message).toContain('two.gltf')
	})

	it('refuses a GLB beside a USDZ', async () => {
		/*
		  Named formats rather than "any two models", because this is the guard
		  the mutation gate drives: removing `usdz` from `MODEL_FORMATS` has to
		  redden the dispatch, the accept pattern AND this guard. With only
		  `glb` + `gltf` here it stayed green, which would have meant the guard
		  was reading something other than the owner and nobody would have known.
		*/
		const error = await loadError([file('one.glb'), file('two.usdz')])

		expect(error.code).toBe('multiple_models')
		expect(error.message).toContain('two.usdz')
	})

	it('counts an upper-case model among the multiple', async () => {
		// The same defect from the other side: before the fix this loaded
		// `one.gltf` silently and ignored the GLB the visitor also selected.
		const error = await loadError([file('one.gltf'), file('TWO.GLB')])

		expect(error.code).toBe('multiple_models')
		expect(error.message).toContain('TWO.GLB')
	})

	it('takes the first of two files in the same format rather than refusing', async () => {
		// Deliberate, and the behaviour that was there before the owner existed.
		const { ctx } = context()

		const loaded = await loadModelFromFiles(
			[file('first.glb'), file('second.glb')],
			ctx
		)

		expect(loaded.file.name).toBe('first.glb')
	})

	it('refuses a selection holding no model as unsupported_format', async () => {
		const error = await loadError([file('notes.txt'), file('texture.png')])

		expect(error.code).toBe('unsupported_format')
		expect(error.message).toContain('notes.txt')
	})

	it('refuses an empty selection', async () => {
		const error = await loadError([])

		expect(error.code).toBe('unsupported_format')
		expect(error.message).toBe('No files to load')
	})

	it('refuses a bundle sibling offered on its own', async () => {
		// `.bin` and the image extensions are in the picker so a glTF arrives
		// whole. Dispatching on one would hand the loader a buffer as a model.
		const error = await loadError([file('scene.bin')])

		expect(error.code).toBe('unsupported_format')
	})
})

/*
  An STL is not glTF, and `loadFromGlbBuffer` checks the magic bytes, so handing
  it the file the visitor picked fails ingest on a model that is already on
  screen - the optimize step silently disappears and the page keeps working.
  The loader converts once and reports what it converted to; this is where that
  travels.
*/
describe('the optimizer is ingested with glTF bytes, whatever was dropped', () => {
	it.each(['part.stl', 'part.fbx', 'part.obj'])(
		'ingests the converted GLB for %s, read through three.js',
		async (name) => {
			const { withOptimizer, loadFromGlbBuffer } = context()

			await loadModelFromFiles([file(name, 'not glTF at all')], withOptimizer)

			expect(loadFromGlbBuffer).toHaveBeenCalledOnce()
			expect(loadFromGlbBuffer.mock.calls[0][0]).toBe(CONVERTED_GLB)
		}
	)

	it('ingests the file itself when the file is already a GLB', async () => {
		/*
		  Not the same as the case above with a different expectation: a GLB is
		  re-read rather than re-serialized so that whatever it arrived
		  compressed as survives into the optimizer.
		*/
		const { withOptimizer, loadFromGlbBuffer } = context()

		await loadModelFromFiles(
			[file('model.glb', 'original bytes')],
			withOptimizer
		)

		expect(loadFromGlbBuffer).toHaveBeenCalledOnce()
		expect(new TextDecoder().decode(loadFromGlbBuffer.mock.calls[0][0])).toBe(
			'original bytes'
		)
	})

	it('ingests nothing for a USDZ, which is a zip', async () => {
		const { withOptimizer, loadFromGlbBuffer } = context()

		await loadModelFromFiles([file('model.usdz')], withOptimizer)

		expect(loadFromGlbBuffer).not.toHaveBeenCalled()
	})
})

describe('the model is published before anything optional runs', () => {
	it('publishes once, with what the viewer needs', async () => {
		const { ctx, publish } = context()

		await loadModelFromFiles([file('model.glb')], ctx)

		expect(publish).toHaveBeenCalledOnce()
		expect(publish.mock.calls[0][0].file.name).toBe('model.glb')
	})
})

/*
  Nothing here asserts what a path resolves to - that is the owner's spec. This
  asserts only that the path arrives at all, because until it does every rule
  below it is reading a bare file name and cannot be wrong about anything.
*/
describe('a refusal keeps the reason it was refused for', () => {
	it('reports a loader that named missing files as missing_assets', async () => {
		/*
		  THE COPY THAT NAMES THE REAL PROBLEM WAS UNREACHABLE. Whether a failed
		  load means "assets are missing" was decided by matching prose, and it
		  matched the scene payload builder's sentence - so the glTF loader's own
		  refusal was filed as a parse failure and the reader who dropped a valid
		  folder was told to check it was a valid glTF.

		  Thrown inside a wrapper on purpose: `loadFromFileObject` re-throws with
		  `Failed to load model from File object:` and the original on `cause`,
		  so a marker only on the outermost error would not have survived the
		  trip either.
		*/
		const { ctx, loadGLTFWithAssetsToThreeJS } = context()
		loadGLTFWithAssetsToThreeJS.mockRejectedValueOnce(
			new Error('Failed to load model from File object', {
				cause: missingAssetsError(
					'Missing required image files:\nbody/diffuse.png'
				)
			})
		)

		let refusal: StructuredLoadError | null = null
		try {
			await loadModelFromFiles([file('chair.gltf'), file('diffuse.png')], ctx)
		} catch (error) {
			refusal = error as StructuredLoadError
		}

		expect(refusal?.code).toBe('missing_assets')
	})

	it('still reports an ordinary parse failure as a parse failure', async () => {
		/* The half the marker must not swallow: an unreadable glTF is not an
		   incomplete one, and the two surfaces say different things. */
		const { ctx, loadGLTFWithAssetsToThreeJS } = context()
		loadGLTFWithAssetsToThreeJS.mockRejectedValueOnce(
			new Error('Unexpected token < in JSON at position 0')
		)

		let refusal: StructuredLoadError | null = null
		try {
			await loadModelFromFiles([file('chair.gltf'), file('diffuse.png')], ctx)
		} catch (error) {
			refusal = error as StructuredLoadError
		}

		expect(refusal?.code).toBe('gltf_load_failed')
	})
})

describe('a dropped folder carries the path each file sat at', () => {
	it('adopts the path react-dropzone computed', async () => {
		const { ctx, loadGLTFWithAssetsToThreeJS } = context()

		await loadModelFromFiles(
			[
				dropped('scene.gltf', '/chair/scene.gltf'),
				dropped('wood.png', '/chair/textures/wood.png')
			],
			ctx
		)

		const [gltf, assets] = loadGLTFWithAssetsToThreeJS.mock.calls[0]
		expect(gltf.webkitRelativePath).toBe('chair/scene.gltf')
		expect(assets[0].webkitRelativePath).toBe('chair/textures/wood.png')
	})

	it('keeps two same-named files in sibling folders apart', async () => {
		/*
		  The failure the path exists to prevent. Both of these are `diffuse.png`
		  and nothing else distinguishes them, so without the path the selection
		  holds one file where the visitor dropped two.
		*/
		const { ctx, loadGLTFWithAssetsToThreeJS } = context()

		await loadModelFromFiles(
			[
				dropped('scene.gltf', '/chair/scene.gltf'),
				dropped('diffuse.png', '/chair/body/diffuse.png'),
				dropped('diffuse.png', '/chair/wheels/diffuse.png')
			],
			ctx
		)

		const assets = loadGLTFWithAssetsToThreeJS.mock.calls[0][1]
		expect(assets.map((asset: File) => asset.webkitRelativePath)).toEqual([
			'chair/body/diffuse.png',
			'chair/wheels/diffuse.png'
		])
	})

	it('leaves a loose file with no path at all', async () => {
		/*
		  `file-selector` writes `./name` for a file that was not in a folder,
		  which says nothing the name does not - and `scene-data-builder` reads
		  this property's truthiness as "this file has a path".
		*/
		const { ctx, loadGLTFWithAssetsToThreeJS } = context()

		await loadModelFromFiles(
			[
				dropped('scene.gltf', './scene.gltf'),
				dropped('wood.png', './wood.png')
			],
			ctx
		)

		const [gltf, assets] = loadGLTFWithAssetsToThreeJS.mock.calls[0]
		expect(gltf.webkitRelativePath).toBeFalsy()
		expect(assets[0].webkitRelativePath).toBeFalsy()
	})

	it('does not overwrite the path the folder picker already set', async () => {
		const { ctx, loadGLTFWithAssetsToThreeJS } = context()
		const picked = dropped('wood.png', '/dropped/elsewhere/wood.png')
		Object.defineProperty(picked, 'webkitRelativePath', {
			value: 'chair/textures/wood.png',
			configurable: true,
			enumerable: true
		})

		await loadModelFromFiles([file('scene.gltf'), picked], ctx)

		expect(
			loadGLTFWithAssetsToThreeJS.mock.calls[0][1][0].webkitRelativePath
		).toBe('chair/textures/wood.png')
	})
})
