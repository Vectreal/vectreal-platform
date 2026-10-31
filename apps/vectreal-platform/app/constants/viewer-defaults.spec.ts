import { LEGACY_LIGHTING_DEFAULTS } from '@vctrl/core'
import { defaultShadowsOptions as viewerShadowDefaults } from '@vctrl/viewer'
import { resolveSceneViewCameras } from '@vctrl/viewer/hotspots'
import { describe, expect, it } from 'vitest'

import {
	defaultEnvOptions,
	defaultShadowsOptions,
	normalizeShadowOptions,
	withSceneSettingsDefaults
} from './viewer-defaults'

/**
 * `normalizeShadowOptions` is the only thing standing between persisted scene
 * JSON and the viewer, and the shapes it has to accept span three eras: rows
 * tagged `type: 'contact'` from when shadows were a discriminated union, rows
 * tagged `type: 'accumulative'` from the same era, and current saves that carry
 * no tag at all. The untagged case is the one worth pinning: reading it as
 * "unrecognized, reset to defaults" would silently discard every shadow setting
 * a user has made since the tag was dropped.
 */
describe('normalizeShadowOptions', () => {
	it('falls back to the defaults when nothing is stored', () => {
		expect(normalizeShadowOptions(undefined)).toEqual(defaultShadowsOptions)
	})

	it('keeps only the enabled flag from a legacy contact config', () => {
		const normalized = normalizeShadowOptions({
			type: 'contact',
			enabled: true,
			opacity: 0.5,
			scale: 10
		})

		expect(normalized).toEqual({ ...defaultShadowsOptions, enabled: true })
	})

	it('merges a legacy accumulative config over the defaults and drops the tag', () => {
		const normalized = normalizeShadowOptions({
			type: 'accumulative',
			enabled: true,
			opacity: 0.4
		})

		expect(normalized.opacity).toBe(0.4)
		expect(normalized.scale).toBe(defaultShadowsOptions.scale)
		expect(normalized).not.toHaveProperty('type')
	})

	it('merges an untagged config rather than resetting it', () => {
		const normalized = normalizeShadowOptions({ enabled: true, opacity: 0.4 })

		expect(normalized.opacity).toBe(0.4)
		expect(normalized.enabled).toBe(true)
	})

	it('fills in missing nested light and contact fields', () => {
		const normalized = normalizeShadowOptions({
			enabled: true,
			light: { ambient: 0.1 },
			contact: { enabled: true }
		})

		expect(normalized.light).toEqual({
			...defaultShadowsOptions.light,
			ambient: 0.1
		})
		expect(normalized.contact).toEqual({
			...defaultShadowsOptions.contact,
			enabled: true
		})
	})
})

/**
 * The Publisher, an article's example scene and a restored draft all read a
 * scene through here, and none of them through the server read. An example's
 * cameras and an old draft's starting camera carry no `kind`, and the viewer
 * reads an untagged camera that a hotspot links as that hotspot's close-up.
 */
describe('withSceneSettingsDefaults camera kinds', () => {
	it('keeps an untagged scene camera a view when a hotspot links it', () => {
		const { camera } = withSceneSettingsDefaults({
			camera: {
				cameras: [
					{ cameraId: 'default', name: 'Default Camera', initial: true },
					{ cameraId: 'detail', name: 'Detail' }
				]
			}
		})

		expect(
			resolveSceneViewCameras(camera.cameras, [
				{ linkedCameraId: 'default' }
			]).map((entry) => entry.cameraId)
		).toEqual(['default', 'detail'])
	})
})

/**
 * `resolveLighting` migrates a scene saved before `lighting` by assuming what
 * the viewer filled in for each absent field. Core cannot import these
 * defaults, so it carries its own copy; this holds it to the app's and the
 * viewer's, which embeds render through, until the legacy shapes are deleted. A drift here moves the migrated shadow of every
 * scene that never touched the field.
 */
describe('LEGACY_LIGHTING_DEFAULTS', () => {
	it('matches the defaults the viewer applied to legacy scenes', () => {
		const D = LEGACY_LIGHTING_DEFAULTS
		for (const shadows of [defaultShadowsOptions, viewerShadowDefaults]) {
			expect(D.shadowsEnabled).toBe(shadows.enabled)
			expect(D.lightPosition).toEqual(shadows.light?.position)
			expect(D.lightRadius).toBe(shadows.light?.radius)
			expect(D.lightAmbient).toBe(shadows.light?.ambient)
			expect(D.opacity).toBe(shadows.opacity)
			expect(D.ao).toBe(shadows.ao)
			expect(D.aoIntensity).toBe(shadows.aoIntensity)
			expect(D.aoAtRest).toBe(shadows.aoAtRest)
		}
		expect(D.environmentIntensity).toBe(defaultEnvOptions.environmentIntensity)
		expect(D.backgroundIntensity).toBe(defaultEnvOptions.backgroundIntensity)
		expect(D.backgroundBlurriness).toBe(defaultEnvOptions.backgroundBlurriness)
	})
})

describe('withSceneSettingsDefaults lighting', () => {
	it('passes a stored lighting through, so a read-modify-write keeps it', () => {
		const lighting = { lights: [{ role: 'key' as const, azimuth: 30 }] }
		expect(withSceneSettingsDefaults({ lighting }).lighting).toBe(lighting)
	})
})
