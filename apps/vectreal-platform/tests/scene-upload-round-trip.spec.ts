/**
 * What a saved scene gets back when it is opened again.
 *
 * THE SERVER FRAME HAD NO TESTS AT ALL, which is why this defect outlived the
 * one it mirrors. A dropped folder's two `diffuse.png` files were given their
 * own bytes by `@vctrl/core`'s resolution rule, saved through the upload
 * manifest, and came back as one image on both materials - the same chair
 * wearing its own body texture on its wheels, only now persisted.
 *
 * The cause was the manifest naming each stored asset by its basename while the
 * saved glTF kept the folder URIs it was written with, so the two ends no longer
 * agreed about which file was which.
 *
 * Mutation gates, all executed:
 *  - `storedFileName` back to `normalizedName.split('/').pop()` in
 *    `buildSceneUploadFileDescriptor` and the two-folder case goes red where
 *    the two descriptors collapse into one stored entry, before the markers are
 *    ever read - which is the defect itself, one step earlier than it renders;
 *  - drop the replace in `assetObjectPath`'s `objectSegment` and both bucket-key
 *    cases go red. It is one replace rather than two: a separate flattening
 *    step was written first and killed nothing, because the character rule had
 *    already subsumed it.
 *
 * That rule lives in its own pure module because `asset-storage.server.ts`
 * opens a database client at import time, so nothing in the default run can
 * import it - only the opt-in integration suites, which have a real Postgres.
 * What is NOT gated here is that `uploadSceneAssets` calls `assetObjectPath` at
 * all: reverting it to the old template literal is green in every default-run
 * suite. The rule is covered; its application is not.
 */
import { modelFormatForFileName } from '@vctrl/core/model-formats'
import { ModelLoader } from '@vctrl/core/model-loader'
import { calculateReferencedBytesFromServerScene } from '@vctrl/hooks/use-load-model/utils/calculate-referenced-bytes'
import { reconstructGltfFiles } from '@vctrl/hooks/use-load-model/utils/reconstruct-files'
import { describe, expect, it } from 'vitest'

import { assetObjectPath } from '../app/lib/domain/asset/asset-object-path'
import { buildSceneUploadFileDescriptor } from '../app/lib/domain/scene/client/scene-upload-manifest'

import type { ServerSceneData } from '@vctrl/core'

/** Distinguishable image bytes; the marker is the whole assertion. */
const png = (marker: number) =>
	new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker])

const markerOf = (bytes: Uint8Array | null) => bytes?.[8]

const gltfReferencing = (...uris: string[]) => ({
	asset: { version: '2.0' },
	images: uris.map((uri) => ({ uri })),
	textures: uris.map((_uri, index) => ({ source: index })),
	materials: uris.map((uri, index) => ({
		name: uri,
		pbrMetallicRoughness: { baseColorTexture: { index } }
	}))
})

