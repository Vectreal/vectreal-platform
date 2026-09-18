/**
 * What the one-off rename does to a scene saved before its assets carried
 * their folders.
 *
 * The cases that matter are the ones where it must NOT rename: a row two
 * references both want (the old save already lost one of the two files), a
 * scene it has already corrected, and a reference no row answers.
 */
import { planSceneAssetNameBackfill } from './asset-name-backfill'

const gltf = (uris: string[]) => ({
	images: uris.map((uri) => ({ uri })),
	buffers: []
})

describe('planSceneAssetNameBackfill', () => {
	it('renames a flattened row to the URI its glTF uses', () => {
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['body/diffuse.png']),
			assetRows: [{ id: 'a1', name: 'diffuse.png' }]
		})

		expect(plan.renames).toEqual([
			{ assetId: 'a1', from: 'diffuse.png', to: 'body/diffuse.png' }
		])
		expect(plan.collisions).toEqual([])
	})

	it('refuses a row two references both want, and says which', () => {
		/*
		  This is the scene the whole change exists for, and it is the one the
		  backfill cannot repair: the old save wrote one `diffuse.png` for both
		  URIs, so one texture is already gone. Renaming to either spelling would
		  claim a file that is not there. Leaving the flat name keeps the scene
		  loading the way it does today.
		*/
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['body/diffuse.png', 'wheels/diffuse.png']),
			assetRows: [{ id: 'a1', name: 'diffuse.png' }]
		})

		expect(plan.renames).toEqual([])
		expect(plan.collisions).toEqual([
			{
				storedName: 'diffuse.png',
				wantedBy: ['body/diffuse.png', 'wheels/diffuse.png']
			}
		])
	})

	it('treats two spellings of one reference as one file, not a collision', () => {
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['./body/diffuse.png', 'body/diffuse.png']),
			assetRows: [{ id: 'a1', name: 'diffuse.png' }]
		})

		expect(plan.collisions).toEqual([])
		expect(plan.renames).toEqual([
			{ assetId: 'a1', from: 'diffuse.png', to: 'body/diffuse.png' }
		])
	})

	it('changes nothing on a second run', () => {
		const alreadyDone = {
			gltfJson: gltf(['body/diffuse.png']),
			assetRows: [{ id: 'a1', name: 'body/diffuse.png' }]
		}

		const plan = planSceneAssetNameBackfill(alreadyDone)

		expect(plan.renames).toEqual([])
		expect(plan.unmatchedUris).toEqual([])
	})

	it('leaves a reference with no folder alone', () => {
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['diffuse.png']),
			assetRows: [{ id: 'a1', name: 'diffuse.png' }]
		})

		expect(plan.renames).toEqual([])
		expect(plan.unmatchedUris).toEqual([])
	})

	it('reports a reference no row answers rather than inventing one', () => {
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['body/missing.png']),
			assetRows: [{ id: 'a1', name: 'diffuse.png' }]
		})

		expect(plan.renames).toEqual([])
		expect(plan.unmatchedUris).toEqual(['body/missing.png'])
	})

	it('resolves a percent-encoded URI to the name the old save wrote', () => {
		/*
		  The stored name came from `normalizeAssetUri`, which decodes, so the row
		  is `50% roughness.png` rather than `50%25%20roughness.png`. Matching the
		  raw URI would find nothing and report the asset as missing.
		*/
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['textures/50%25%20roughness.png']),
			assetRows: [{ id: 'a1', name: '50% roughness.png' }]
		})

		expect(plan.renames).toEqual([
			{
				assetId: 'a1',
				from: '50% roughness.png',
				to: 'textures/50% roughness.png'
			}
		])
	})

	it('renames the buffer as well as the images', () => {
		const plan = planSceneAssetNameBackfill({
			gltfJson: {
				images: [{ uri: 'textures/wood.webp' }],
				buffers: [{ uri: 'geometry/scene.bin' }]
			},
			assetRows: [
				{ id: 'a1', name: 'wood.webp' },
				{ id: 'a2', name: 'scene.bin' }
			]
		})

		expect(plan.renames).toEqual([
			{ assetId: 'a1', from: 'wood.webp', to: 'textures/wood.webp' },
			{ assetId: 'a2', from: 'scene.bin', to: 'geometry/scene.bin' }
		])
	})

	it('leaves the scene glTF, the bake and the thumbnail alone', () => {
		/*
		  None of the three is referenced by the document, so none is reachable
		  from `referencedUris` and none needs excluding by name. Asserted because
		  renaming any of them breaks the save that reads them back by name.
		*/
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['body/diffuse.png']),
			assetRows: [
				{ id: 'a1', name: 'diffuse.png' },
				{ id: 'gltf', name: 'scene.gltf' },
				{ id: 'bake', name: 'shadow-bake.png' },
				{ id: 'thumb', name: 'scene-thumbnail.webp' }
			]
		})

		expect(plan.renames.map((rename) => rename.assetId)).toEqual(['a1'])
	})

	it('does not rename onto a name another row already holds', () => {
		/*
		  A half-finished earlier run leaves both spellings present. Renaming
		  `diffuse.png` onto the taken `body/diffuse.png` would give the scene two
		  rows with one name, which is the shape `getExistingAssetHashes` collapses
		  silently.
		*/
		const plan = planSceneAssetNameBackfill({
			gltfJson: gltf(['body/diffuse.png']),
			assetRows: [
				{ id: 'a1', name: 'diffuse.png' },
				{ id: 'a2', name: 'body/diffuse.png' }
			]
		})

		expect(plan.renames).toEqual([])
	})
})
