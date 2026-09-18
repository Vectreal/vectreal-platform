/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

/**
 * Which bytes each glTF URI actually resolved to.
 *
 * Nothing in any suite executed this before. `file-loaders.spec.ts` mocks
 * `loadGLTFWithAssetsToThreeJS` wholesale and every other glTF test stops at
 * dispatch, so the resolution rule and the user-visible `Missing required image
 * files` refusal were both entirely uncovered - which is why the headline case
 * below was live in the product and green in CI at the same time.
 *
 * It asserts on the parsed document rather than on a lookup table, because a
 * table that contains the right bytes under the wrong key is exactly the bug:
 * the twelve-clause cross product this replaced registered every asset under
 * every other asset's basename, so the last file written won both materials.
 *
 * Mutation gates, all executed:
 *  - `selectionKey(file)` back to `file.name` in `loadGLTFWithFileAssets` and
 *    the two-folder case goes red;
 *  - validate with the old five-spelling check while resolution keeps the owner
 *    and four cases go red, because the two rules disagree the moment they are
 *    written twice. The flat-selection case is not among them: the old check's
 *    basename spelling still matches there, which is the same reason that
 *    frame survived the rewrite;
 *
 * One property here is structural rather than tested, and saying so is the
 * point: validation and resolution cannot disagree, because both call the one
 * one `bytesFor` in `loadGLTFWithAssets`. A case asserting that was
 * written and then removed - every single-line change that breaks resolution
 * makes validation throw first, so it could only ever have gone red alongside a
 * stronger case, which is the definition of an assertion that cannot fail.
 *
 *  - blank `modelPath` inside `loadGLTFWithAssets` and two cases go red, the
 *    second-folder one and the buffer one - the buffer case resolves against
 *    the model's own directory, so it needs that directory to be known;
 *  - stop validating `gltfJson.buffers` and the missing-buffer case goes red;
 *  - validate every declared buffer rather than only the ones a `bufferView`
 *    points at, and `leaves a buffer nothing reads alone` goes red.
 *
 * `leaves a buffer with no URI alone, because it is the GLB chunk` gates
 * nothing and is kept as documentation; its case comment says why. No single
 * line mutation reddens it, because the used-buffer filter answers first when
 * nothing reads the buffer and the document is invalid for other reasons when
 * something does.
 */
import { describe, expect, it } from 'vitest'

import { ModelLoader } from './model-loader'

/** Distinguishable image bytes. The marker is the whole assertion. */
const png = (marker: number) =>
	new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker])

const markerOf = (bytes: Uint8Array | null) => bytes?.[8]

/** A glTF that references one image per material, by the URIs given. */
function gltfReferencing(...uris: string[]): Uint8Array {
	return new TextEncoder().encode(
		JSON.stringify({
			asset: { version: '2.0' },
			images: uris.map((uri) => ({ uri })),
			textures: uris.map((_uri, index) => ({ source: index })),
			materials: uris.map((uri, index) => ({
				name: uri,
				pbrMetallicRoughness: { baseColorTexture: { index } }
			}))
		})
	)
}

async function load(
	gltf: Uint8Array,
	assets: Map<string, Uint8Array>,
	modelPath = ''
) {
	const result = await new ModelLoader().loadGLTFWithAssets(
		gltf,
		assets,
		modelPath.split('/').pop() || 'scene.gltf',
		false,
		modelPath
	)
	return result.data.getRoot().listTextures()
}