describe('a scene keeps its assets apart across a save', () => {
	it('gives two same-named textures their own bytes when read back', async () => {
		/*
		  Saved the way the orchestrator saves: every referenced URI goes through
		  the descriptor, and what it names the file is what the server stores and
		  hands back. Then read back the way the publisher reads a saved scene.
		*/
		const referenced = ['body/diffuse.png', 'wheels/diffuse.png']
		const bytes = [png(1), png(2)]

		const assetData = Object.fromEntries(
			referenced.map((uri, index) => {
				const descriptor = buildSceneUploadFileDescriptor(uri, bytes[index])
				return [
					descriptor.fileName,
					{
						data: Array.from(bytes[index]),
						fileName: descriptor.fileName,
						mimeType: descriptor.mimeType
					}
				]
			})
		)

		expect(Object.keys(assetData)).toHaveLength(2)

		const data = {
			gltfJson: gltfReferencing(...referenced),
			assetData
		} as unknown as ServerSceneData

		const files = reconstructGltfFiles(data) as File[]
		const gltfFile = files.find((file) => file.name.endsWith('.gltf'))
		const assetFiles = files.filter((file) => file !== gltfFile)

		const result = await new ModelLoader().loadGLTFWithFileAssets(
			gltfFile as File,
			assetFiles
		)

		expect(
			result.data
				.getRoot()
				.listTextures()
				.map((texture) => markerOf(texture.getImage()))
		).toEqual([1, 2])
	})

	it('names a stored asset by where it sat, not by its last segment', () => {
		const descriptor = buildSceneUploadFileDescriptor(
			'wheels/diffuse.png',
			png(2)
		)

		expect(descriptor.fileName).toBe('wheels/diffuse.png')
		expect(descriptor.file.name).toBe('wheels/diffuse.png')
	})

	it('keeps the bucket key to one segment', () => {
		/*
		  The name carries the path; the object key cannot. Both separators,
		  because a name reaches storage from a glTF URI and from a `File.name`
		  written by a picker on Windows.
		*/
		expect(assetObjectPath('scene-1', 'asset-1', 'wheels/diffuse.png')).toBe(
			'scenes/scene-1/assets/asset-1/wheels_diffuse.png'
		)
		expect(assetObjectPath('scene-1', 'asset-1', 'wheels\\diffuse.png')).toBe(
			'scenes/scene-1/assets/asset-1/wheels_diffuse.png'
		)
	})

	it('keeps the bucket key to characters a bucket accepts', () => {
		/*
		  The key used to be the bare basename, so only the *file* name had to
		  satisfy Supabase Storage's key rule. Putting the folders in the key made
		  the *folder* name have to satisfy it too - and a folder name is
		  author-chosen prose. `Oberflächen/holz.png` saves today and was refused
		  with a 400 `InvalidKey` afterwards, permanently rather than once,
		  because no later save can write a key the bucket will not take.

		  Verified against a running local Supabase before this was written: the
		  unsanitized keys 400, the sanitized ones return 200.
		*/
		const keyOf = (name: string) =>
			assetObjectPath('s1', 'a1', name).split('/').pop()

		expect(keyOf('Oberflächen/holz.png')).toBe('Oberfl_chen_holz.png')
		expect(keyOf('材质/diffuse.png')).toBe('___diffuse.png')
		expect(keyOf('tex[lod0]/diffuse.png')).toBe('tex_lod0__diffuse.png')

		/* `#` and `?` pass the bucket's own rule but truncate the upload URL. */
		expect(keyOf('Textures #1/diffuse.png')).toBe('Textures__1_diffuse.png')
		expect(keyOf('tex/a?b.png')).toBe('tex_a_b.png')

		/* An ordinary name is left alone apart from its separators. */
		expect(keyOf('wheels/diffuse.png')).toBe('wheels_diffuse.png')

		/* Every key this can produce is one the bucket accepts. */
		for (const name of [
			'Oberflächen/holz.png',
			'材质/diffuse.png',
			'tex[lod0]/diffuse.png',
			'Textures #1/diffuse.png',
			'C:\\Users\\bob\\tex.png',
			'../shared/té xture.png'
		]) {
			expect(assetObjectPath('s1', 'a1', name)).toMatch(/^[A-Za-z0-9._\-/]+$/)
		}
	})

	it('never lets the key segment be nothing but dots', () => {
		/*
		  `.` and `..` are inside the character set a bucket accepts, so they
		  survive the replace - and the storage server then path-normalizes them.
		  A key ending `/..` is stored one directory UP, outside the `assetId`
		  that is supposed to make it unique. Confirmed against a running
		  Supabase: it answered 200 and reported the object at
		  `scenes/<id>/assets/`, with the asset directory gone.

		  Two such assets in one scene then collide and fail the save, and
		  `remove` reports success while deleting nothing - so the row goes, the
		  bytes stay, and they count against the org's storage for good. A glTF
		  can write `"uri": ".."`, so no picker is needed to get here.
		*/
		for (const name of ['.', '..', '...', '....']) {
			expect(assetObjectPath('s1', 'a1', name)).toBe(
				'scenes/s1/assets/a1/asset'
			)
		}

		/*
		  Only a segment that is *entirely* dots. `./.` becomes `._.` because the
		  separator is replaced too, and that normalizes to nothing.
		*/
		expect(assetObjectPath('s1', 'a1', './.')).toBe('scenes/s1/assets/a1/._.')
	})

	it('keeps the key segment inside the length one path component allows', () => {
		/*
		  The file backend enforces 255 bytes per path *component* and answers a
		  longer one with a 500 - bisected exactly: 255 uploads, 256 does not.
		  That budget used to be spent on the bare basename; putting the folders
		  in the key makes the whole flattened path compete for it, so a deeply
		  nested texture reaches it where its file name never would.

		  The tail is kept, because the end of a flattened path is the part that
		  says which file this is.
		*/
		const deep = `${Array.from({ length: 200 }, (_, i) => `dir${i}`).join('/')}/tex.png`
		const segment = assetObjectPath('s1', 'a1', deep).split('/').pop() as string

		expect(segment.length).toBeLessThanOrEqual(200)
		expect(segment.endsWith('dir199_tex.png')).toBe(true)

		/* A long name with no extension is still bounded. */
		expect(
			(assetObjectPath('s1', 'a1', 'y'.repeat(900)).split('/').pop() as string)
				.length
		).toBeLessThanOrEqual(200)
	})

	it('still reads a scene saved before assets carried their folders', async () => {
		/*
		  Every scene already saved has flat asset names against a glTF full of
		  folder URIs. That pair resolves through the loader's name-only rung, and
		  it has to keep resolving - this case asserted only that a flat name
		  stays flat, which both the old rule and the new one satisfy, so nothing
		  could redden it.
		*/
		const data = {
			gltfJson: gltfReferencing('body/diffuse.png'),
			assetData: {
				'diffuse.png': {
					data: Array.from(png(4)),
					fileName: 'diffuse.png',
					mimeType: 'image/png'
				}
			}
		} as unknown as ServerSceneData

		const files = reconstructGltfFiles(data) as File[]
		const gltfFile = files.find((file) => file.name.endsWith('.gltf')) as File
		const result = await new ModelLoader().loadGLTFWithFileAssets(
			gltfFile,
			files.filter((file) => file !== gltfFile)
		)

		expect(markerOf(result.data.getRoot().listTextures()[0].getImage())).toBe(4)
	})

	it('reads a scene whose title contains a slash', async () => {
		/*
		  Nothing validates a scene's title, and the reconstructed glTF is named
		  after it - so `Chair / v2` produced a key with a separator in it, the
		  loader read that as a folder, and every asset carrying its own folder
		  fell outside the model's scope. The scene failed to load from its title
		  alone. Harmless while stored assets were flat; giving them their folders
		  is what made it bite.
		*/
		const referenced = ['body/diffuse.png', 'wheels/diffuse.png']
		const bytes = [png(1), png(2)]

		const data = {
			meta: { name: 'Chair / v2' },
			gltfJson: gltfReferencing(...referenced),
			assetData: Object.fromEntries(
				referenced.map((uri, index) => [
					uri,
					{
						data: Array.from(bytes[index]),
						fileName: uri,
						mimeType: 'image/png'
					}
				])
			)
		} as unknown as ServerSceneData

		const files = reconstructGltfFiles(data) as File[]
		const gltfFile = files.find((file) => file.name.endsWith('.gltf')) as File
		const result = await new ModelLoader().loadGLTFWithFileAssets(
			gltfFile,
			files.filter((file) => file !== gltfFile)
		)

		expect(
			result.data
				.getRoot()
				.listTextures()
				.map((texture) => markerOf(texture.getImage()))
		).toEqual([1, 2])
	})

	it('weighs each referenced asset by its own name, not by a shared basename', () => {
		/*
		  `resolveSizeFromAssets` accepted a whole-name match or a basename match
		  one asset at a time, so the first asset whose basename matched answered for
		  every URI that shared it: two textures of wildly different weight
		  reported the heavier one's size, twice. It feeds the per-scene storage
		  gate, so a scene inside its plan limit could be refused a save.
		*/
		const data = {
			gltfJson: gltfReferencing('body/diffuse.png', 'wheels/diffuse.png'),
			assetData: {
				'body/diffuse.png': {
					data: Array.from(new Uint8Array(10_000)),
					fileName: 'body/diffuse.png',
					mimeType: 'image/png'
				},
				'wheels/diffuse.png': {
					data: Array.from(new Uint8Array(10)),
					fileName: 'wheels/diffuse.png',
					mimeType: 'image/png'
				}
			}
		} as unknown as ServerSceneData

		expect(calculateReferencedBytesFromServerScene(data).textureBytes).toBe(
			10_010
		)
	})

	it('reads a scene whose title would name a macOS sidecar', async () => {
		/*
		  The fix for the slash above manufactured this one: `./v2` has its
		  separator replaced and becomes `._v2.gltf`, and `modelFormatForFileName`
		  refuses any basename starting with `._` as an AppleDouble sidecar. The
		  scene failed to load from its title alone again, one route over.

		  The format check is the assertion that matters. `loadGLTFWithFileAssets`
		  never consults the registry, so loading alone would stay green with the
		  defect live; `loadModelFromFiles`, which is the documented entry for
		  these files, asks it first and refuses with `unsupported_format`.
		*/
		const data = {
			meta: { name: './v2' },
			gltfJson: gltfReferencing('body/diffuse.png'),
			assetData: {
				'body/diffuse.png': {
					data: Array.from(png(5)),
					fileName: 'body/diffuse.png',
					mimeType: 'image/png'
				}
			}
		} as unknown as ServerSceneData

		const files = reconstructGltfFiles(data) as File[]
		const gltfFile = files.find((file) => file.name.endsWith('.gltf')) as File

		expect(modelFormatForFileName(gltfFile.name)?.id).toBe('gltf')

		const result = await new ModelLoader().loadGLTFWithFileAssets(
			gltfFile,
			files.filter((file) => file !== gltfFile)
		)

		expect(markerOf(result.data.getRoot().listTextures()[0].getImage())).toBe(5)
	})

	it('weighs a reference under the case and separators a loader folds', () => {
		/*
		  The gate and the loader used to answer "which asset does this URI mean"
		  with two different rules. This asset is stored with the case and the
		  separator a Windows-authored export writes; the loader binds it, so the
		  figure that gates the save has to charge for it. The old rule was
		  case-sensitive and split on `/` alone, and answered 0.
		*/
		const data = {
			gltfJson: gltfReferencing('Body\\Diffuse.png'),
			assetData: {
				'body/diffuse.png': {
					data: Array.from(new Uint8Array(100)),
					fileName: 'body/diffuse.png',
					mimeType: 'image/png'
				},
				'wheels/diffuse.png': {
					data: Array.from(new Uint8Array(7)),
					fileName: 'wheels/diffuse.png',
					mimeType: 'image/png'
				}
			}
		} as unknown as ServerSceneData

		/*
		  The exact figure, not merely a non-zero one: a second asset sharing the
		  basename is what makes this able to catch resolution answering with the
		  wrong file, which is the failure the old rule actually produced.
		*/
		expect(calculateReferencedBytesFromServerScene(data).textureBytes).toBe(100)
	})

	it('weighs an asset whose own name contains a percent escape', () => {
		/*
		  A file named `wood%20grain.png` on disk is written `wood%2520grain.png`
		  by a spec-compliant exporter, and stored under the decoded-once
		  `wood%20grain.png`. The gate briefly decoded its keys as well, while
		  `referenceIn` decodes the reference - one step apart, so the asset fell
		  out of the map entirely and a scene weighed less than it is.
		*/
		const data = {
			gltfJson: gltfReferencing('wood%2520grain.png'),
			assetData: {
				'wood%20grain.png': {
					data: Array.from(new Uint8Array(321)),
					fileName: 'wood%20grain.png',
					mimeType: 'image/png'
				}
			}
		} as unknown as ServerSceneData

		expect(calculateReferencedBytesFromServerScene(data).textureBytes).toBe(321)
	})

	it('weighs two names that differ only by separator as one asset', async () => {
		/*
		  A Windows-authored glTF writes `tex\\wood.png`, and `normalizeAssetUri`
		  keeps the backslash - so a scene can hold two stored names that are the
		  same name once separators are folded. The loader folds them when it
		  builds its map and keeps the last; the gate keyed verbatim and kept
		  both, then answered with the first. Same scene, opposite files, and
		  which one depended on the order the rows came back in.

		  Both sides asserted together, because the defect is the disagreement
		  rather than either answer.
		*/
		const data = {
			gltfJson: gltfReferencing('tex/wood.png'),
			assetData: {
				'tex\\wood.png': {
					data: Array.from(png(7)),
					fileName: 'tex\\wood.png',
					mimeType: 'image/png'
				},
				'tex/wood.png': {
					data: Array.from(new Uint8Array([...png(8), ...new Uint8Array(40)])),
					fileName: 'tex/wood.png',
					mimeType: 'image/png'
				}
			}
		} as unknown as ServerSceneData

		const files = reconstructGltfFiles(data) as File[]
		const gltfFile = files.find((file) => file.name.endsWith('.gltf')) as File
		const result = await new ModelLoader().loadGLTFWithFileAssets(
			gltfFile,
			files.filter((file) => file !== gltfFile)
		)

		const rendered = result.data.getRoot().listTextures()[0].getImage()

		expect(markerOf(rendered)).toBe(8)
		expect(calculateReferencedBytesFromServerScene(data).textureBytes).toBe(
			rendered?.byteLength
		)
	})

	it('gives a foldered URI the wrong image once one stored name is flat', async () => {
		/*
		  WHY NO STORED ASSET MAY BE REUSED UNDER A NAME IT DOES NOT HAVE. A
		  basename nomination lived in the save orchestrator for one round, so
		  that the first save after names gained their folders would not
		  re-upload every texture. The server never renames a reused row, so it
		  left scenes half-flat and half-foldered - and this is what that state
		  does. A folderless key is in every scope but ranks last, so once one
		  foldered `diffuse.png` exists the flat row can never win the name-only
		  rung again, and *both* materials take the wheels texture.

		  Marker 2 twice, not `[1, 2]`, is the defect this whole changeset exists
		  to end, so this case records the reason rather than asserting a repair.
		*/
		const data = {
			gltfJson: gltfReferencing('body/diffuse.png', 'wheels/diffuse.png'),
			assetData: {
				'diffuse.png': {
					data: Array.from(png(1)),
					fileName: 'diffuse.png',
					mimeType: 'image/png'
				},
				'wheels/diffuse.png': {
					data: Array.from(png(2)),
					fileName: 'wheels/diffuse.png',
					mimeType: 'image/png'
				}
			}
		} as unknown as ServerSceneData

		const files = reconstructGltfFiles(data) as File[]
		const gltfFile = files.find((file) => file.name.endsWith('.gltf')) as File
		const result = await new ModelLoader().loadGLTFWithFileAssets(
			gltfFile,
			files.filter((file) => file !== gltfFile)
		)

		expect(
			result.data
				.getRoot()
				.listTextures()
				.map((texture) => markerOf(texture.getImage()))
		).toEqual([2, 2])
	})
})
