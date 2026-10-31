import { MAX_SCENE_LIGHTS } from '@vctrl/core'
import { ENVIRONMENT_PRESETS, SCENE_LIGHT_ROLES } from '@vctrl/sdk'
import { expectTypeOf } from 'vitest'

import { SceneSettingsParser } from './scene-settings.parser.server'
import { withSceneSettingsDefaults } from '../../../../constants/viewer-defaults'

import type { SceneSettingsRequest } from '../../../../types/api'
import type { EnvironmentKey, SceneLightRole } from '@vctrl/core'

/**
 * Bounds, controls, lighting, environment, shadows and normalization on the
 * save path.
 * The viewer spreads these into its 3D components as stored, so what the
 * parser lets through is what runs in every embed.
 */

const parse = (settings: Record<string, unknown>) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'update',
		sceneId: '33333333-3333-4333-8333-333333333333',
		settings
	})

const parsed = (result: unknown) => {
	if (result instanceof Response) throw new Error('expected a parsed request')
	const { settings } = result as SceneSettingsRequest
	if (!settings) throw new Error('the parser returned no settings')
	return settings
}

const refusal = async (result: unknown) => {
	if (!(result instanceof Response)) throw new Error('expected a refusal')
	expect(result.status).toBe(400)
	return ((await result.json()) as { error: string }).error
}

describe('look settings on the save path', () => {
	it('keeps every default the publisher starts a scene with', () => {
		const defaults = withSceneSettingsDefaults({})
		const settings = parsed(parse(defaults))

		expect(settings.bounds).toEqual(defaults.bounds)
		expect(settings.controls).toEqual(defaults.controls)
		expect(settings.environment).toEqual(defaults.environment)
		expect(settings.shadows).toEqual(defaults.shadows)
		expect(settings.normalization).toEqual(defaults.normalization)
	})

	it('keeps what the panels write: a backdrop, a bake, a tuned light', () => {
		const settings = parsed(
			parse({
				environment: {
					preset: 'night-city',
					backdrop: { type: 'gradient', top: '#ffffff', bottom: '#101010' }
				},
				shadows: {
					enabled: true,
					light: { radius: 1.4, position: [1.5, 4, 1.5] },
					baked: {
						assetId: 'asset-1',
						signature: 'sig',
						basis: { footprint: 1, radius: 2, vertexCount: 300 }
					}
				}
			})
		)

		expect(settings.environment).toEqual({
			preset: 'night-city',
			backdrop: { type: 'gradient', top: '#ffffff', bottom: '#101010' }
		})
		expect(settings.shadows?.baked?.basis?.vertexCount).toBe(300)
		expect(settings.shadows?.light?.position).toEqual([1.5, 4, 1.5])
	})

	it('drops an environment file, so no save can point visitors at a URL', () => {
		const settings = parsed(
			parse({
				environment: {
					preset: 'studio-soft',
					files: 'https://attacker.example/track.hdr'
				}
			})
		)

		expect(settings.environment).toEqual({ preset: 'studio-soft' })
	})

	it('drops keys it does not know, so a legacy scene still saves', () => {
		const settings = parsed(
			parse({ shadows: { type: 'accumulative', enabled: true } })
		)

		expect(settings.shadows).toEqual({ enabled: true })
	})

	it('refuses a known key of the wrong type, and names it', async () => {
		expect(await refusal(parse({ shadows: { opacity: 'dark' } }))).toContain(
			'shadows.opacity'
		)
		expect(await refusal(parse({ controls: { autoRotate: 'yes' } }))).toContain(
			'controls.autoRotate'
		)
	})

	it('refuses an unknown preset and a backdrop that is not hex', async () => {
		expect(await refusal(parse({ environment: { preset: 'mars' } }))).toContain(
			'environment.preset'
		)
		expect(
			await refusal(
				parse({
					environment: {
						backdrop: { type: 'color', color: 'url(https://x.example)' }
					}
				})
			)
		).toContain('environment.backdrop.color')
	})

	it('refuses a bake that would cost visitors without limit', async () => {
		expect(await refusal(parse({ shadows: { frames: 100000 } }))).toContain(
			'shadows.frames'
		)
		expect(await refusal(parse({ shadows: { resolution: 16384 } }))).toContain(
			'shadows.resolution'
		)
	})

	it('names the same presets as core', () => {
		// A preset core gains and the schema lacks would refuse every save of a
		// scene that picked it.
		expectTypeOf<
			(typeof ENVIRONMENT_PRESETS)[number]
		>().toEqualTypeOf<EnvironmentKey>()
	})

	it('keeps a lighting section as the tool writes it', () => {
		const lighting = {
			environment: { map: 'studio-key', intensity: 0.8, rotation: 140 },
			lights: [
				{ role: 'key', azimuth: 30, elevation: 50, size: 18, intensity: 1.5 },
				{ role: 'rim', azimuth: 210, color: '#cfe0ff' }
			],
			ground: { enabled: true },
			background: { type: 'gradient', top: '#fafafa', bottom: '#d4d4d8' },
			occlusion: { mode: 'live', live: { intensity: 1.2, atRest: true } }
		}
		expect(parsed(parse({ lighting })).lighting).toEqual(lighting)
	})

	it('refuses a fourth light and a second light in one role', async () => {
		const lights = (roles: string[]) => ({
			lighting: { lights: roles.map((role) => ({ role })) }
		})
		expect(
			await refusal(parse(lights(['key', 'fill', 'rim', 'key'])))
		).toContain('lighting.lights')
		expect(await refusal(parse(lights(['key', 'key'])))).toContain(
			'lighting.lights'
		)
	})

	it('refuses a lighting stage that is not hex', async () => {
		expect(
			await refusal(
				parse({
					lighting: { background: { type: 'color', color: 'tomato' } }
				})
			)
		).toContain('lighting.background')
	})

	it('names the same light roles, and so the same limit, as core', () => {
		// A role core gains and the schema lacks would refuse every save of a
		// scene that uses it; the limit is one light per role.
		expectTypeOf<
			(typeof SCENE_LIGHT_ROLES)[number]
		>().toEqualTypeOf<SceneLightRole>()
		expect(SCENE_LIGHT_ROLES).toHaveLength(MAX_SCENE_LIGHTS)
	})
})