describe('each URI resolves to the file it names', () => {
	it('gives two same-named images in sibling folders their own bytes', async () => {
		/*
		  THE DEFECT, end to end. Both materials came back with the second
		  image's bytes and the load reported success - a chair whose wheels
		  wore the body's texture, with nothing anywhere saying so.

		  The selection is keyed by path because that is what a dropped folder
		  now carries. Before that it was keyed by bare name, so the two files
		  were one entry before this function ever saw them.
		*/
		const textures = await load(
			gltfReferencing('body/diffuse.png', 'wheels/diffuse.png'),
			new Map([
				['chair/body/diffuse.png', png(1)],
				['chair/wheels/diffuse.png', png(2)]
			]),
			'chair/chair.gltf'
		)

		expect(textures.map((texture) => markerOf(texture.getImage()))).toEqual([
			1, 2
		])
	})

	it('resolves a buffer URI the same way as an image', async () => {
		/*
		  TWO CANDIDATES, AND THE VALUE SAYS WHICH ONE WON. This asserted
		  `listAccessors()).toHaveLength(1)` first, which counts the fixture's
		  own JSON and is 1 whichever bytes the URI resolved to - or none. It
		  was the only case in this file that never looked at what it got.

		  The two buffers decode to 1 and 2. The glTF sits at `chair/models/`, so
		  `buffers/scene.bin` means the one under `models` - while the decoy a
		  folder higher is the shallower match the tail stage would prefer, so
		  the case fails if the model's own position stops being consulted.
		*/
		const float = (value: number) =>
			new Uint8Array(new Float32Array([value]).buffer)

		const gltf = new TextEncoder().encode(
			JSON.stringify({
				asset: { version: '2.0' },
				buffers: [{ uri: 'buffers/scene.bin', byteLength: 4 }],
				bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
				accessors: [
					{ bufferView: 0, componentType: 5126, count: 1, type: 'SCALAR' }
				]
			})
		)

		const result = await new ModelLoader().loadGLTFWithAssets(
			gltf,
			new Map([
				['chair/models/buffers/scene.bin', float(1)],
				['chair/buffers/scene.bin', float(2)]
			]),
			'chair.gltf',
			false,
			'chair/models/chair.gltf'
		)

		const accessors = result.data.getRoot().listAccessors()
		expect(accessors).toHaveLength(1)
		expect(accessors[0].getArray()?.[0]).toBe(1)
	})

	it('reads a flat selection whose names carry no folders', async () => {
		/*
		  The server frame arrives here too. `reconstructGltfFiles` rebuilds a
		  saved scene into files named by the upload manifest's flattened
		  basenames, while the stored glTF keeps the folder URIs it was written
		  with - so this is the pair that has to keep working, and it is the one
		  with no test anywhere upstream of it.
		*/
		const textures = await load(
			gltfReferencing('body/diffuse.png', 'wheels/normal.png'),
			new Map([
				['diffuse.png', png(1)],
				['normal.png', png(2)]
			]),
			'scene.gltf'
		)

		expect(textures.map((texture) => markerOf(texture.getImage()))).toEqual([
			1, 2
		])
	})

	it('decodes a percent-encoded URI onto the file it names', async () => {
		const textures = await load(
			gltfReferencing('textures/red%20wood.png'),
			new Map([['chair/textures/red wood.png', png(3)]]),
			'chair/chair.gltf'
		)

		expect(markerOf(textures[0].getImage())).toBe(3)
	})

	it('keeps an encoded URI and its decoded twin on their own files', async () => {
		/*
		  Two images, two real files: one genuinely named `wood%20grain.png`, and
		  one named `wood grain.png` sitting a folder down, which the name-only
		  rung reaches. Both resolve correctly and to different files. The encoded
		  one was then handed to the reader under its decoded spelling as well,
		  which is the first one's own key - so the first material rendered the
		  second's bytes and the load reported success.

		  Encoded second, because the alias could only clobber an entry already
		  written. Reversed, both bind correctly, which is why this went unseen.
		*/
		const textures = await load(
			gltfReferencing('wood grain.png', 'wood%20grain.png'),
			new Map([
				['sub/wood grain.png', png(1)],
				['wood%20grain.png', png(2)]
			]),
			'chair.gltf'
		)

		expect(textures.map((texture) => markerOf(texture.getImage()))).toEqual([
			1, 2
		])
	})

	it('leaves an embedded data URI alone', async () => {
		/*
		  A data URI is the image. Validating it as a file reference would refuse
		  a self-contained glTF that needs no siblings at all.

		  ASSERTED ON THE BYTES, like every case around it. This read
		  `toHaveLength(1)`, which counts the fixture's own JSON and is 1 whether
		  or not anything was decoded. On the bytes it is a real gate: delete the
		  `if (isDataUrl(image.uri)) return` line from the image validation and
		  the load throws `Missing required image files` against an empty asset
		  map. The payload below decodes to `png(9)`.
		*/
		const textures = await load(
			gltfReferencing('data:image/png;base64,iVBORw0KGgoJ'),
			new Map()
		)

		expect(markerOf(textures[0].getImage())).toBe(9)
	})
})

