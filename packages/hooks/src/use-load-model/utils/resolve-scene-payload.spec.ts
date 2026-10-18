/**
 * Which settings survive the payload contract.
 *
 * A local draft is a flat `ServerSceneData` handed back in as a payload, with
 * no `settings` key. The contract used to read five hand-listed flat fields,
 * so a draft's hotspots, normalization, interactions, animation and
 * presentation were dropped on the way through.
 *
 * Mutation gates, executed: removing `hotspots` from the field record fails
 * the type-check and the every-field case; restoring the five-name list
 * reddens the every-field case; dropping the null guard reddens the
 * null-defers case.
 */
import { describe, expect, it } from 'vitest'

import { resolveServerSceneDataContract } from './resolve-scene-payload'

import type {
	SceneSettings,
	ServerSceneData,
	ServerScenePayload
} from '@vctrl/core'

const gltfJson = { asset: { version: '2.0' } } as ServerSceneData['gltfJson']

/*
  One value per field, typed as a total record so this fixture has to grow
  with `SceneSettings` too. `camera` and `interactions` are left empty because
  the contract normalizes them, which would make a reference-equality check
  test the normalizer rather than whether the field arrived.
*/
const everyField: Required<SceneSettings> = {
	animation: { clips: [] } as unknown as Required<SceneSettings>['animation'],
	bounds: { margin: 1.5 } as Required<SceneSettings>['bounds'],
	camera: {} as Required<SceneSettings>['camera'],
	interactions: [],
	controls: { enabled: true } as Required<SceneSettings>['controls'],
	environment: { preset: 'studio' } as Required<SceneSettings>['environment'],
	shadows: { type: 'contact' } as Required<SceneSettings>['shadows'],
	normalization: { enabled: true } as Required<SceneSettings>['normalization'],
	hotspots: [
		{
			id: 'h1',
			name: 'Lens',
			worldPosition: [0, 1, 0],
			visible: true
		}
	] as Required<SceneSettings>['hotspots'],
	presentation: {
		showLoadingThumbnail: false
	} as Required<SceneSettings>['presentation']
}

function payload(fields: Partial<ServerScenePayload>): ServerScenePayload {
	return { gltfJson, assetData: {}, ...fields }
}

describe('resolveServerSceneDataContract settings', () => {
	it('keeps every settings field a flat payload carries', () => {
		const resolved = resolveServerSceneDataContract(payload(everyField))

		for (const field of Object.keys(everyField) as Array<keyof SceneSettings>) {
			expect(resolved[field], field).toEqual(everyField[field])
		}
	})

	it('keeps every settings field a nested payload carries', () => {
		const resolved = resolveServerSceneDataContract(
			payload({ settings: everyField })
		)

		for (const field of Object.keys(everyField) as Array<keyof SceneSettings>) {
			expect(resolved[field], field).toEqual(everyField[field])
		}
	})

	it('lets a flat field win over its nested twin', () => {
		const resolved = resolveServerSceneDataContract(
			payload({
				hotspots: everyField.hotspots,
				settings: { hotspots: [], normalization: everyField.normalization }
			})
		)

		expect(resolved.hotspots).toEqual(everyField.hotspots)
		expect(resolved.normalization).toEqual(everyField.normalization)
	})

	it('lets a null flat field defer to the nested one', () => {
		const resolved = resolveServerSceneDataContract(
			payload({
				shadows: null as unknown as SceneSettings['shadows'],
				settings: { shadows: everyField.shadows }
			})
		)

		expect(resolved.shadows).toEqual(everyField.shadows)
	})

	it('normalizes interactions read from the flat payload', () => {
		expect(() =>
			resolveServerSceneDataContract(
				payload({
					interactions: 'not a list' as unknown as SceneSettings['interactions']
				})
			)
		).toThrow('interactions must be an array')
	})
})
