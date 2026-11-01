import { describe, expect, it } from 'vitest'

import {
	SCENE_ASSET_ROLE,
	sceneAssetRole,
	STUDIO_FINISH_FILENAME
} from './scene-asset-roles'

describe('what a scene asset link is for', () => {
	it('takes a link without a role as part of the model', () => {
		expect(sceneAssetRole(null, 'scene.gltf')).toBe(SCENE_ASSET_ROLE.model)
	})

	it('reads the original and the finish by their roles', () => {
		expect(sceneAssetRole(SCENE_ASSET_ROLE.source, 'source.glb')).toBe(
			SCENE_ASSET_ROLE.source
		)
		expect(sceneAssetRole(SCENE_ASSET_ROLE.finish, 'x.glb')).toBe(
			SCENE_ASSET_ROLE.finish
		)
	})

	// An older release relinks every asset under the model role.
	it('knows the finish by its name when an older release relinked it', () => {
		expect(sceneAssetRole(SCENE_ASSET_ROLE.model, STUDIO_FINISH_FILENAME)).toBe(
			SCENE_ASSET_ROLE.finish
		)
	})
})