describe('a reference it cannot resolve is refused, and named', () => {
	it('names the image that is missing', async () => {
		await expect(
			load(
				gltfReferencing('body/diffuse.png'),
				new Map([['chair/body/normal.png', png(1)]]),
				'chair/chair.gltf'
			)
		).rejects.toThrow(/Missing required image files[\s\S]*body\/diffuse\.png/)
	})

	it('refuses a genuine tie rather than texturing twice from one file', async () => {
		/*
		  WHERE THIS GOT STRICTER, DELIBERATELY. A glTF that names `diffuse.png`
		  while the selection holds two of them at the same depth has not said
		  which one it means. Loading it picked whichever was written last and
		  reported success; refusing leaves the visitor a message naming the
		  file, which is the outcome they can act on.
		*/
		await expect(
			load(
				gltfReferencing('diffuse.png'),
				new Map([
					['chair/body/diffuse.png', png(1)],
					['chair/wheels/diffuse.png', png(2)]
				]),
				'chair/chair.gltf'
			)
		).rejects.toThrow(/Missing required image files/)
	})

	it('does not reach into a second folder dropped alongside', async () => {
		/*
		  Two exports in one gesture. Answering chairA's reference with chairB's
		  file is the cross-folder mix-up, and it needs the model's own path to
		  be refused - which is why `modelPath` is passed rather than inferred.
		*/
		await expect(
			load(
				gltfReferencing('body/diffuse.png'),
				new Map([['chairB/body/diffuse.png', png(2)]]),
				'chairA/chairA.gltf'
			)
		).rejects.toThrow(/Missing required image files/)
	})

	it('names the buffer that is missing, rather than failing to parse', async () => {
		/*
		  THE COMMONEST INCOMPLETE BUNDLE, and the one shape the refusal could
		  not name. Only images were validated, so a `.gltf` without its `.bin`
		  reached `io.readJSON` and failed there - a parse error, which the page
		  turns into "Check it is a valid glTF." about a file that is valid and
		  merely incomplete.
		*/
		const gltf = new TextEncoder().encode(
			JSON.stringify({
				asset: { version: '2.0' },
				buffers: [{ uri: 'geometry/scene.bin', byteLength: 4 }],
				bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
				accessors: [
					{ bufferView: 0, componentType: 5126, count: 1, type: 'SCALAR' }
				]
			})
		)

		await expect(
			new ModelLoader().loadGLTFWithAssets(
				gltf,
				new Map([['chair/textures/wood.png', png(1)]]),
				'chair.gltf',
				false,
				'chair/chair.gltf'
			)
		).rejects.toThrow(
			/Missing required buffer files[\s\S]*geometry\/scene\.bin/
		)
	})

	it('leaves a buffer nothing reads alone', async () => {
		/*
		  THE CHECK IS ABOUT LOADING, NOT ABOUT TIDINESS. Validating every
		  declared buffer refused documents that load: an unreferenced buffer and
		  the `byteLength: 0` one some exporters emit. Both loaded before the
		  check existed, so refusing them was a regression dressed as a stricter
		  rule. A buffer no `bufferView` points at cannot make a load fail.
		*/
		const gltf = new TextEncoder().encode(
			JSON.stringify({
				asset: { version: '2.0' },
				buffers: [
					{ uri: 'geometry/scene.bin', byteLength: 4 },
					{ uri: 'nobody-reads-this.bin', byteLength: 4 },
					{ uri: 'empty.bin', byteLength: 0 }
				],
				bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
				accessors: [
					{ bufferView: 0, componentType: 5126, count: 1, type: 'SCALAR' }
				]
			})
		)

		await expect(
			new ModelLoader().loadGLTFWithAssets(
				gltf,
				new Map([
					[
						'chair/geometry/scene.bin',
						new Uint8Array(new Float32Array([7]).buffer)
					]
				]),
				'chair.gltf',
				false,
				'chair/chair.gltf'
			)
		).resolves.toBeDefined()
	})

	it('leaves a buffer with no URI alone, because it is the GLB chunk', async () => {
		/*
		  Nothing to go looking for, the same as an image with a `bufferView`.

		  DOCUMENTATION, NOT A GATE, and saying so beats implying otherwise. No
		  single change reddens this: unreferenced, the used-buffer filter answers
		  before the `uri` guard is reached, and referencing it to get past that
		  filter makes the document invalid - a `bufferView` pointing at a chunk
		  that does not exist, which the reader rejects for its own reasons.
		*/
		const gltf = new TextEncoder().encode(
			JSON.stringify({
				asset: { version: '2.0' },
				buffers: [{ byteLength: 0 }]
			})
		)

		await expect(
			new ModelLoader().loadGLTFWithAssets(gltf, new Map(), 'scene.gltf')
		).resolves.toBeDefined()
	})

	it('refuses an image with neither a URI nor a buffer view', async () => {
		const gltf = new TextEncoder().encode(
			JSON.stringify({
				asset: { version: '2.0' },
				images: [{}],
				textures: [{ source: 0 }]
			})
		)

		await expect(
			new ModelLoader().loadGLTFWithAssets(gltf, new Map(), 'scene.gltf')
		).rejects.toThrow(/no URI or bufferView/)
	})

	it('lists what it did have, so the message can be acted on', async () => {
		await expect(
			load(
				gltfReferencing('body/diffuse.png'),
				new Map([['chair/body/normal.png', png(1)]]),
				'chair/chair.gltf'
			)
		).rejects.toThrow(/chair\/body\/normal\.png/)
	})
})

/*
  Through the door the drop zone enters by. Everything above calls
  `loadGLTFWithAssets` with a map already built, which proves the rule and
  proves nothing about the caller that builds it - the #755 shape the delivery
  skill records. These two assert the map is keyed by the path the files carry.
*/
describe('a dropped folder reaches the loader keyed by its paths', () => {
	function fileAt(path: string, bytes: Uint8Array | string): File {
		const file = new File([bytes as BlobPart], path.split('/').pop() ?? path)
		Object.defineProperty(file, 'webkitRelativePath', {
			value: path,
			configurable: true,
			enumerable: true
		})
		return file
	}

	it('gives each same-named image its own bytes', async () => {
		const result = await new ModelLoader().loadGLTFWithFileAssets(
			fileAt(
				'chair/chair.gltf',
				new TextDecoder().decode(
					gltfReferencing('body/diffuse.png', 'wheels/diffuse.png')
				)
			),
			[
				fileAt('chair/body/diffuse.png', png(1)),
				fileAt('chair/wheels/diffuse.png', png(2))
			]
		)

		expect(
			result.data
				.getRoot()
				.listTextures()
				.map((texture) => markerOf(texture.getImage()))
		).toEqual([1, 2])
	})

	it('still loads a folder whose glTF names its own subfolders', async () => {
		/*
		  The regression this could have been. Scoping and tie-breaking only
		  earn their keep while the ordinary export still loads, and that export
		  is a glTF at the top of its folder naming `textures/`.
		*/
		const result = await new ModelLoader().loadGLTFWithFileAssets(
			fileAt(
				'chair/chair.gltf',
				new TextDecoder().decode(gltfReferencing('textures/wood.png'))
			),
			[fileAt('chair/textures/wood.png', png(7))]
		)

		expect(markerOf(result.data.getRoot().listTextures()[0].getImage())).toBe(7)
	})
})
